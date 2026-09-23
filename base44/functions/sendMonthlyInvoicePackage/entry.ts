import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import JSZip from 'npm:jszip@3.10.1';

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
      const tableHeader = "Pošiljatelj\tZadeva\tDatum prejema\tDatoteka";
      const emailBody = [
        `Spoštovani,`,
        ``,
        `Pripravljen je mesečni paket računov za ${business.name} za obdobje ${monthName}.`,
        ``,
        `Prenos paketa (ZIP z vsemi računi): ${zipUrl}`,
        ``,
        `Skupno računov: ${invoices.length}`,
        ``,
        `Seznam računov:`,
        tableHeader,
        ...summaryRows,
        ``,
        `Lep pozdrav,`,
        `AI Aristotle — ${business.name}`,
      ].join("\n");

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