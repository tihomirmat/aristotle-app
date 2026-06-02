import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import JSZip from 'npm:jszip@3.10.1';

// Scheduled: runs on the 1st of each month.
// For each business with invoice_enabled + accountant_email:
//   1. Gather all invoices from the previous calendar month
//   2. Bundle attachments into a ZIP
//   3. Email ZIP + summary to accountant_email
//   4. Mark invoices as "sent" and create an InvoicePackage record

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow admin-triggered manual runs too
    const body = await req.json().catch(() => ({}));
    const forceBusiness = body.business_id || null;

    // Determine previous calendar month
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const monthStart = new Date(prevYear, prevMonth, 1).toISOString();
    const monthEnd = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59).toISOString();

    // Fetch all businesses with invoicing enabled
    const allBusinesses = await base44.asServiceRole.entities.Business.filter({ invoice_enabled: true });
    const targets = forceBusiness ? allBusinesses.filter(b => b.id === forceBusiness) : allBusinesses;

    const results = [];

    for (const business of targets) {
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
        `V priponki najdete mesečni paket računov za ${business.name} za obdobje ${monthName}.`,
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
        }),
      ]);

      results.push({ business_id: business.id, sent: true, invoice_count: invoices.length });
    }

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});