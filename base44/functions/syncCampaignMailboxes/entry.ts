import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { simpleParser } from 'npm:mailparser@3.7.1';
import { imapConnect, imapDate } from '../../shared/imap.js';
import { lower, classifyBounce, isAutoReply, isUnsubscribe, replyOnly, shouldPause, allRecords } from '../../shared/campaignMail.js';

// Bere predale za e-poštne kampanje (SendingMailbox):
//  - ODBITA sporočila (hard bounce) → naslov označi kot neveljaven, ustavi pošiljanje tej osebi;
//    ko je odbitih preveč (3 od zadnjega nadaljevanja ali > 3 %), kampanjo USTAVI in obvesti lastnika.
//  - ODGOVORE prejemnikov → ustavi kampanjo za to osebo, ustvari/posodobi stranko in pripravi odgovor.
//  - ODJAVE (»Odjava«) → naslov se ne uporablja več.
// Klic: urnik/interno { internal_secret, business_id?, mailbox_id? } ali lastnik { business_id }.

const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') || '';
const VERSION = 'campaign-mail-2026-11-11';
const MAX_PER_RUN = 60;
const FIRST_RUN_DAYS = 2;
const APP_URL = (Deno.env.get('APP_URL') || 'https://aristotle-smart-growth.base44.app').replace(/\/$/, '');

const ownsBusiness = (user, b) => !!user && !!b && (user.role === 'admin' || b.created_by_id === user.id
  || (!!user.email && (b.created_by === user.email || b.owner_email === user.email)));

async function readMailbox(mb) {
  const out = [];
  let maxUid = Number(mb.imap_last_uid) || 0;
  const c = await imapConnect({ host: mb.imap_host, port: Number(mb.imap_port) || 993, user: mb.email, pass: mb.imap_pass, timeoutMs: 15000, socketTimeoutMs: 60000 });
  try {
    await c.select('INBOX');
    const last = Number(mb.imap_last_uid) || 0;
    let uids = last > 0 ? await c.uidSearch(`UID ${last + 1}:*`) : await c.uidSearch(`SINCE ${imapDate(new Date(Date.now() - FIRST_RUN_DAYS * 86400000))}`);
    uids = (uids || []).filter((u) => u > last).sort((a, b) => a - b).slice(0, MAX_PER_RUN);
    if (uids.length) {
      const sizes = await c.uidSizes(uids);
      const small = uids.filter((u) => (sizes.get(u) || 0) <= 2_000_000);
      for (const u of uids) maxUid = Math.max(maxUid, u);
      for (let i = 0; i < small.length; i += 10) {
        for (const msg of await c.uidFetchSource(small.slice(i, i + 10))) {
          const p = await simpleParser(msg.source);
          const from = p.from?.value?.[0] || {};
          const extraText = (p.attachments || [])
            .filter((a) => /delivery-status|rfc822|text\//i.test(a.contentType || ''))
            .map((a) => { try { return Buffer.from(a.content).toString('utf8').slice(0, 20000); } catch { return ''; } }).join('\n');
          out.push({
            uid: msg.uid, messageId: p.messageId || `${mb.id}-${msg.uid}`, fromEmail: lower(from.address), fromName: from.name || '',
            subject: p.subject || '', text: (p.text || (p.html ? String(p.html).replace(/<[^>]+>/g, ' ') : '')).trim(), headers: p.headers, extraText,
            date: p.date || new Date(), inReplyTo: String(p.inReplyTo || ''), references: [].concat(p.references || []).join(' '),
          });
        }
      }
    }
  } finally { await c.logout().catch(() => {}); }
  return { mails: out, maxUid };
}

async function notifyOwner(base44, business, camp, alert) {
  const to = business.owner_email || business.created_by;
  if (!to) return;
  const list = alert.addresses.slice(0, 10).map((a) => `• ${a.email} — ${a.reason}`).join('<br>');
  const body = `<p>Pozdravljeni,</p>
<p>kampanjo <b>»${camp.name}«</b> smo <b>začasno ustavili</b>, ker se je vrnilo ${alert.count} sporočil (od ${alert.sent} prejemnikov, ${(alert.rate * 100).toFixed(1)} %). Naslovi verjetno ne obstajajo več:</p>
<p>${list}</p>
<p><b>Zakaj je to pomembno:</b> ponudniki e-pošte (Gmail, Outlook, Siol …) spremljajo, koliko vaših sporočil se vrne. Če jih je več kot nekaj odstotkov, začnejo vašo pošto pošiljati med neželeno pošto ali jo zavračati — tudi običajna sporočila z istega naslova in domene. Popravljanje ugleda lahko traja tedne.</p>
<p><b>Kaj priporočamo:</b> preden nadaljujete, preverite seznam v spletni storitvi za preverjanje e-naslovov (npr. Bouncer, MillionVerifier, ZeroBounce ali NeverBounce) in uvozite očiščen seznam. Odbiti naslovi so že izločeni in jim ne bomo več pisali.</p>
<p>Kampanjo lahko nadaljujete v aplikaciji: <a href="${APP_URL}/kampanje">E-poštne kampanje</a>.</p>`;
  await base44.asServiceRole.integrations.Core.SendEmail({ to, subject: `Kampanja »${camp.name}« je ustavljena: preveč vrnjenih sporočil`, body, from_name: 'AI Aristotle' }).catch((e) => console.error('notify failed', e?.message));
}

async function syncBusiness(base44, business, mailboxes) {
  const sr = base44.asServiceRole.entities;
  const res = { business_id: business.id, mailboxes: [], bounces: 0, soft: 0, replies: 0, unsubscribes: 0, auto_replies: 0, paused: [] };
  const [enrollments, contacts, leads, campaigns] = await Promise.all([
    allRecords(sr.CampaignEnrollment, { business_id: business.id }),
    allRecords(sr.ListContact, { business_id: business.id }),
    allRecords(sr.Lead, { business_id: business.id }),
    sr.Campaign.filter({ business_id: business.id }),
  ]);
  const leadsById = Object.fromEntries(leads.map((l) => [l.id, l]));
  const emailOf = (e) => lower(e.email || leadsById[e.lead_id]?.email);
  const enrByEmail = new Map();
  for (const e of enrollments) { const em = emailOf(e); if (!em) continue; if (!enrByEmail.has(em)) enrByEmail.set(em, []); enrByEmail.get(em).push(e); }
  const enrById = Object.fromEntries(enrollments.map((e) => [e.id, e]));
  const contactsByEmail = new Map();
  for (const c of contacts) { const em = lower(c.email); if (!contactsByEmail.has(em)) contactsByEmail.set(em, []); contactsByEmail.get(em).push(c); }
  const leadByEmail = new Map(leads.filter((l) => l.email).map((l) => [lower(l.email), l]));
  const campById = Object.fromEntries(campaigns.map((c) => [c.id, c]));
  const newBounceByCamp = {};
  const owner = business.owner_email || business.created_by;
  const offerAuto = business.offer_auto !== 'off' && (await sr.OfferTemplate.filter({ business_id: business.id }).catch(() => [])).some((t) => t.letterhead_url && t.design);

  for (const mb of mailboxes) {
    const mres = { mailbox_id: mb.id, email: mb.email, scanned: 0, error: null };
    res.mailboxes.push(mres);
    let mails = []; let maxUid = Number(mb.imap_last_uid) || 0;
    try { ({ mails, maxUid } = await readMailbox(mb)); }
    catch (e) {
      mres.error = (e?.auth || /AUTHENTICATIONFAILED/i.test(e?.message || '')) ? 'Prijava v predal ni uspela. Preverite geslo.' : `Branje predala ni uspelo (${String(e?.message || e).slice(0, 120)}).`;
      await sr.SendingMailbox.update(mb.id, { last_error: mres.error, last_checked_at: new Date().toISOString() });
      continue;
    }
    mres.scanned = mails.length;
    let bouncesHere = 0;
    for (const m of mails) {
      if (m.fromEmail === lower(mb.email)) continue;
      const b = classifyBounce(m);
      if (b) {
        if (!b.hard) { res.soft++; continue; }
        // Komu se je vrnilo: sklic v Message-ID (cmp-<vključitev>) ali naslov iz poročila, ki smo mu pisali.
        const hits = new Map();
        for (const ref of b.refs) { const e = enrById[ref]; if (e) hits.set(emailOf(e), true); }
        for (const em of [...b.recipients, ...b.emailsInText]) if (enrByEmail.has(em) && em !== lower(mb.email)) hits.set(em, true);
        if (!hits.size) continue;
        const now = new Date().toISOString();
        for (const em of hits.keys()) {
          res.bounces++; bouncesHere++;
          for (const e of enrByEmail.get(em) || []) {
            if (e.status === 'stopped_bounced') continue;
            if (!e.last_sent_at && !(Number(e.current_step) > 0)) continue; // tej osebi iz te kampanje še nismo pisali
            await sr.CampaignEnrollment.update(e.id, { status: 'stopped_bounced', bounce_reason: b.reason.slice(0, 300), bounced_at: now });
            e.status = 'stopped_bounced'; e.bounced_at = now;
            (newBounceByCamp[e.campaign_id] ||= []).push({ email: em, reason: b.reason.slice(0, 200) });
          }
          for (const c of contactsByEmail.get(em) || []) await sr.ListContact.update(c.id, { status: 'bounced', bounce_reason: b.reason.slice(0, 300), bounced_at: now });
          const lead = leadByEmail.get(em);
          if (lead && !lead.email_bounced) await sr.Lead.update(lead.id, { email_bounced: true });
        }
        continue;
      }
      // Ni odbito: ali je to odgovor nekoga, ki smo mu pisali v kampanji?
      const enrs = enrByEmail.get(m.fromEmail);
      if (!enrs?.length) continue;
      if (isAutoReply(m)) { res.auto_replies++; continue; }
      const now = new Date(m.date).toISOString();
      if (isUnsubscribe(m.text)) {
        res.unsubscribes++;
        for (const e of enrs) if (['active', 'completed'].includes(e.status)) await sr.CampaignEnrollment.update(e.id, { status: 'stopped_unsubscribed' });
        for (const c of contactsByEmail.get(m.fromEmail) || []) await sr.ListContact.update(c.id, { status: 'unsubscribed' });
        const lead = leadByEmail.get(m.fromEmail);
        if (lead) await sr.Lead.update(lead.id, { status: 'unsubscribed', consent_email: false });
        continue;
      }
      res.replies++;
      for (const e of enrs) if (e.status === 'active') await sr.CampaignEnrollment.update(e.id, { status: 'stopped_replied' });
      const cs = contactsByEmail.get(m.fromEmail) || [];
      const contact = cs[0];
      const campNames = [...new Set(enrs.map((e) => campById[e.campaign_id]?.name).filter(Boolean))];
      const body = m.text.slice(0, 8000);
      const fromLine = `${m.fromName ? m.fromName + ' ' : ''}<${m.fromEmail}>`;
      const note = `[${new Date(m.date).toLocaleDateString('sl-SI')}] Odgovor na kampanjo${campNames.length ? ` »${campNames.join('«, »')}«` : ''}: ${replyOnly(body).slice(0, 300)}`;
      let lead = leadByEmail.get(m.fromEmail);
      if (lead) {
        await sr.Lead.update(lead.id, {
          last_inbound_at: now, email_subject: m.subject, email_message_id: m.messageId, last_inbound_body: body, last_inbound_from: fromLine,
          reply_mailbox_id: mb.id, status: ['contacted', 'new'].includes(lead.status) ? 'replied' : lead.status, notes: `${note}\n${lead.notes || ''}`.slice(0, 4000),
        });
      } else {
        lead = await sr.Lead.create({
          business_id: business.id, name: (contact?.name || m.fromName || m.fromEmail.split('@')[0]).trim(), email: m.fromEmail, phone: contact?.phone || '',
          source: 'campaign', status: 'replied', consent_email: true, notes: note, email_subject: m.subject, email_message_id: m.messageId,
          last_inbound_at: now, last_inbound_body: body, last_inbound_from: fromLine, reply_mailbox_id: mb.id, created_by: owner, owner_email: owner,
          ...(contact?.company ? { service_requested: '' } : {}),
        });
        leadByEmail.set(m.fromEmail, lead);
        if (contact?.company) {
          try {
            const comp = (await sr.Company.filter({ business_id: business.id })).find((x) => lower(x.name) === lower(contact.company))
              || await sr.Company.create({ business_id: business.id, name: contact.company, website: contact.website || '', created_by: owner, owner_email: owner });
            await sr.Lead.update(lead.id, { company_id: comp.id });
          } catch { /* podjetje ni nujno */ }
        }
      }
      for (const c of cs) await sr.ListContact.update(c.id, { status: 'replied', replied_at: now, lead_id: lead.id });
      if (offerAuto) base44.asServiceRole.functions.invoke('autoOffer', { business_id: business.id, lead_id: lead.id, text: body.slice(0, 6000), subject: m.subject, is_reply: true, internal_secret: INTERNAL_SECRET }).catch(() => {});
      else base44.asServiceRole.functions.invoke('generateDraft', { business_id: business.id, lead_id: lead.id, pillar: 'web_form_lead', sequence_step: 1, internal_secret: INTERNAL_SECRET }).catch(() => {});
    }
    await sr.SendingMailbox.update(mb.id, { imap_last_uid: maxUid, last_checked_at: new Date().toISOString(), last_error: '', bounces_total: (Number(mb.bounces_total) || 0) + bouncesHere });
  }

  // Preveč odbitih → ustavi kampanjo in obvesti lastnika.
  for (const [cid, list] of Object.entries(newBounceByCamp)) {
    const camp = campById[cid];
    if (!camp || camp.status !== 'active') continue;
    const ce = enrollments.filter((e) => e.campaign_id === cid);
    const contacted = ce.filter((e) => e.last_sent_at || Number(e.current_step) > 0).length;
    const bounced = ce.filter((e) => e.status === 'stopped_bounced');
    const since = camp.resumed_at ? new Date(camp.resumed_at).getTime() : 0;
    const bouncesSinceResume = bounced.filter((e) => e.bounced_at && new Date(e.bounced_at).getTime() > since).length;
    if (!shouldPause({ bouncesSinceResume, bouncedTotal: bounced.length, contacted, newThisRun: list.length })) continue;
    const alert = {
      at: new Date().toISOString(), count: bounced.length, since_resume: bouncesSinceResume, sent: contacted, rate: contacted ? bounced.length / contacted : 0,
      addresses: bounced.slice(0, 30).map((e) => ({ email: emailOf(e), reason: e.bounce_reason || '' })),
    };
    await sr.Campaign.update(cid, { status: 'paused', paused_reason: 'bounces', paused_at: alert.at, bounce_alert: alert });
    res.paused.push(camp.name);
    await notifyOwner(base44, business, camp, alert);
  }
  return res;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const internal = !!INTERNAL_SECRET && body?.internal_secret === INTERNAL_SECRET;
    const user = internal ? null : await base44.auth.me().catch(() => null);
    const sr = base44.asServiceRole.entities;
    if (!internal && !user) return Response.json({ error: 'Unauthorized', version: VERSION }, { status: 401 });

    let mailboxes;
    if (body.mailbox_id) mailboxes = await sr.SendingMailbox.filter({ id: body.mailbox_id });
    else if (body.business_id) mailboxes = await sr.SendingMailbox.filter({ business_id: body.business_id });
    else {
      if (!internal && user?.role !== 'admin') return Response.json({ error: 'Ni dovoljenja.' });
      mailboxes = await sr.SendingMailbox.filter({ imap_enabled: true });
    }
    mailboxes = mailboxes.filter((m) => m.imap_enabled && m.imap_host && m.imap_pass && !m.is_demo);
    const byBiz = {};
    for (const m of mailboxes) (byBiz[m.business_id] ||= []).push(m);
    const results = [];
    for (const [bid, mbs] of Object.entries(byBiz)) {
      const business = (await sr.Business.filter({ id: bid }))[0];
      if (!business) continue;
      if (!internal && !ownsBusiness(user, business)) return Response.json({ error: 'Nimate dostopa do tega podjetja.' });
      try { results.push(await syncBusiness(base44, business, mbs)); } catch (e) { results.push({ business_id: bid, error: e?.message || String(e) }); }
    }
    return Response.json({ success: true, version: VERSION, results });
  } catch (error) {
    return Response.json({ error: 'syncCampaignMailboxes: ' + (error?.message || String(error)), version: VERSION });
  }
});
