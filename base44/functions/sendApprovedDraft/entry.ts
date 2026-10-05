import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import nodemailer from 'npm:nodemailer@6.9.9';
import { ImapFlow } from 'npm:imapflow@1.0.164';

const EMAIL_APP_URL = (Deno.env.get('APP_URL') || 'https://aristotle-smart-growth.base44.app').replace(/\/$/, '');
const EMAIL_FOOTER_COMPANY = Deno.env.get('EMAIL_FOOTER_COMPANY') || 'AI Aristotle';
const EMAIL_FOOTER_ADDRESS = Deno.env.get('EMAIL_FOOTER_ADDRESS') || '';
const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const linkify = (s) => s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#4f46e5;text-decoration:underline">$1</a>');
const textToHtml = (text) => String(text ?? '').replace(/\r/g, '').trim().split(/\n{2,}/).map((block) => {
  const lines = block.split('\n');
  if (lines.length && lines.every((l) => /^\s*[•\-–]\s+/.test(l))) {
    return '<ul style="margin:0 0 16px;padding-left:20px">' + lines.map((l) => '<li style="margin:0 0 4px">' + linkify(escHtml(l.replace(/^\s*[•\-–]\s+/, ''))) + '</li>').join('') + '</ul>';
  }
  return '<p style="margin:0 0 16px">' + linkify(escHtml(block)).replace(/\n/g, '<br>') + '</p>';
}).join('');
const emailButton = (label, url) => `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 20px"><tr><td style="background:#4f46e5;border-radius:8px"><a href="${escHtml(url)}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-weight:600;text-decoration:none;font-size:15px">${escHtml(label)}</a></td></tr></table>`;
const emailHtml = ({ brand = 'AI Aristotle', brandSub = '', title = '', bodyHtml = '', cta = null, footerNote = '' }) => `<!doctype html><html lang="sl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(title || brand)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%">
<tr><td style="padding:0 4px 14px"><table role="presentation" cellspacing="0" cellpadding="0"><tr>
<td style="width:36px;height:36px;background:#4f46e5;border-radius:10px;text-align:center;vertical-align:middle;color:#ffffff;font-weight:700;font-size:18px;line-height:36px">${escHtml(String(brand).trim().charAt(0).toUpperCase() || 'A')}</td>
<td style="padding-left:10px;font-weight:700;font-size:17px;color:#111827">${escHtml(brand)}${brandSub ? `<div style="font-weight:400;font-size:12px;color:#6b7280">${escHtml(brandSub)}</div>` : ''}</td>
</tr></table></td></tr>
<tr><td style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px 28px 16px;font-size:15px;line-height:1.55">
${title ? `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#111827">${escHtml(title)}</h1>` : ''}
${bodyHtml}
${cta ? emailButton(cta.label, cta.url) : ''}
</td></tr>
<tr><td style="padding:16px 8px 0;font-size:12px;line-height:1.5;color:#6b7280;text-align:center">
${escHtml(EMAIL_FOOTER_COMPANY)}${EMAIL_FOOTER_ADDRESS ? ' · ' + escHtml(EMAIL_FOOTER_ADDRESS) : ''} · <a href="${EMAIL_APP_URL}" style="color:#6b7280">${escHtml(EMAIL_APP_URL.replace(/^https?:\/\//, ''))}</a>
${footerNote ? `<div style="margin-top:6px">${footerNote}</div>` : ''}
</td></tr>
</table></td></tr></table></body></html>`;

const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') || '';
const isInternalCall = (body) => !!INTERNAL_SECRET && body?.internal_secret === INTERNAL_SECRET;
const ownsBusiness = (user, business) => {
  if (!user || !business) return false;
  if (user.role === 'admin') return true;
  return business.created_by_id === user.id
    || (!!user.email && business.created_by === user.email)
    || (!!user.email && !!business.owner_email && business.owner_email === user.email);
};
const isTrialActive = (b) => b?.subscription_status === 'trialing' && !!b.trial_ends_at && new Date(b.trial_ends_at) > new Date();
const isTrialExpired = (b) => b?.subscription_status === 'trialing' && !!b.trial_ends_at && new Date(b.trial_ends_at) <= new Date();
const hasModule = (b, pillarKey) => !!b && (isTrialActive(b) || b[pillarKey] === true);

const APP_ID = '69fb8760fa0b118b8a291e26';
const APP_URL = (Deno.env.get('APP_URL') || 'https://aristotle-smart-growth.base44.app').replace(/\/$/, '');

async function unsubscribeToken(leadId) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(INTERNAL_SECRET || 'no-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(leadId));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const draftId = body.draft_id || body.data?.id;
    if (!draftId) {
      return Response.json({ error: 'draft_id is required' }, { status: 400 });
    }
    const internal = isInternalCall(body);
    const isWorkflowPayload = !!body.data?.id && !body.draft_id;
    let user = null;
    if (!internal) {
      user = await base44.auth.me().catch(() => null);
      if (!user && !isWorkflowPayload) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const drafts = await base44.asServiceRole.entities.DraftMessage.filter({ id: draftId });
    const draft = drafts[0];
    if (!draft) return Response.json({ error: 'Draft not found' }, { status: 404 });
    if (draft.status !== 'approved') {
      return Response.json({ skipped: true, reason: `status is ${draft.status}` });
    }

    const [leads, businesses] = await Promise.all([
      base44.asServiceRole.entities.Lead.filter({ id: draft.lead_id }),
      base44.asServiceRole.entities.Business.filter({ id: draft.business_id }),
    ]);
    const lead = leads[0];
    const business = businesses[0];
    if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 });
    if (!business) return Response.json({ error: 'Business not found' }, { status: 404 });

    if (user && !ownsBusiness(user, business)) {
      return Response.json({ error: 'Nimate dostopa do tega podjetja.', code: 'FORBIDDEN' }, { status: 403 });
    }
    // Testni (demo) podatki: nikoli ne pošiljamo zares, tok pa se obnaša kot pri pravem pošiljanju.
    if (lead.is_demo || draft.is_demo) {
      const nowDemo = new Date().toISOString();
      await base44.asServiceRole.entities.DraftMessage.update(draftId, { status: 'sent', sent_at: nowDemo, reviewer_notes: 'Testni podatki: sporočilo ni bilo zares poslano.' });
      await base44.asServiceRole.entities.Lead.update(lead.id, { last_contacted_at: nowDemo, status: lead.status === 'new' ? 'contacted' : lead.status });
      return Response.json({ success: true, demo: true, draft_id: draftId });
    }
    if (lead.business_id !== draft.business_id) {
      await base44.asServiceRole.entities.DraftMessage.update(draftId, { status: 'failed', reviewer_notes: 'Varnostna zavrnitev: stranka ne pripada podjetju osnutka.' });
      return Response.json({ error: 'Lead/business mismatch', code: 'FORBIDDEN' }, { status: 403 });
    }
    const draftCreator = String(draft.created_by || '');
    const draftCreatorId = String(draft.created_by_id || '');
    const trustedCreator = draftCreatorId.startsWith('service_') || draftCreator.startsWith('service+')
      || (!!business.created_by_id && draftCreatorId === business.created_by_id)
      || (!!business.created_by && draftCreator === business.created_by)
      || (!!business.owner_email && draftCreator === business.owner_email);
    if (!trustedCreator) {
      await base44.asServiceRole.entities.DraftMessage.update(draftId, { status: 'failed', reviewer_notes: 'Varnostna zavrnitev: osnutek ni bil ustvarjen s strani lastnika podjetja.' });
      return Response.json({ error: 'Draft origin not trusted', code: 'FORBIDDEN' }, { status: 403 });
    }
    const PILLAR_MODULE = { reactivation: 'pillar_reactivation', review_request: 'pillar_reviews', referral_ask: 'pillar_reviews', web_form_lead: 'pillar_leads', chatbot_handoff: 'pillar_leads', booking_proposal: 'pillar_leads', campaign: 'pillar_reactivation', manual: 'pillar_leads' };
    if (isTrialExpired(business) || !hasModule(business, PILLAR_MODULE[draft.pillar] || 'pillar_reactivation')) {
      await base44.asServiceRole.entities.DraftMessage.update(draftId, { status: 'failed', reviewer_notes: 'Modul ni aktiven (preizkus končan ali modul ni kupljen). Aktivirajte naročnino v Nastavitve → Naročnina.' });
      return Response.json({ skipped: true, reason: 'module_locked', code: 'MODULE_LOCKED', error: 'Modul ni aktiven. Aktivirajte naročnino za nadaljevanje.' }, { status: 402 });
    }

    if (!lead.email) {
      await base44.asServiceRole.entities.DraftMessage.update(draftId, { status: 'failed', reviewer_notes: 'Lead has no email address.' });
      return Response.json({ skipped: true, reason: 'no lead email' });
    }
    if (!lead.consent_email) {
      await base44.asServiceRole.entities.DraftMessage.update(draftId, { status: 'skipped', reviewer_notes: 'Lead did not consent to email.' });
      return Response.json({ skipped: true, reason: 'no consent_email' });
    }
    if (lead.status === 'unsubscribed') {
      await base44.asServiceRole.entities.DraftMessage.update(draftId, { status: 'skipped', reviewer_notes: 'Lead is unsubscribed.' });
      return Response.json({ skipped: true, reason: 'unsubscribed' });
    }

    if (business.subscription_status === 'trialing') {
      const remaining = business.trial_sends_remaining ?? 20;
      if (remaining <= 0) {
        await base44.asServiceRole.entities.DraftMessage.update(draftId, { status: 'failed', reviewer_notes: 'Dosegli ste mejo poslanih sporočil v preizkusu (20). Aktivirajte naročnino za nadaljevanje.' });
        return Response.json({ skipped: true, reason: 'trial_sends_exhausted', code: 'TRIAL_SENDS_EXHAUSTED', error: 'Dosegli ste mejo poslanih sporočil v preizkusu (20). Aktivirajte naročnino za nadaljevanje.' }, { status: 402 });
      }
    }

    const MARKETING = ['reactivation', 'review_request', 'referral_ask', 'campaign'].includes(draft.pillar);
    const threadReply = !MARKETING && lead.source === 'email' && !!lead.email_message_id;
    const signature = business.email_signature ? `\n\n${business.email_signature}` : `\n\nLep pozdrav,\n${business.name}`;
    const unsubUrl = `${APP_URL}/api/apps/${APP_ID}/functions/unsubscribe?lead=${encodeURIComponent(lead.id)}&t=${await unsubscribeToken(lead.id)}`;
    const footer = MARKETING ? `\n\n---\nČe teh sporočil ne želite več prejemati, se lahko odjavite tukaj: ${unsubUrl}\nali odgovorite na to sporočilo z besedo »Odjava«.` : '';
    const fullBody = (draft.body || '') + signature + footer;
    const personalHtml = `<!doctype html><html lang="sl"><head><meta charset="utf-8"></head><body style="margin:0;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#111827">${textToHtml((draft.body || '') + signature)}</body></html>`;
    const fullHtml = !MARKETING ? personalHtml : emailHtml({
      brand: business.name,
      brandSub: business.phone ? String(business.phone) : '',
      title: '',
      bodyHtml: textToHtml((draft.body || '') + signature),
      footerNote: `Če teh sporočil ne želite več prejemati, se lahko <a href="${escHtml(unsubUrl)}" style="color:#6b7280">odjavite tukaj</a> ali odgovorite na to sporočilo z besedo »Odjava«.`,
    });
    const origSubject = String(lead.email_subject || '').trim();
    const subject = threadReply && origSubject ? (/^(re|odg|odgovor)\s*:/i.test(origSubject) ? origSubject : `Re: ${origSubject}`) : (draft.subject || '(brez zadeve)');
    const threadHeaders = threadReply ? { inReplyTo: lead.email_message_id, references: [lead.email_message_id] } : {};

    let sendError = null;
    let sentVia = 'platform';
    let sendNote = '';
    const smtpComplete = !!(business.smtp_host && business.smtp_user && business.smtp_pass);
    if (business.email_provider === 'smtp' && !smtpComplete) {
      sendNote = 'Pošiljanje z vašega naslova ni v celoti nastavljeno — poslano prek AI Aristotle v vašem imenu.';
    }

    if (business.email_provider === 'smtp' && smtpComplete) {
      sentVia = 'smtp';
      const transporter = nodemailer.createTransport({
        host: business.smtp_host,
        port: Number(business.smtp_port) || 587,
        secure: business.smtp_encryption === 'ssl_tls' || Number(business.smtp_port) === 465,
        requireTLS: business.smtp_encryption === 'starttls',
        ignoreTLS: business.smtp_encryption === 'none',
        connectionTimeout: 15000,
        auth: { user: business.smtp_user, pass: business.smtp_pass },
      });
      const fromAddr = business.smtp_from_email || business.smtp_user;
      const mailOpts = {
        from: `"${(business.smtp_from_name || business.name).replace(/"/g, '')}" <${fromAddr}>`,
        to: lead.email,
        subject,
        text: fullBody,
        html: fullHtml,
        ...threadHeaders,
      };
      let raw = null;
      try {
        const composer = nodemailer.createTransport({ streamTransport: true, buffer: true });
        raw = (await composer.sendMail(mailOpts)).message;
      } catch { raw = null; }
      if (raw) {
        await transporter.sendMail({ envelope: { from: fromAddr, to: [lead.email] }, raw }).catch((e) => { sendError = e.message; return null; });
      } else {
        await transporter.sendMail(mailOpts).catch((e) => { sendError = e.message; return null; });
      }
      if (!sendError && raw && business.imap_enabled && business.imap_host && business.imap_user && business.imap_pass) {
        try {
          const c = new ImapFlow({ host: business.imap_host, port: Number(business.imap_port) || 993, secure: business.imap_secure !== false, auth: { user: business.imap_user, pass: business.imap_pass }, logger: false, connectionTimeout: 10000 });
          await c.connect();
          const boxes = await c.list();
          const sent = boxes.find((b) => b.specialUse === '\\Sent') || boxes.find((b) => /^(inbox[./])?(sent|sent items|sent messages|poslano|poslana pošta)$/i.test(b.path));
          if (sent) await c.append(sent.path, raw, ['\\Seen']);
          await c.logout();
        } catch { /* ignore */ }
      }
    } else {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({ to: lead.email, subject, body: fullHtml, from_name: business.name });
      } catch (e) {
        sendError = e.message || 'Platformsko pošiljanje ni uspelo';
      }
    }

    if (sendError) {
      await base44.asServiceRole.entities.DraftMessage.update(draftId, { status: 'failed', reviewer_notes: `Pošiljanje ni uspelo: ${sendError}` });
      await base44.asServiceRole.entities.UsageLog.create({ business_id: business.id, date: new Date().toISOString().split('T')[0], pillar: draft.pillar, feature: 'email_send', subfeature: 'failed', model: 'none', input_tokens: 0, output_tokens: 0, cost_eur: 0, is_demo: draft.is_demo || false });
      return Response.json({ success: false, error: sendError });
    }

    const now = new Date().toISOString();
    if (business.subscription_status === 'trialing') {
      await base44.asServiceRole.entities.Business.update(business.id, { trial_sends_remaining: Math.max(0, (business.trial_sends_remaining ?? 20) - 1) });
    }
    await Promise.all([
      base44.asServiceRole.entities.DraftMessage.update(draftId, { status: 'sent', sent_at: now, ...(sendNote ? { reviewer_notes: `Poslano (${sentVia}). ${sendNote}` } : {}) }),
      base44.asServiceRole.entities.Lead.update(lead.id, { last_contacted_at: now, status: lead.status === 'new' ? 'contacted' : lead.status }),
      base44.asServiceRole.entities.UsageLog.create({ business_id: business.id, date: now.split('T')[0], pillar: draft.pillar, feature: 'email_send', subfeature: 'sent', model: 'none', input_tokens: 0, output_tokens: 0, cost_eur: 0, is_demo: draft.is_demo || false }),
    ]);

    return Response.json({ success: true, draft_id: draftId, sent_to: lead.email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
