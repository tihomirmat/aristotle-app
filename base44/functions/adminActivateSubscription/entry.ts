import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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


// ADMIN: aktivira naročnino po naročilu (SubscriptionRequest) ali ročno ({ business_id, modules[] | bundle }).
// Nastavi pillar_*, subscription_status=active, billing_mode, bundle_active, integration_fee_paid in obvesti stranko.

const ALL_MODULES = ['pillar_reactivation', 'pillar_reviews', 'pillar_leads', 'pillar_chatbot', 'pillar_assistant', 'pillar_offers'];
const LABELS = { pillar_reactivation: 'Reaktivacija strank', pillar_reviews: 'Ocene & napotitve', pillar_leads: 'Pridobivanje strank', pillar_chatbot: 'Klepetalni pomočnik', pillar_assistant: 'Osebni asistent', pillar_offers: 'Generator ponudb' };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { request_id, action = 'activate' } = body;
    let business_id = body.business_id;
    let modules = Array.isArray(body.modules) ? body.modules.filter((m) => ALL_MODULES.includes(m)) : [];
    let bundle = body.bundle === true;
    let request = null;

    if (request_id) {
      const reqs = await base44.asServiceRole.entities.SubscriptionRequest.filter({ id: request_id });
      request = reqs[0];
      if (!request) return Response.json({ error: 'Naročilo ni najdeno' }, { status: 404 });
      business_id = request.business_id;
      modules = (request.modules || []).filter((m) => ALL_MODULES.includes(m));
      bundle = request.bundle === true;
    }
    if (!business_id) return Response.json({ error: 'business_id manjka' }, { status: 400 });

    if (action === 'reject') {
      if (!request) return Response.json({ error: 'request_id manjka' }, { status: 400 });
      await base44.asServiceRole.entities.SubscriptionRequest.update(request.id, { status: 'rejected', note: String(body.note || request.note || '').slice(0, 1000) });
      return Response.json({ success: true, rejected: true });
    }

    if (bundle) modules = [...ALL_MODULES];
    if (modules.length === 0) return Response.json({ error: 'Izberite vsaj en modul.' }, { status: 400 });
    const isBundle = bundle || modules.length === ALL_MODULES.length;

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: business_id });
    const business = businesses[0];
    if (!business) return Response.json({ error: 'Podjetje ni najdeno' }, { status: 404 });

    const updates = {};
    ALL_MODULES.forEach((k) => { updates[k] = modules.includes(k); });
    updates.pillar_digest = updates.pillar_assistant;
    updates.subscription_status = 'active';
    updates.billing_mode = isBundle ? 'bundle' : 'alacarte';
    updates.bundle_active = isBundle;
    updates.integration_fee_paid = true;
    await base44.asServiceRole.entities.Business.update(business_id, updates);

    const now = new Date().toISOString();
    if (request) {
      await base44.asServiceRole.entities.SubscriptionRequest.update(request.id, { status: 'activated', activated_at: now });
    }

    const ownerEmail = business.owner_email || request?.owner_email || (String(business.created_by || '').includes('@no-reply.base44.com') ? '' : business.created_by);
    if (ownerEmail) {
      const moduleList = modules.map((m) => `• ${LABELS[m]}`).join('\n');
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: ownerEmail,
        from_name: 'AI Aristotle',
        subject: 'Vaša naročnina je aktivna',
        body: `Pozdravljeni,\n\nvaša naročnina AI Aristotle je aktivirana. Aktivni moduli:\n\n${moduleList}\n\n${isBundle ? 'Paket vseh modulov: 399 €/mes' : `${modules.length} × 99 €/mes`} (brez DDV).\n\nPrijavite se: ${(Deno.env.get('APP_URL') || 'https://aristotle-smart-growth.base44.app')}\n\nHvala za zaupanje.\nEkipa AI Aristotle`,
      }).catch(() => {});
    }

    return Response.json({ success: true, business_id, modules, bundle: isBundle });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
