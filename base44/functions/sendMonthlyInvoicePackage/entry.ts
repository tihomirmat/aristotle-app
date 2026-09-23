import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import JSZip from 'npm:jszip@3.10.1';

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


// ─── Skupna avtorizacija (kopija v vsaki funkciji — Base44 funkcije nimajo skupnih modulov) ───
const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') || '';
const isInternalCall = (body) => !!INTERNAL_SECRET && body?.internal_secret === INTERNAL_SECRET;
const ownsBusiness = (user, business) => {
  if (!user || !business) return false;
  if (user.role === 'admin') return true;
  return business.created_by_id === user.id
    || (!!user.email && business.created_by === user.email)
    || (!!user.email && !!business.owner_email && business.owner_email === user.email);
};

// Scheduled: runs on the 1st of each month.
// For each business with invoice_enabled + accountant_email:
//   1. Gather all invoices from the previous calendar month
//   2. Bundle attachments into a ZIP
//   3. Email ZIP + summary to accountant_email
//   4. Mark invoices as "sent" and create an InvoicePackage record

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Klici: (a) urnik (workflow — identiteta admina), (b) ročno iz Računi ({ business_id, month?, year? }) — lastnik podjetja ali admin
    const body = await req.json().catch(() => ({}));
    const forceBusiness = body.business_id || null;
    const user = await base44.auth.me().catch(() => null);
    const internal = isInternalCall(body);
    if (!internal && !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Obdobje: privzeto prejšnji koledarski mesec; ročni klic lahko poda { month: 1-12, year }
    const now = new Date();
    let prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    let prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    if (forceBusiness && Number.isInteger(body.month) && Number.isInteger(body.year) && body.month >= 1 && body.month <= 12) {
      prevMonth = body.month - 1;
      prevYear = body.year;
    }
    const monthStart = new Date(prevYear, prevMonth, 1).toISOString();
    const monthEnd = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59).toISOString();

    // Fetch all businesses with invoicing enabled
    const allBusinesses = await base44.asServiceRole.entities.Business.filter({ invoice_enabled: true });
    let targets = forceBusiness ? allBusinesses.filter(b => b.id === forceBusiness) : allBusinesses;
    if (forceBusiness) {
      if (targets.length === 0) return Response.json({ error: 'Podjetje ni najdeno ali nima vklopljenega modula Računi.' }, { status: 404 });
      if (!internal && !ownsBusiness(user, targets[0])) return Response.json({ error: 'Nimate dostopa do tega podjetja.', code: 'FORBIDDEN' }, { status: 403 });
    } else if (!internal && user?.role !== 'admin') {
      // Zagon za VSA podjetja je dovoljen samo urniku/adminu
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const results = [];

    for (const business of targets) {
      try {
      if (!business.accountant_email) {
        results.push({ business_id: business.id, skipped: true, reason: "no accountant_email" });
        continue;
      }

      // Get invoices for previous month
      const allInvoices = await base44.asServiceRole.entities.Invoice.filter({ business_id: business.id, status: "captured" });
      const invoices = allInvoices.filter(inv => {
        const d = inv.received_date || inv.created_date;
        return d >= monthStart && d <= monthEnd;
      });

      if (invoices.length === 0) {
        results.push({ business_id: business.id, skipped: true, reason: "no invoices for period" });
        continue;
      }
      // Dedupe: paket za isto obdobje pošljemo samo enkrat (razen ročno s force: true)
      if (!body.force) {
        const existingPkgs = await base44.asServiceRole.entities.InvoicePackage.filter({ business_id: business.id, period_month: prevMonth + 1, period_year: prevYear });
        if (existingPkgs.length > 0) {
          results.push({ business_id: business.id, skipped: true, reason: "package already sent for period" });
          continue;
        }
      }

      // Build ZIP
      const zip = new JSZip();
      const summaryRows = [];

      for (const inv of invoices) {
        if (inv.file_url) {
          const res = await fetch(inv.file_url);
          if (res.ok) {
            const buf = await res.arrayBuffer();
            const safeName = (inv.file_name || `invoice-${inv.id}.pdf`).replace(/[^a-zA-Z0-9._-]/g, "_");
            zip.file(safeName, buf);
          }
        }
        const receivedStr = inv.received_date ? new Date(inv.received_date).toLocaleDateString("sl-SI") : "—";
        summaryRows.push(`${inv.source_email_from || "?"}\t${inv.subject || "—"}\t${receivedStr}\t${inv.file_name || "—"}`);
      }

      const zipBlob = await zip.generateAsync({ type: "uint8array" });
      const zipFile = new Blob([zipBlob], { type: "application/zip" });
      const { file_url: zipUrl } = await base44.asServiceRole.integrations.Core.UploadFile({ file: zipFile });

      // Build email body
      const monthName = new Date(prevYear, prevMonth, 1).toLocaleString("sl-SI", { month: "long", year: "numeric" });
      const invoiceTable = '<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin:0 0 16px;border:1px solid #e5e7eb;border-radius:8px;border-collapse:separate;font-size:13px">'
        + '<tr style="background:#f3f4f6"><td style="padding:8px 10px;color:#6b7280">Pošiljatelj</td><td style="padding:8px 10px;color:#6b7280">Zadeva</td><td style="padding:8px 10px;color:#6b7280">Prejeto</td><td style="padding:8px 10px;color:#6b7280">Datoteka</td></tr>'
        + invoices.map((inv, i) => {
          const receivedStr = inv.received_date ? new Date(inv.received_date).toLocaleDateString("sl-SI") : "—";
          return `<tr style="background:${i % 2 ? '#f9fafb' : '#ffffff'}"><td style="padding:8px 10px">${escHtml(inv.source_email_from || "?")}</td><td style="padding:8px 10px">${escHtml(inv.subject || "—")}</td><td style="padding:8px 10px;white-space:nowrap">${escHtml(receivedStr)}</td><td style="padding:8px 10px">${escHtml(inv.file_name || "—")}</td></tr>`;
        }).join('')
        + '</table>';
      const emailBody = emailHtml({
        brand: business.name,
        brandSub: 'prek AI Aristotle',
        title: `Mesečni paket računov — ${monthName}`,
        bodyHtml: textToHtml(`Spoštovani,\npripravljen je mesečni paket prejetih računov za ${business.name} za obdobje ${monthName}. V paketu (ZIP) je ${invoices.length} ${invoices.length === 1 ? 'račun' : invoices.length === 2 ? 'računa' : invoices.length < 5 ? 'računi' : 'računov'}.`)
          + invoiceTable
          + textToHtml(`Če kateri od računov manjka ali je napačen, odgovorite na to sporočilo.\n\nLep pozdrav,\n${business.name}`),
        cta: { label: 'Prenesi paket (ZIP)', url: zipUrl },
      });

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: business.accountant_email,
        subject: `Mesečni paket računov — ${business.name} — ${monthName}`,
        body: emailBody,
        from_name: business.name,
      });

      const sentAt = new Date().toISOString();

      // Mark invoices as sent + create package record
      await Promise.all([
        ...invoices.map(inv => base44.asServiceRole.entities.Invoice.update(inv.id, { status: "sent" })),
        base44.asServiceRole.entities.InvoicePackage.create({
          business_id: business.id,
          period_month: prevMonth + 1,
          period_year: prevYear,
          invoice_count: invoices.length,
          zip_file_url: zipUrl,
          sent_at: sentAt,
          accountant_email: business.accountant_email,
          created_by: business.created_by,
          owner_email: business.owner_email || business.created_by,
        }),
      ]);

      results.push({ business_id: business.id, sent: true, invoice_count: invoices.length, zip_url: zipUrl });
      } catch (e) {
        results.push({ business_id: business.id, error: e.message });
      }
    }

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});