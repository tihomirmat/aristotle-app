import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import nodemailer from 'npm:nodemailer@6.9.9';

// ─── HTML predloga e-pošte (kopija v vsaki funkciji — Base44 funkcije nimajo skupnih modulov) ───
const EMAIL_APP_URL = (Deno.env.get('APP_URL') || 'https://aristotle-smart-growth.base44.app').replace(/\/$/, '');
const EMAIL_FOOTER_COMPANY = Deno.env.get('EMAIL_FOOTER_COMPANY') || 'AI Aristotle';
const EMAIL_FOOTER_ADDRESS = Deno.env.get('EMAIL_FOOTER_ADDRESS') || '';
const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const linkify = (s) => s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#4f46e5;text-decoration:underline">$1</a>');
// Navadno besedilo → HTML odstavki (prazna vrstica = nov odstavek; vrstice, ki se začnejo z •, - ali –, = seznam)
const textToHtml = (text) => String(text ?? '').replace(/\r/g, '').trim().split(/\n{2,}/).map((block) => {
  const lines = block.split('\n');
  if (lines.length && lines.every((l) => /^\s*[•\-–]\s+/.test(l))) {
    return '<ul style="margin:0 0 16px;padding-left:20px">' + lines.map((l) => '<li style="margin:0 0 4px">' + linkify(escHtml(l.replace(/^\s*[•\-–]\s+/, ''))) + '</li>').join('') + '</ul>';
  }
  return '<p style="margin:0 0 16px">' + linkify(escHtml(block)).replace(/\n/g, '<br>') + '</p>';
}).join('');
const emailButton = (label, url) => `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 20px"><tr><td style="background:#4f46e5;border-radius:8px"><a href="${escHtml(url)}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-weight:600;text-decoration:none;font-size:15px">${escHtml(label)}</a></td></tr></table>`;
// Dvostolpčna tabela (oznaka → vrednost; vrednost je že HTML)
const emailRows = (rows) => '<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin:0 0 16px;border:1px solid #e5e7eb;border-radius:8px;border-collapse:separate">' + rows.map(([k, v], i) => `<tr style="background:${i % 2 ? '#ffffff' : '#f9fafb'}"><td style="padding:9px 12px;font-size:13px;color:#6b7280;width:40%;vertical-align:top">${escHtml(k)}</td><td style="padding:9px 12px;font-size:14px;color:#111827;font-weight:500">${v}</td></tr>`).join('') + '</table>';
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


// ─── Skupna avtorizacija / entitlements (kopija v vsaki funkciji — Base44 funkcije nimajo skupnih modulov) ───
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
// Enako kot src/lib/entitlements.js: aktiven trial odpre vse module, sicer mora biti pillar_* = true
const hasModule = (b, pillarKey) => !!b && (isTrialActive(b) || b[pillarKey] === true);

const APP_ID = '69fb8760fa0b118b8a291e26';
const APP_URL = (Deno.env.get('APP_URL') || 'https://aristotle-smart-growth.base44.app').replace(/\/$/, '');

// Podpisan odjavni žeton: HMAC-SHA256(INTERNAL_FUNCTION_SECRET, lead.id) — preverja ga funkcija `unsubscribe`
async function unsubscribeToken(leadId) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(INTERNAL_SECRET || 'no-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(leadId));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// Sends an approved DraftMessage to the lead via the business's configured email provider.
// Triggered by entity automation on DraftMessage update → status = "approved"
// Can also be called directly with { draft_id }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Support both direct call ({ draft_id }) and entity automation payload ({ data: { id, ... } })
    const draftId = body.draft_id || body.data?.id;
    if (!draftId) {
      return Response.json({ error: 'draft_id is required' }, { status: 400 });
    }

    // Avtentikacija: interni klic (secret) | workflow payload ({ data }) | prijavljen lastnik podjetja.
    // Workflow klica ne moremo kriptografsko preveriti, zato spodaj še preverjamo, da osnutek res izvira od lastnika/backend-a.
    const internal = isInternalCall(body);
    const isWorkflowPayload = !!body.data?.id && !body.draft_id;
    let user = null;
    if (!internal) {
      user = await base44.auth.me().catch(() => null);
      if (!user && !isWorkflowPayload) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch draft
    const drafts = await base44.asServiceRole.entities.DraftMessage.filter({ id: draftId });
    const draft = drafts[0];
    if (!draft) return Response.json({ error: 'Draft not found' }, { status: 404 });

    // Only send approved drafts
    if (draft.status !== 'approved') {
      return Response.json({ skipped: true, reason: `status is ${draft.status}` });
    }

    // Fetch lead + business in parallel
    const [leads, businesses] = await Promise.all([
      base44.asServiceRole.entities.Lead.filter({ id: draft.lead_id }),
      base44.asServiceRole.entities.Business.filter({ id: draft.business_id }),
    ]);
    const lead = leads[0];
    const business = businesses[0];

    if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 });
    if (!business) return Response.json({ error: 'Business not found' }, { status: 404 });

    // ─── AVTORIZACIJA / KONSISTENTNOST NAJEMNIKA (zaščita pred odprtim e-mail relayem) ───
    if (user && !ownsBusiness(user, business)) {
      return Response.json({ error: 'Nimate dostopa do tega podjetja.', code: 'FORBIDDEN' }, { status: 403 });
    }
    if (lead.business_id !== draft.business_id) {
      await base44.asServiceRole.entities.DraftMessage.update(draftId, { status: 'failed', reviewer_notes: 'Varnostna zavrnitev: stranka ne pripada podjetju osnutka.' });
      return Response.json({ error: 'Lead/business mismatch', code: 'FORBIDDEN' }, { status: 403 });
    }
    // Osnutek mora ustvariti lastnik podjetja, admin-backend (service role) ali biti ustvarjen prek generateDraft.
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
    // Modul mora biti aktiven (trial ali kupljen) — pošiljanje je plačljiva funkcija
    const PILLAR_MODULE = { reactivation: 'pillar_reactivation', review_request: 'pillar_reviews', referral_ask: 'pillar_reviews', web_form_lead: 'pillar_leads', chatbot_handoff: 'pillar_leads', booking_proposal: 'pillar_leads' };
    if (isTrialExpired(business) || !hasModule(business, PILLAR_MODULE[draft.pillar] || 'pillar_reactivation')) {
      await base44.asServiceRole.entities.DraftMessage.update(draftId, { status: 'failed', reviewer_notes: 'Modul ni aktiven (preizkus končan ali modul ni kupljen). Aktivirajte naročnino v Nastavitve → Naročnina.' });
      return Response.json({ skipped: true, reason: 'module_locked', code: 'MODULE_LOCKED', error: 'Modul ni aktiven. Aktivirajte naročnino za nadaljevanje.' }, { status: 402 });
    }

    // ─── Guardrails ───────────────────────────────────────────────────────────
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

    // ─── Trial send limit ─────────────────────────────────────────────────────
    if (business.subscription_status === 'trialing') {
      const remaining = business.trial_sends_remaining ?? 20;
      if (remaining <= 0) {
        await base44.asServiceRole.entities.DraftMessage.update(draftId, { status: 'failed', reviewer_notes: 'Dosegli ste mejo poslanih sporočil v preizkusu (20). Aktivirajte naročnino za nadaljevanje.' });
        return Response.json({
          skipped: true,
          reason: 'trial_sends_exhausted',
          code: 'TRIAL_SENDS_EXHAUSTED',
          error: 'Dosegli ste mejo poslanih sporočil v preizkusu (20). Aktivirajte naročnino za nadaljevanje.',
        }, { status: 402 });
      }
      // NOTE: decrement happens after a successful send (see below), per Faza 5 spec.
    }

    // ─── Build email body (add signature + unsubscribe footer) ────────────────
    const signature = business.email_signature ? `\n\n${business.email_signature}` : `\n\nLep pozdrav,\n${business.name}`;
    const unsubUrl = `${APP_URL}/api/apps/${APP_ID}/functions/unsubscribe?lead=${encodeURIComponent(lead.id)}&t=${await unsubscribeToken(lead.id)}`;
    const footer = `\n\n---\nČe teh sporočil ne želite več prejemati, se lahko odjavite tukaj: ${unsubUrl}\nali odgovorite na to sporočilo z besedo »Odjava«.`;
    const fullBody = (draft.body || '') + signature + footer;
    // HTML različica: glava s podjetjem, besedilo osnutka kot odstavki, odjavna povezava v nogi
    const fullHtml = emailHtml({
      brand: business.name,
      brandSub: business.phone ? String(business.phone) : '',
      title: '',
      bodyHtml: textToHtml((draft.body || '') + signature),
      footerNote: `Če teh sporočil ne želite več prejemati, se lahko <a href="${escHtml(unsubUrl)}" style="color:#6b7280">odjavite tukaj</a> ali odgovorite na to sporočilo z besedo »Odjava«.`,
    });

    // ─── Send via configured provider ────────────────────────────────────────
    // SMTP samo, če je konfiguracija POPOLNA (prej se je pri pol-nastavljenem SMTP osnutek označil kot poslan brez pošiljanja).
    // Nepopoln SMTP ali Gmail/Outlook (OAuth pošiljanje še ni implementirano) → platformski pošiljatelj (Base44 SendEmail),
    // z opombo na osnutku, da lastnik ve, prek česa je šlo sporočilo.
    let sendError = null;
    let sentVia = 'platform';
    let sendNote = '';
    const smtpComplete = !!(business.smtp_host && business.smtp_user && business.smtp_pass);

    if (business.email_provider === 'smtp' && !smtpComplete) {
      sendNote = 'SMTP ni v celoti nastavljen (strežnik, uporabnik, geslo) — poslano prek platformskega pošiljatelja. Dopolnite Nastavitve → Integracije.';
    }

    if (business.email_provider === 'smtp' && smtpComplete) {
      sentVia = 'smtp';
      const transporter = nodemailer.createTransport({
        host: business.smtp_host,
        port: Number(business.smtp_port) || 587,
        secure: business.smtp_encryption === 'ssl_tls',
        requireTLS: business.smtp_encryption === 'starttls',
        auth: { user: business.smtp_user, pass: business.smtp_pass },
      });
      await transporter.sendMail({
        from: `"${(business.smtp_from_name || business.name).replace(/"/g, '')}" <${business.smtp_from_email || business.smtp_user}>`,
        to: lead.email,
        subject: draft.subject || '(brez zadeve)',
        text: fullBody,
        html: fullHtml,
      }).catch(e => { sendError = e.message; return null; });
    } else {
      // Platform SendEmail (tudi za gmail/outlook, dokler OAuth pošiljanje ni implementirano)
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: lead.email,
          subject: draft.subject || '(brez zadeve)',
          body: fullHtml,
          from_name: business.name,
        });
      } catch (e) {
        sendError = e.message || 'Platformsko pošiljanje ni uspelo';
      }
    }

    if (sendError) {
      await base44.asServiceRole.entities.DraftMessage.update(draftId, {
        status: 'failed',
        reviewer_notes: `Send error: ${sendError}`,
      });
      await base44.asServiceRole.entities.UsageLog.create({
        business_id: business.id,
        date: new Date().toISOString().split('T')[0],
        pillar: draft.pillar,
        feature: 'email_send',
        subfeature: 'failed',
        model: 'none',
        input_tokens: 0,
        output_tokens: 0,
        cost_eur: 0,
        is_demo: draft.is_demo || false,
      });
      return Response.json({ success: false, error: sendError }, { status: 500 });
    }

    // ─── Mark sent ────────────────────────────────────────────────────────────
    const now = new Date().toISOString();
    // Decrement trial send counter only on successful send
    if (business.subscription_status === 'trialing') {
      await base44.asServiceRole.entities.Business.update(business.id, {
        trial_sends_remaining: Math.max(0, (business.trial_sends_remaining ?? 20) - 1),
      });
    }
    await Promise.all([
      base44.asServiceRole.entities.DraftMessage.update(draftId, {
        status: 'sent',
        sent_at: now,
        ...(sendNote ? { reviewer_notes: `Poslano (${sentVia}). ${sendNote}` } : {}),
      }),
      base44.asServiceRole.entities.Lead.update(lead.id, {
        last_contacted_at: now,
        status: lead.status === 'new' ? 'contacted' : lead.status,
      }),
      base44.asServiceRole.entities.UsageLog.create({
        business_id: business.id,
        date: now.split('T')[0],
        pillar: draft.pillar,
        feature: 'email_send',
        subfeature: 'sent',
        model: 'none',
        input_tokens: 0,
        output_tokens: 0,
        cost_eur: 0,
        is_demo: draft.is_demo || false,
      }),
    ]);

    return Response.json({ success: true, draft_id: draftId, sent_to: lead.email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});