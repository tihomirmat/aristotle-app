import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { ImapFlow } from 'npm:imapflow@1.0.164';
import { simpleParser } from 'npm:mailparser@3.7.1';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';

// Prebere nova sporočila iz poštnega predala podjetja (IMAP), AI prepozna povpraševanja
// (tudi obvestila spletnih obrazcev, kjer je kontakt stranke v telesu), ustvari/posodobi stranko
// (source=email) in za nove stranke pripravi odgovor v »Za odobritev«.
// Klic: (a) lastnik iz aplikacije { business_id }  (b) interno/urnik { internal_secret, business_id? } → vsa podjetja z imap_enabled.

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') || '';
const MAX_PER_RUN = 40;
const FIRST_RUN_DAYS = 7;

const ownsBusiness = (user, b) => !!user && !!b && (user.role === 'admin' || b.created_by_id === user.id
  || (!!user.email && (b.created_by === user.email || b.owner_email === user.email)));

const lower = (s) => String(s || '').toLowerCase().trim();

async function classify(items, business) {
  if (!items.length) return { results: [], usage: null };
  const sys = `Si asistent slovenskega podjetja "${business.name}" (${business.services ? business.services.split('\n').slice(0, 6).join(', ') : 'storitve'}).
Za vsako prejeto e-sporočilo ugotovi, ali je POVPRAŠEVANJE potencialne ali obstoječe stranke (želi storitev, ponudbo, ceno, termin, informacijo o storitvi, ali je obvestilo spletnega obrazca s podatki stranke).
NI povpraševanje: novice, reklame, računi dobaviteljev, sistemska obvestila, potrdila naročil, spam, notranja pošta, odgovori na naše masovne kampanje brez vprašanja.
Pri obvestilih spletnih obrazcev (pošiljatelj je spletna stran ali no-reply) vzemi ime, e-naslov in telefon STRANKE iz telesa, ne pošiljatelja.
Vrni ZGOLJ JSON tabelo v istem vrstnem redu: [{"i":0,"is_inquiry":true,"name":"","email":"","phone":"","service":"","summary":"1-2 stavka v slovenščini, kaj stranka želi"}]. Ne izmišljuj podatkov.`;
  const user = items.map((m, i) => `#${i}\nOD: ${m.fromName} <${m.fromEmail}>\nZADEVA: ${m.subject}\nBESEDILO:\n${m.text.slice(0, 1500)}`).join('\n\n---\n\n');
  const res = await anthropic.messages.create({ model: 'claude-haiku-4-5', max_tokens: 2500, system: sys, messages: [{ role: 'user', content: user }] });
  const raw = (res.content?.[0]?.text || '[]').trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
  let arr = [];
  try { arr = JSON.parse(raw); } catch { arr = []; }
  return { results: Array.isArray(arr) ? arr : [], usage: res.usage };
}

async function syncOne(base44, business) {
  const out = { business_id: business.id, scanned: 0, inquiries: 0, new_leads: 0, updated_leads: 0, error: null };
  if (!business.imap_host || !business.imap_user || !business.imap_pass) { out.error = 'Poštni predal ni povezan.'; return out; }

  const client = new ImapFlow({
    host: business.imap_host, port: Number(business.imap_port) || 993, secure: business.imap_secure !== false,
    auth: { user: business.imap_user, pass: business.imap_pass }, logger: false,
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 60000,
  });
  const ownAddresses = new Set([lower(business.imap_user), lower(business.smtp_user), lower(business.smtp_from_email)].filter(Boolean));
  const rules = String(business.inquiry_rules || '').split('\n').map(lower).filter(Boolean);
  let maxUid = Number(business.imap_last_uid) || 0;
  const mails = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const lastUid = Number(business.imap_last_uid) || 0;
      let uids = lastUid > 0
        ? await client.search({ uid: `${lastUid + 1}:*` }, { uid: true })
        : await client.search({ since: new Date(Date.now() - FIRST_RUN_DAYS * 86400000) }, { uid: true });
      uids = (uids || []).filter((u) => u > lastUid).sort((a, b) => a - b).slice(-MAX_PER_RUN);
      if (uids.length) {
        for await (const msg of client.fetch(uids, { uid: true, size: true, envelope: true, source: true }, { uid: true })) {
          maxUid = Math.max(maxUid, msg.uid);
          if ((msg.size || 0) > 3_000_000) continue;
          const parsed = await simpleParser(msg.source);
          const from = parsed.from?.value?.[0] || {};
          const fromEmail = lower(from.address);
          if (!fromEmail || ownAddresses.has(fromEmail)) continue;
          const headers = parsed.headers;
          const autoSubmitted = lower(headers.get('auto-submitted'));
          const precedence = lower(headers.get('precedence'));
          const subject = parsed.subject || '';
          const text = (parsed.text || (parsed.html ? String(parsed.html).replace(/<[^>]+>/g, ' ') : '')).replace(/\s+\n/g, '\n').trim();
          const forced = rules.some((r) => fromEmail.includes(r) || lower(subject).includes(r));
          const bulk = !!headers.get('list-unsubscribe') || ['bulk', 'list', 'junk'].includes(precedence) || (autoSubmitted && autoSubmitted !== 'no');
          // Obvestila obrazcev so pogosto avtomatska — preskočimo samo, če niso v pravilih in so očitno masovna.
          if (bulk && !forced && !/obrazec|povpra|form|kontakt|inquiry|naročil/i.test(subject)) continue;
          mails.push({ uid: msg.uid, messageId: parsed.messageId || `${business.id}-${msg.uid}`, fromName: from.name || '', fromEmail, subject, text, date: parsed.date || new Date(), forced });
        }
      }
    } finally { lock.release(); }
    await client.logout().catch(() => {});
  } catch (e) {
    out.error = /auth/i.test(e?.message || e?.responseText || '') ? 'Prijava v poštni predal ni uspela. Preverite geslo.' : `Povezava s poštnim strežnikom ni uspela (${e?.message || e}).`;
    await base44.asServiceRole.entities.Business.update(business.id, { imap_last_error: out.error, imap_last_sync_at: new Date().toISOString() });
    try { await client.logout(); } catch { /* ignore */ }
    return out;
  }
  out.scanned = mails.length;

  // AI razvrščanje v paketih po 10
  const leads = await base44.asServiceRole.entities.Lead.filter({ business_id: business.id });
  const byEmail = new Map(leads.filter((l) => l.email).map((l) => [lower(l.email), l]));
  const seenIds = new Set(leads.map((l) => l.email_message_id).filter(Boolean));
  let tokensIn = 0, tokensOut = 0;
  for (let i = 0; i < mails.length; i += 10) {
    const batch = mails.slice(i, i + 10).filter((m) => !seenIds.has(m.messageId));
    if (!batch.length) continue;
    const { results, usage } = await classify(batch, business);
    tokensIn += usage?.input_tokens || 0; tokensOut += usage?.output_tokens || 0;
    for (const r of results) {
      const m = batch[r?.i];
      if (!m) continue;
      if (!r.is_inquiry && !m.forced) continue;
      const email = lower(r.email) || m.fromEmail;
      if (!email || ownAddresses.has(email)) continue;
      out.inquiries++;
      const note = `[${new Date(m.date).toLocaleDateString('sl-SI')}] E-pošta »${m.subject}«: ${r.summary || m.text.slice(0, 300)}`;
      const existing = byEmail.get(email);
      if (existing) {
        await base44.asServiceRole.entities.Lead.update(existing.id, {
          last_inbound_at: new Date(m.date).toISOString(),
          email_subject: m.subject, email_message_id: m.messageId,
          status: ['contacted', 'new'].includes(existing.status) ? 'replied' : existing.status,
          notes: `${note}\n${existing.notes || ''}`.slice(0, 4000),
        });
        out.updated_leads++;
      } else {
        const owner = business.owner_email || business.created_by;
        const lead = await base44.asServiceRole.entities.Lead.create({
          business_id: business.id, name: (r.name || m.fromName || email.split('@')[0]).trim(), email,
          phone: r.phone || '', notes: `${note}\n\nIzvirno sporočilo:\n${m.text.slice(0, 2500)}`,
          service_requested: r.service || '', source: 'email', status: 'new', consent_email: true,
          email_subject: m.subject, email_message_id: m.messageId, last_inbound_at: new Date(m.date).toISOString(),
          created_by: owner, owner_email: owner,
        });
        byEmail.set(email, lead);
        out.new_leads++;
        base44.asServiceRole.functions.invoke('generateDraft', {
          business_id: business.id, lead_id: lead.id, pillar: 'web_form_lead', sequence_step: 1, internal_secret: INTERNAL_SECRET,
        }).catch(() => {});
      }
    }
  }

  await base44.asServiceRole.entities.Business.update(business.id, {
    imap_last_uid: maxUid, imap_last_sync_at: new Date().toISOString(), imap_last_error: '',
  });
  if (tokensIn || tokensOut) {
    base44.asServiceRole.entities.UsageLog.create({
      business_id: business.id, date: new Date().toISOString().split('T')[0], pillar: 'leads', feature: 'inbox_sync', model: 'claude-haiku-4-5',
      input_tokens: tokensIn, output_tokens: tokensOut, cost_eur: (tokensIn * 0.92 + tokensOut * 4.6) / 1_000_000, is_demo: false,
    }).catch(() => {});
  }
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const internal = !!INTERNAL_SECRET && body?.internal_secret === INTERNAL_SECRET;

    // Urnik (workflow) teče kot skrbnik aplikacije brez business_id → obdelaj vsa podjetja.
    const user = internal ? null : await base44.auth.me().catch(() => null);
    const scheduled = internal || (user?.role === 'admin' && !body.business_id);
    if (!scheduled) {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (!body.business_id) return Response.json({ error: 'business_id manjka' });
      const business = (await base44.asServiceRole.entities.Business.filter({ id: body.business_id }))[0];
      if (!business || !ownsBusiness(user, business)) return Response.json({ error: 'Nimate dostopa do tega podjetja.' });
      const r = await syncOne(base44, business);
      return Response.json(r.error ? { error: r.error, ...r } : { success: true, ...r });
    }

    // Urnik: vsa podjetja z vklopljenim branjem pošte
    const all = body.business_id
      ? await base44.asServiceRole.entities.Business.filter({ id: body.business_id })
      : await base44.asServiceRole.entities.Business.filter({ imap_enabled: true });
    const results = [];
    for (const b of all) {
      if (!b.imap_enabled) continue;
      try { results.push(await syncOne(base44, b)); } catch (e) { results.push({ business_id: b.id, error: e?.message || String(e) }); }
    }
    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: 'Napaka pri branju pošte: ' + (error?.message || String(error)) });
  }
});
