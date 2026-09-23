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


// Pošlje generirano ponudbo (PDF/DOCX) stranki po e-pošti.
// SMTP (če je v celoti nastavljen) → PDF kot priponka; sicer platformski pošiljatelj s povezavami za prenos.

// ─── Skupna avtorizacija / entitlements (kopija v vsaki funkciji — Base44 funkcije nimajo skupnih modulov) ───
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { business_id, generation_id } = body;
    const to = String(body.to_email || '').trim().toLowerCase();
    const subject = String(body.subject || '').trim().slice(0, 200);
    const message = String(body.message || '').trim().slice(0, 4000);
    if (!business_id || !generation_id || !to) return Response.json({ error: 'Manjkajoči parametri: business_id, generation_id, to_email' }, { status: 400 });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return Response.json({ error: 'Neveljaven e-poštni naslov prejemnika.' }, { status: 400 });

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: business_id });
    const business = businesses[0];
    if (!business) return Response.json({ error: 'Podjetje ni najdeno' }, { status: 404 });
    if (!ownsBusiness(user, business)) return Response.json({ error: 'Nimate dostopa do tega podjetja.', code: 'FORBIDDEN' }, { status: 403 });
    if (isTrialExpired(business) || !hasModule(business, 'pillar_offers')) {
      return Response.json({ error: 'Modul Generator ponudb ni aktiven. Aktivirajte ga v Nastavitve → Naročnina.', code: 'MODULE_LOCKED' }, { status: 402 });
    }

    const gens = await base44.asServiceRole.entities.OfferGeneration.filter({ id: generation_id });
    const gen = gens[0];
    if (!gen || gen.business_id !== business.id) return Response.json({ error: 'Ponudba ni najdena.' }, { status: 404 });
    if (!gen.output_pdf_url && !gen.output_docx_url) return Response.json({ error: 'Ponudba nima izvoženih datotek (PDF/DOCX).' }, { status: 400 });

    // Trial: pošiljanje šteje v kvoto 20 pošiljanj (Faza 5)
    if (business.subscription_status === 'trialing' && (business.trial_sends_remaining ?? 20) <= 0) {
      return Response.json({ error: 'Dosegli ste mejo poslanih sporočil v preizkusu (20). Aktivirajte naročnino za nadaljevanje.', code: 'TRIAL_SENDS_EXHAUSTED' }, { status: 402 });
    }

    const finalSubject = subject || `Ponudba — ${business.name}`;
    const signature = business.email_signature ? `\n\n${business.email_signature}` : `\n\nLep pozdrav,\n${business.name}${business.phone ? `\n${business.phone}` : ''}`;
    const links = [gen.output_pdf_url ? `PDF: ${gen.output_pdf_url}` : '', gen.output_docx_url ? `DOCX: ${gen.output_docx_url}` : ''].filter(Boolean).join('\n');
    const intro = message || `Spoštovani,\n\nv prilogi vam pošiljamo našo ponudbo. Za vsa vprašanja smo vam z veseljem na voljo.`;

    const smtpComplete = business.email_provider === 'smtp' && business.smtp_host && business.smtp_user && business.smtp_pass;
    let sentVia = 'platform';
    if (smtpComplete) {
      const transporter = nodemailer.createTransport({
        host: business.smtp_host,
        port: Number(business.smtp_port) || 587,
        secure: business.smtp_encryption === 'ssl_tls',
        requireTLS: business.smtp_encryption === 'starttls',
        auth: { user: business.smtp_user, pass: business.smtp_pass },
      });
      const attachments = [];
      if (gen.output_pdf_url) {
        try { const r = await fetch(gen.output_pdf_url); if (r.ok) attachments.push({ filename: 'ponudba.pdf', content: new Uint8Array(await r.arrayBuffer()), contentType: 'application/pdf' }); } catch (_) {}
      }
      await transporter.sendMail({
        from: `"${(business.smtp_from_name || business.name).replace(/"/g, '')}" <${business.smtp_from_email || business.smtp_user}>`,
        to,
        subject: finalSubject,
        text: `${intro}${signature}${attachments.length ? '' : `\n\nPrenos ponudbe:\n${links}`}`,
        attachments,
      });
      sentVia = 'smtp';
    } else {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to,
        subject: finalSubject,
        body: `${intro}${signature}\n\nPrenos ponudbe:\n${links}`,
        from_name: business.name,
      });
    }

    const now = new Date().toISOString();
    const updates = {};
    if (business.subscription_status === 'trialing') updates.trial_sends_remaining = Math.max(0, (business.trial_sends_remaining ?? 20) - 1);
    if (Object.keys(updates).length) await base44.asServiceRole.entities.Business.update(business.id, updates);
    await base44.asServiceRole.entities.UsageLog.create({
      business_id: business.id, date: now.split('T')[0], pillar: 'offers', feature: 'offers', subfeature: 'email_send',
      model: 'none', input_tokens: 0, output_tokens: 0, cost_eur: 0, is_demo: false,
    }).catch(() => {});

    return Response.json({ success: true, sent_to: to, via: sentVia });
  } catch (error) {
    return Response.json({ error: error.message || 'Pošiljanje ni uspelo.' }, { status: 500 });
  }
});
