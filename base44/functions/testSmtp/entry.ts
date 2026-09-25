import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import nodemailer from 'npm:nodemailer@6.9.9';

// Nastavitve → Integracije → "Pošlji testno e-pošto": preveri SMTP nastavitve podjetja (verify + testno sporočilo
// na e-naslov prijavljenega lastnika) in zapiše rezultat v email_last_health_check_* polja.

// ─── Skupna avtorizacija (kopija v vsaki funkciji — Base44 funkcije nimajo skupnih modulov) ───
const ownsBusiness = (user, business) => {
  if (!user || !business) return false;
  if (user.role === 'admin') return true;
  return business.created_by_id === user.id
    || (!!user.email && business.created_by === user.email)
    || (!!user.email && !!business.owner_email && business.owner_email === user.email);
};

// ─── HTML predloga e-pošte (kopija v vsaki funkciji — Base44 funkcije nimajo skupnih modulov) ───
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
const emailRows = (rows) => '<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin:0 0 16px;border:1px solid #e5e7eb;border-radius:8px;border-collapse:separate">' + rows.map(([k, v], i) => `<tr style="background:${i % 2 ? '#ffffff' : '#f9fafb'}"><td style="padding:9px 12px;font-size:13px;color:#6b7280;width:40%;vertical-align:top">${escHtml(k)}</td><td style="padding:9px 12px;font-size:14px;color:#111827;font-weight:500">${v}</td></tr>`).join('') + '</table>';
const emailHtml = ({ brand = 'AI Aristotle', brandSub = '', title = '', bodyHtml = '' }) => `<!doctype html><html lang="sl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(title || brand)}</title></head>
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
</td></tr>
<tr><td style="padding:16px 8px 0;font-size:12px;line-height:1.5;color:#6b7280;text-align:center">
${escHtml(EMAIL_FOOTER_COMPANY)}${EMAIL_FOOTER_ADDRESS ? ' · ' + escHtml(EMAIL_FOOTER_ADDRESS) : ''} · <a href="${EMAIL_APP_URL}" style="color:#6b7280">${escHtml(EMAIL_APP_URL.replace(/^https?:\/\//, ''))}</a>
</td></tr>
</table></td></tr></table></body></html>`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { business_id } = body;
    if (!business_id) return Response.json({ error: 'business_id manjka' }, { status: 400 });

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: business_id });
    const business = businesses[0];
    if (!business) return Response.json({ error: 'Podjetje ni najdeno' }, { status: 404 });
    if (!ownsBusiness(user, business)) return Response.json({ error: 'Nimate dostopa do tega podjetja.', code: 'FORBIDDEN' }, { status: 403 });

    if (business.email_provider !== 'smtp') {
      return Response.json({ error: 'Test je na voljo samo za ponudnika SMTP. Izberite SMTP in izpolnite nastavitve.' }, { status: 400 });
    }
    const missing = ['smtp_host', 'smtp_user', 'smtp_pass'].filter((k) => !business[k]);
    if (missing.length) {
      return Response.json({ error: `Manjkajo SMTP nastavitve: ${missing.map((k) => ({ smtp_host: 'gostitelj', smtp_user: 'uporabniško ime', smtp_pass: 'geslo' })[k]).join(', ')}. Vsako polje shranite tako, da kliknete izven njega.` }, { status: 400 });
    }

    const to = String(body.to_email || user.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return Response.json({ error: 'Neveljaven e-poštni naslov prejemnika.' }, { status: 400 });

    const port = Number(business.smtp_port) || 587;
    const enc = business.smtp_encryption || 'starttls';
    const transporter = nodemailer.createTransport({
      host: business.smtp_host,
      port,
      secure: enc === 'ssl_tls' || port === 465,
      requireTLS: enc === 'starttls',
      ignoreTLS: enc === 'none',
      auth: { user: business.smtp_user, pass: business.smtp_pass },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });

    const fromEmail = business.smtp_from_email || business.smtp_user;
    const fromName = (business.smtp_from_name || business.name || 'AI Aristotle').replace(/"/g, '');
    const now = new Date();
    const stamp = now.toLocaleString('sl-SI', { timeZone: 'Europe/Ljubljana' });

    try {
      await transporter.verify();
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject: `Testno sporočilo — ${business.name} (SMTP deluje)`,
        text: `Pozdravljeni,\n\nto je testno sporočilo iz AI Aristotle. Vaše SMTP nastavitve za podjetje ${business.name} delujejo.\n\nStrežnik: ${business.smtp_host}:${port} (${enc})\nPošiljatelj: ${fromName} <${fromEmail}>\nČas: ${stamp}\n\nLep pozdrav,\nAI Aristotle`,
        html: emailHtml({
          brand: business.name,
          brandSub: 'testno sporočilo prek AI Aristotle',
          title: 'SMTP nastavitve delujejo',
          bodyHtml: textToHtml(`Pozdravljeni,\nto je testno sporočilo iz AI Aristotle. Sporočila strankam podjetja ${business.name} se bodo pošiljala s temi nastavitvami.`)
            + emailRows([
              ['Strežnik', `${escHtml(business.smtp_host)}:${port} (${escHtml(enc)})`],
              ['Pošiljatelj', `${escHtml(fromName)} &lt;${escHtml(fromEmail)}&gt;`],
              ['Prejemnik testa', escHtml(to)],
              ['Čas', escHtml(stamp)],
            ])
            + textToHtml('Če je to sporočilo pristalo med neželeno pošto, preverite SPF/DKIM zapise domene pošiljatelja.\n\nLep pozdrav,\nAI Aristotle'),
        }),
      });

      await base44.asServiceRole.entities.Business.update(business.id, {
        email_last_health_check_at: now.toISOString(),
        email_last_health_check_status: 'ok',
        email_last_health_check_error: '',
      });
      return Response.json({ success: true, sent_to: to, message_id: info?.messageId || null, from: fromEmail });
    } catch (e) {
      const msg = String(e?.message || e || 'SMTP napaka').slice(0, 500);
      await base44.asServiceRole.entities.Business.update(business.id, {
        email_last_health_check_at: now.toISOString(),
        email_last_health_check_status: 'error',
        email_last_health_check_error: msg,
      }).catch(() => {});
      return Response.json({ success: false, error: `SMTP napaka: ${msg}` }, { status: 502 });
    }
  } catch (error) {
    return Response.json({ error: error.message || 'Test ni uspel.' }, { status: 500 });
  }
});
