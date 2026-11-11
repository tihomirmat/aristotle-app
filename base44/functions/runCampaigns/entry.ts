import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import nodemailer from 'npm:nodemailer@6.9.9';
import { imapConnect, findSentBox } from '../../shared/imap.js';
import { lower, inSendWindow, ljNow, remainingToday, perRunCap, sentToday, mergeFields, pauseIfTooManyBounces, allRecords, htmlToText, emailifyHtml, hasHtml, fetchAttachments } from '../../shared/campaignMail.js';
import { syncCampaignMailboxesFor } from '../../shared/campaignSync.js';
import { openMailbox } from '../../shared/secretBox.js';

// E-poštne kampanje (vsako uro).
// 1) Najprej prebere kampanjske predale (odbita sporočila, odgovori, odjave) — syncCampaignMailboxes.
// 2) Kampanje za VAŠE STRANKE (source=leads): pripravi naslednje sporočilo (Čaka na vaš odgovor ali samodejno pošlje).
// 3) Kampanje iz SEZNAMA NASLOVOV (source=list): pošlje neposredno s kampanjskih predalov, pon–pet 8–17,
//    z dnevno mejo na predal (20/dan prva 2 tedna, nato 50, ali ročno) razporejeno čez dan.
//    Najprej nadaljevanja sekvence (follow-up), nato novi naslovi. Vsaka oseba dobiva vsa sporočila z istega predala.

const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') || '';
const VERSION = 'run-campaigns-2026-11-12-enc';
const MAX_AI_PER_RUN = 15;
const MAX_LIST_SENDS_PER_RUN = 40;
const DAY = 86400000;
const APP_ID = '69fb8760fa0b118b8a291e26';
const APP_URL = (Deno.env.get('APP_URL') || 'https://aristotle-smart-growth.base44.app').replace(/\/$/, '');

const isTrialActive = (b) => b?.subscription_status === 'trialing' && !!b.trial_ends_at && new Date(b.trial_ends_at) > new Date();
const isTrialExpired = (b) => b?.subscription_status === 'trialing' && !!b.trial_ends_at && new Date(b.trial_ends_at) <= new Date();
const canSendCampaigns = (b) => !!b && !isTrialExpired(b) && (isTrialActive(b) || b.pillar_reactivation === true);

const lastTouch = (l) => Math.max(...[l.last_inbound_at, l.last_contacted_at, l.created_date].filter(Boolean).map((d) => new Date(d).getTime()));
const matchAudience = (lead, a = {}) => {
  if (!lead.email || lead.consent_email === false || lead.status === 'unsubscribed' || lead.email_bounced) return false;
  if (a.stages?.length && !a.stages.includes(lead.status || 'new')) return false;
  if (a.sources?.length && !a.sources.includes(lead.source)) return false;
  if (a.has_company === 'yes' && !lead.company_id) return false;
  if (a.has_company === 'no' && lead.company_id) return false;
  if (a.inactive_days > 0 && Date.now() - lastTouch(lead) < a.inactive_days * DAY) return false;
  return true;
};
const firstName = (name) => {
  const n = String(name || '').trim().split(/\s+/)[0] || '';
  return /^[A-ZČŠŽĆĐ][a-zčšžćđ]+$/.test(n) ? n : '';
};
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const textToHtml = (t) => String(t || '').trim().split(/\n{2,}/).map((b) => `<p style="margin:0 0 14px">${esc(b).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, '<br>')}</p>`).join('');

async function hmac(text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(INTERNAL_SECRET || 'no-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((res) => setTimeout(() => res({ timeout: true }), ms))]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- pošiljanje s kampanjskega predala ----------
class MailboxSender {
  constructor(sr, mb) { this.sr = sr; this.mb = mb; this.transport = null; this.imap = null; this.sentBox = undefined; this.sentRun = 0; this.dead = null; }
  get capacity() { return this.dead ? 0 : Math.max(0, Math.min(remainingToday(this.mb), perRunCap(this.mb) - this.sentRun)); }
  async send({ to, subject, text, html, messageId, headers, attachments }) {
    const mb = this.mb;
    if (!this.transport) {
      this.transport = nodemailer.createTransport({ host: mb.smtp_host, port: Number(mb.smtp_port) || 587, secure: Number(mb.smtp_port) === 465, requireTLS: Number(mb.smtp_port) === 587, auth: { user: mb.email, pass: mb.smtp_pass }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000 });
    }
    const opts = { from: `"${String(mb.from_name || '').replace(/"/g, '')}" <${mb.email}>`, to, subject, text, html, messageId, headers, ...(attachments?.length ? { attachments } : {}) };
    const raw = (await nodemailer.createTransport({ streamTransport: true, buffer: true }).sendMail(opts)).message;
    await this.transport.sendMail({ envelope: { from: mb.email, to: [to] }, raw });
    this.sentRun++;
    const today = ljNow().date;
    const st = sentToday(mb) + 1;
    const patch = { sent_date: today, sent_today: st, total_sent: (Number(mb.total_sent) || 0) + 1, ...(mb.first_send_at ? {} : { first_send_at: new Date().toISOString() }), status: 'ok' };
    Object.assign(mb, patch);
    await this.sr.SendingMailbox.update(mb.id, patch);
    // kopija v »Poslano«
    if (mb.imap_enabled && mb.imap_host && mb.imap_pass && this.sentBox !== null) {
      try {
        if (!this.imap) { this.imap = await imapConnect({ host: mb.imap_host, port: Number(mb.imap_port) || 993, user: mb.email, pass: mb.imap_pass, timeoutMs: 10000 }); this.sentBox = findSentBox(await this.imap.list()) || null; }
        if (this.sentBox) await this.imap.append(this.sentBox.path, raw, ['\\Seen']);
      } catch { this.sentBox = null; }
    }
  }
  async close() { try { this.transport?.close(); } catch { /* */ } try { await this.imap?.logout(); } catch { /* */ } }
}

async function runListCampaign({ base44, sr, camp, business, senders, blocked, summary, budget }) {
  const steps = Array.isArray(camp.steps) ? camp.steps : [];
  const mySenders = (camp.mailbox_ids || []).map((id) => senders[id]).filter(Boolean);
  if (!mySenders.length) { summary.errors.push(`${camp.name}: ni izbranega predala za pošiljanje.`); return; }
  const now = Date.now();
  const [enrollments, contacts] = await Promise.all([
    allRecords(sr.CampaignEnrollment, { business_id: camp.business_id, campaign_id: camp.id }),
    Promise.all((camp.list_ids || []).map((lid) => allRecords(sr.ListContact, { business_id: camp.business_id, list_id: lid }))).then((x) => x.flat()),
  ]);
  const contactById = Object.fromEntries(contacts.map((c) => [c.id, c]));
  const enrolledEmails = new Set(enrollments.map((e) => lower(e.email)));
  const due = enrollments.filter((e) => e.status === 'active' && e.contact_id && (!e.next_send_at || new Date(e.next_send_at).getTime() <= now))
    .sort((a, b) => new Date(a.next_send_at || 0) - new Date(b.next_send_at || 0));
  const fresh = [];
  const seen = new Set();
  for (const c of contacts) {
    const em = lower(c.email);
    if (c.status !== 'ok' || seen.has(em) || enrolledEmails.has(em) || blocked.has(em)) continue;
    seen.add(em); fresh.push(c);
  }
  const owner = business.owner_email || business.created_by;
  const signature = business.email_signature ? String(business.email_signature).trim() : `Lep pozdrav,\n${business.name}`;
  let newBounces = 0;
  const attachCache = {};

  const pickSender = (e) => {
    if (e?.mailbox_id) { const s = senders[e.mailbox_id]; return s && s.capacity > 0 ? s : null; }
    return mySenders.filter((s) => s.capacity > 0).sort((a, b) => b.capacity - a.capacity)[0] || null;
  };

  const sendTo = async (enr, contact) => {
    const idx = Number(enr.current_step) || 0;
    const step = steps[idx];
    if (!step) { await sr.CampaignEnrollment.update(enr.id, { status: 'completed' }); summary.completed++; return 'done'; }
    const em = lower(contact?.email || enr.email);
    if (!contact || blocked.has(em) || ['bounced', 'unsubscribed', 'invalid', 'replied'].includes(contact.status)) {
      await sr.CampaignEnrollment.update(enr.id, { status: contact?.status === 'unsubscribed' ? 'stopped_unsubscribed' : contact?.status === 'replied' ? 'stopped_replied' : contact?.status === 'bounced' ? 'stopped_bounced' : 'stopped_manual' });
      summary.stopped++; return 'skip';
    }
    const sender = pickSender(enr);
    if (!sender) return 'nocap';
    if (budget.left <= 0) return 'nocap';
    const subject = mergeFields(step.subject, contact).trim() || '(brez zadeve)';
    const richBody = hasHtml(step.body_html) ? emailifyHtml(mergeFields(step.body_html, contact)) : null;
    const bodyText = richBody ? htmlToText(richBody) : mergeFields(step.body, contact).trim();
    // Podpis: najprej podpis predala (HTML, lahko z logotipom), sicer podpis podjetja.
    const sigHtml = hasHtml(sender.mb.signature_html) ? emailifyHtml(sender.mb.signature_html) : null;
    const sigText = sigHtml ? htmlToText(sigHtml) : signature;
    const files = step.attachments?.length ? (attachCache[`${camp.id}:${idx}`] ||= await fetchAttachments(step.attachments)) : [];
    const unsubUrl = `${APP_URL}/api/apps/${APP_ID}/functions/unsubscribe?c=${encodeURIComponent(contact.id)}&t=${await hmac('c:' + contact.id)}`;
    const footer = `Če teh sporočil ne želite več prejemati, odgovorite z besedo »Odjava« ali kliknite: ${unsubUrl}`;
    const text = `${bodyText}\n\n${sigText}\n\n--\n${footer}`;
    const html = `<!doctype html><html lang="sl"><head><meta charset="utf-8"></head><body style="margin:0;padding:12px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111">${richBody || textToHtml(bodyText)}<div style="margin-top:16px">${sigHtml || textToHtml(sigText)}</div><p style="margin:18px 0 0;font-size:12px;color:#777">Če teh sporočil ne želite več prejemati, odgovorite z besedo »Odjava« ali se <a href="${esc(unsubUrl)}" style="color:#777">odjavite tukaj</a>.</p></body></html>`;
    const domain = sender.mb.email.split('@')[1];
    const messageId = `<cmp-${enr.id}-${idx + 1}-${crypto.randomUUID().slice(0, 8)}@${domain}>`;
    const headers = { 'List-Unsubscribe': `<mailto:${sender.mb.email}?subject=Odjava>, <${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
    try {
      budget.left--;
      await sender.send({ to: contact.email, subject, text, html, messageId, headers, attachments: files });
    } catch (err) {
      const code = Number(err?.responseCode) || 0;
      const msg = String(err?.response || err?.message || err).slice(0, 200);
      if (err?.code === 'EENVELOPE' || (code >= 550 && code < 560)) { // strežnik je naslov zavrnil takoj
        const at = new Date().toISOString();
        const reason = `Naslov ne obstaja (strežnik ga je zavrnil: ${msg})`.slice(0, 300);
        await sr.CampaignEnrollment.update(enr.id, { status: 'stopped_bounced', bounce_reason: reason, bounced_at: at, last_sent_at: at, mailbox_id: sender.mb.id });
        Object.assign(enr, { status: 'stopped_bounced', bounced_at: at, last_sent_at: at, bounce_reason: reason });
        await sr.ListContact.update(contact.id, { status: 'bounced', bounce_reason: reason, bounced_at: at });
        blocked.add(em); newBounces++; summary.bounced_now++;
        return 'bounced';
      }
      sender.dead = msg;
      const auth = err?.code === 'EAUTH' || code === 535;
      await sr.SendingMailbox.update(sender.mb.id, { last_error: auth ? 'Prijava za pošiljanje ni uspela. Preverite geslo predala.' : `Pošiljanje ni uspelo: ${msg}`, ...(auth ? { status: 'error' } : {}) });
      summary.errors.push(`${sender.mb.email}: ${msg}`);
      return 'error';
    }
    const at = new Date().toISOString();
    const next = steps[idx + 1];
    const patch = next
      ? { current_step: idx + 1, last_sent_at: at, mailbox_id: sender.mb.id, last_message_id: messageId, next_send_at: new Date(Date.now() + (Number(next.delay_days) || 0) * DAY).toISOString() }
      : { current_step: idx + 1, last_sent_at: at, mailbox_id: sender.mb.id, last_message_id: messageId, status: 'completed' };
    await sr.CampaignEnrollment.update(enr.id, patch);
    Object.assign(enr, patch);
    summary.sent++;
    if (!next) summary.completed++;
    if (business.subscription_status === 'trialing') {
      business.trial_sends_remaining = Math.max(0, (business.trial_sends_remaining ?? 20) - 1);
      await sr.Business.update(business.id, { trial_sends_remaining: business.trial_sends_remaining });
    }
    await sleep(1500 + Math.floor(Math.random() * 3000));
    return 'sent';
  };

  const trialStop = () => business.subscription_status === 'trialing' && (business.trial_sends_remaining ?? 20) <= 0;
  for (const e of due) {
    if (camp.status !== 'active' || trialStop() || budget.left <= 0) break;
    const r = await sendTo(e, contactById[e.contact_id]);
    if (r === 'bounced') {
      if (await pauseIfTooManyBounces({ sr, sendEmail: (o) => base44.asServiceRole.integrations.Core.SendEmail(o), business, camp, enrollments, emailOf: (x) => x.email, newCount: newBounces, appUrl: APP_URL })) return;
    }
  }
  for (const c of fresh) {
    if (camp.status !== 'active' || trialStop() || budget.left <= 0) break;
    if (!mySenders.some((s) => s.capacity > 0)) break;
    const first = Number(steps[0]?.delay_days) || 0;
    const enr = await sr.CampaignEnrollment.create({ business_id: camp.business_id, owner_email: owner, created_by: owner, campaign_id: camp.id, contact_id: c.id, email: lower(c.email), current_step: 0, status: 'active', next_send_at: new Date(now + first * DAY).toISOString() });
    enrollments.push(enr); summary.enrolled++;
    if (first > 0) continue; // prvo sporočilo šele čez nekaj dni
    const r = await sendTo(enr, c);
    if (r === 'nocap' || r === 'error') break;
    if (r === 'bounced' && await pauseIfTooManyBounces({ sr, sendEmail: (o) => base44.asServiceRole.integrations.Core.SendEmail(o), business, camp, enrollments, emailOf: (x) => x.email, newCount: newBounces, appUrl: APP_URL })) return;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const internal = !!INTERNAL_SECRET && body?.internal_secret === INTERNAL_SECRET;
    const user = internal ? null : await base44.auth.me().catch(() => null);
    const sr = base44.asServiceRole.entities;

    let campaigns;
    if (body.business_id) {
      const biz = (await sr.Business.filter({ id: body.business_id }))[0];
      if (!biz) return Response.json({ error: 'Podjetje ni najdeno.' });
      const owns = internal || user?.role === 'admin' || (user && (biz.created_by_id === user.id || biz.created_by === user.email || biz.owner_email === user.email));
      if (!owns) return Response.json({ error: 'Nimate dostopa.' });
      campaigns = await sr.Campaign.filter({ business_id: biz.id, status: 'active' });
    } else {
      if (!internal && user?.role !== 'admin') return Response.json({ error: 'Ni dovoljenja.' });
      campaigns = await sr.Campaign.filter({ status: 'active' });
    }

    const now = Date.now();
    const t0 = Date.now();
    const summary = { version: VERSION, campaigns: campaigns.length, enrolled: 0, drafts: 0, sent: 0, bounced_now: 0, completed: 0, stopped: 0, errors: [], mailbox_sync: null };
    if (!campaigns.length) return Response.json({ success: true, ...summary });

    // 1) Najprej odbita sporočila in odgovori iz kampanjskih predalov (da ne pišemo neobstoječim naslovom).
    if (campaigns.some((c) => (c.mailbox_ids || []).length)) {
      const r = await withTimeout(syncCampaignMailboxesFor(base44, { businessId: body.business_id }).then((x) => ({ results: x })).catch((e) => ({ error: e?.message })), 90000);
      summary.mailbox_sync = r?.timeout ? 'timeout' : (r?.error || (r.results || []).map((x) => `${x.bounces || 0} vrnjenih, ${x.replies || 0} odgovorov${x.error ? ', ' + x.error : ''}`).join('; ') || 'ok');
      summary.ms_sync = Date.now() - t0;
      campaigns = (await Promise.all(campaigns.map((c) => sr.Campaign.filter({ id: c.id }).then((x) => x[0])))).filter((c) => c && c.status === 'active');
    }

    let aiUsed = 0;
    const bizCache = {};
    const senderCache = {}; // business_id → { mailbox_id: MailboxSender }
    const blockedCache = {};
    const budget = { left: MAX_LIST_SENDS_PER_RUN };
    const windowOpen = inSendWindow();

    for (const camp of campaigns) {
      if (camp.is_demo) continue;
      const steps = Array.isArray(camp.steps) ? camp.steps : [];
      if (!steps.length) continue;
      const business = bizCache[camp.business_id] || (bizCache[camp.business_id] = (await sr.Business.filter({ id: camp.business_id }))[0]);
      if (!business) continue;
      const owner = business.owner_email || business.created_by;
      if (!senderCache[camp.business_id]) {
        const mbs = await Promise.all((await sr.SendingMailbox.filter({ business_id: camp.business_id })).map(openMailbox)); // gesla samo v pomnilniku
        senderCache[camp.business_id] = Object.fromEntries(mbs.filter((m) => m.status !== 'error' && m.smtp_host && m.smtp_pass).map((m) => [m.id, new MailboxSender(sr, m)]));
      }
      const senders = senderCache[camp.business_id];

      // ---- kampanja iz seznama naslovov ----
      if (camp.source === 'list') {
        if (!windowOpen || !canSendCampaigns(business)) continue;
        if (!blockedCache[camp.business_id]) {
          const [cs, ls] = await Promise.all([allRecords(sr.ListContact, { business_id: camp.business_id }), allRecords(sr.Lead, { business_id: camp.business_id })]);
          const b = new Set();
          for (const c of cs) if (['bounced', 'unsubscribed', 'invalid', 'replied'].includes(c.status)) b.add(lower(c.email));
          for (const l of ls) if (l.email) b.add(lower(l.email)); // obstoječim strankam ne pošiljamo hladnih sporočil
          blockedCache[camp.business_id] = b;
        }
        try { await runListCampaign({ base44, sr, camp, business, senders, blocked: blockedCache[camp.business_id], summary, budget }); }
        catch (err) { summary.errors.push(`${camp.name}: ${err?.message || err}`); }
      } else {
        // ---- kampanja za vaše stranke ----
        const [leads, enrollments] = await Promise.all([
          allRecords(sr.Lead, { business_id: camp.business_id }),
          allRecords(sr.CampaignEnrollment, { business_id: camp.business_id, campaign_id: camp.id }),
        ]);
        const leadsById = Object.fromEntries(leads.map((l) => [l.id, l]));
        const campSenders = (camp.mailbox_ids || []).map((id) => senders[id]).filter(Boolean);

        if (camp.audience?.auto_enroll) {
          const enrolled = new Set(enrollments.map((e) => e.lead_id));
          for (const l of leads) {
            if (l.is_demo || enrolled.has(l.id) || !matchAudience(l, camp.audience)) continue;
            const e = await sr.CampaignEnrollment.create({ business_id: camp.business_id, owner_email: owner, created_by: owner, campaign_id: camp.id, lead_id: l.id, email: lower(l.email), current_step: 0, status: 'active', next_send_at: new Date(now + (Number(steps[0].delay_days) || 0) * DAY).toISOString() });
            enrollments.push(e); summary.enrolled++;
          }
        }

        const due = enrollments.filter((e) => e.status === 'active' && e.lead_id && (!e.next_send_at || new Date(e.next_send_at).getTime() <= now));
        for (const e of due) {
          const lead = leadsById[e.lead_id];
          if (!lead || lead.status === 'unsubscribed' || !lead.email || lead.consent_email === false || lead.email_bounced) {
            await sr.CampaignEnrollment.update(e.id, { status: lead?.status === 'unsubscribed' ? 'stopped_unsubscribed' : lead?.email_bounced ? 'stopped_bounced' : 'stopped_manual' });
            summary.stopped++; continue;
          }
          if (lead.last_inbound_at && new Date(lead.last_inbound_at) > new Date(e.created_date)) {
            await sr.CampaignEnrollment.update(e.id, { status: 'stopped_replied' });
            summary.stopped++; continue;
          }
          const idx = Number(e.current_step) || 0;
          const step = steps[idx];
          if (!step) { await sr.CampaignEnrollment.update(e.id, { status: 'completed' }); summary.completed++; continue; }

          // Ločen predal: ista oseba vedno z istega predala, upoštevaj dnevno mejo.
          let mailboxId = null;
          if (campSenders.length) {
            const s = e.mailbox_id ? senders[e.mailbox_id] : campSenders.filter((x) => x.capacity > 0).sort((a, b) => b.capacity - a.capacity)[0];
            if (!s || s.capacity <= 0 || !windowOpen) continue; // danes ni več prostora ali izven delovnega časa
            s.sentRun++; // rezerviraj mesto (pošlje sendApprovedDraft)
            mailboxId = s.mb.id;
          }

          let ok = false;
          let created = null;
          if (step.ai_personalize && aiUsed < MAX_AI_PER_RUN) {
            aiUsed++;
            try {
              const res = await base44.asServiceRole.functions.invoke('generateDraft', {
                internal_secret: INTERNAL_SECRET, business_id: camp.business_id, lead_id: lead.id, pillar: 'campaign',
                template: { subject: step.subject, body: step.body }, campaign_id: camp.id, campaign_step: idx + 1, sequence_step: idx + 1,
              });
              const d = res?.data ?? res;
              if (d?.error) throw new Error(d.error);
              ok = !!d?.draft;
              created = d?.draft || null;
            } catch (err) {
              summary.errors.push(`${camp.name}/${lead.name}: ${err?.response?.data?.error || err?.message || err}`);
            }
          } else if (step.ai_personalize) {
            continue; // limit AI za ta zagon dosežen — naslednjič
          }
          if (!ok && !step.ai_personalize) {
            const fn = firstName(lead.name);
            const greet = fn ? `Pozdravljeni, ${fn},` : 'Pozdravljeni,';
            const bodyHtml = hasHtml(step.body_html) ? emailifyHtml(String(step.body_html).replace(/(^|<p[^>]*>)Spoštovani,/m, `$1${greet}`)) : '';
            const bodyText = bodyHtml ? htmlToText(bodyHtml) : String(step.body || '').replace(/^Spoštovani,/m, greet);
            created = await sr.DraftMessage.create({
              business_id: camp.business_id, lead_id: lead.id, pillar: 'campaign', channel: 'email', subject: step.subject, body: bodyText,
              ...(bodyHtml ? { body_html: bodyHtml } : {}), ...(step.attachments?.length ? { attachments: step.attachments } : {}),
              status: 'pending', quality_score: 8, campaign_id: camp.id, campaign_step: idx + 1, scheduled_at: new Date().toISOString(),
              ...(mailboxId ? { mailbox_id: mailboxId } : {}),
              ai_reasoning: `Kampanja »${camp.name}«, sporočilo ${idx + 1} od ${steps.length}.`, created_by: business.created_by, owner_email: owner,
            });
            ok = true;
          }
          if (!ok) continue;
          if (created?.id && ((mailboxId && !created.mailbox_id) || (step.attachments?.length && !created.attachments?.length))) {
            await sr.DraftMessage.update(created.id, { ...(mailboxId ? { mailbox_id: mailboxId } : {}), ...(step.attachments?.length ? { attachments: step.attachments } : {}) }).catch(() => null);
          }
          // Samodejno pošiljanje: odobri tukaj (sprememba v »approved« sproži »Send Email on Draft Approved«).
          if (created?.id && camp.auto_send && business.subscription_status !== 'trialing') {
            try {
              const fresh = (await sr.DraftMessage.filter({ id: created.id }))[0];
              if (fresh && fresh.status === 'pending' && (fresh.quality_score ?? 7) >= 7) {
                await sr.DraftMessage.update(fresh.id, { status: 'approved', reviewer_notes: `${fresh.reviewer_notes ? fresh.reviewer_notes + ' ' : ''}Samodejno poslano (kampanja).` });
              }
            } catch (err) { summary.errors.push(`auto_send ${lead.name}: ${err?.message || err}`); }
          }
          summary.drafts++;
          const next = steps[idx + 1];
          await sr.CampaignEnrollment.update(e.id, {
            ...(next ? { current_step: idx + 1, next_send_at: new Date(now + (Number(next.delay_days) || 0) * DAY).toISOString() } : { current_step: idx + 1, status: 'completed' }),
            last_sent_at: new Date().toISOString(), ...(mailboxId ? { mailbox_id: mailboxId } : {}),
          });
          if (!next) summary.completed++;
        }
      }

      const fresh = await allRecords(sr.CampaignEnrollment, { business_id: camp.business_id, campaign_id: camp.id });
      const by = (s) => fresh.filter((x) => x.status === s).length;
      await sr.Campaign.update(camp.id, {
        last_run_at: new Date().toISOString(),
        stats: { enrolled: fresh.length, active: by('active'), replied: by('stopped_replied'), completed: by('completed'), bounced: by('stopped_bounced'), unsubscribed: by('stopped_unsubscribed'), sent: fresh.reduce((s, x) => s + (Number(x.current_step) || 0), 0) },
      });
    }

    for (const m of Object.values(senderCache)) for (const s of Object.values(m)) await s.close();
    summary.ms_total = Date.now() - t0;
    console.log('runCampaigns', JSON.stringify(summary).slice(0, 1500));
    return Response.json({ success: true, ...summary });
  } catch (error) {
    return Response.json({ error: 'runCampaigns: ' + (error?.message || String(error)), version: VERSION });
  }
});
