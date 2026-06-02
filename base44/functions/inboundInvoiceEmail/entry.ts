import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Public webhook: receives forwarded emails for invoice capture.
// Expected payload (multipart/form-data or JSON):
//   to: "inv-<token>@..." — used to match the business
//   from: sender email
//   subject: email subject
//   attachments: array of { filename, content (base64), content_type }
// Also handles raw JSON body with the same fields.

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const base44 = createClientFromRequest(req);
    const contentType = req.headers.get("content-type") || "";

    let to = "", from = "", subject = "", attachments = [];

    if (contentType.includes("application/json")) {
      const body = await req.json();
      to = body.to || "";
      from = body.from || "";
      subject = body.subject || "";
      attachments = body.attachments || [];
    } else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      to = form.get("to") || "";
      from = form.get("from") || "";
      subject = form.get("subject") || "";
      const raw = form.get("attachments");
      if (raw) {
        try { attachments = JSON.parse(raw); } catch { attachments = []; }
      }
    } else {
      return Response.json({ error: "Unsupported content type" }, { status: 415, headers: corsHeaders });
    }

    // Extract token from "to" address: inv-<token>@domain or just the local part
    const toLocal = to.split("@")[0] || "";
    const tokenMatch = toLocal.match(/^inv-(.+)$/);
    if (!tokenMatch) {
      return Response.json({ skipped: true, reason: "not an invoice address" }, { headers: corsHeaders });
    }
    const token = tokenMatch[1];

    // Match business by invoice_inbound_token
    const businesses = await base44.asServiceRole.entities.Business.filter({ invoice_inbound_token: token });
    const business = businesses[0];
    if (!business) {
      return Response.json({ skipped: true, reason: "no business found for token" }, { headers: corsHeaders });
    }
    if (!business.invoice_enabled) {
      return Response.json({ skipped: true, reason: "invoice module not enabled" }, { headers: corsHeaders });
    }

    // Filter to PDF/image attachments only
    const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/tiff", "image/webp"];
    const invoiceAttachments = attachments.filter(a => {
      const ct = (a.content_type || a.type || "").toLowerCase();
      const fn = (a.filename || a.name || "").toLowerCase();
      return ALLOWED_TYPES.some(t => ct.includes(t)) || fn.endsWith(".pdf") || fn.endsWith(".png") || fn.endsWith(".jpg") || fn.endsWith(".jpeg");
    });

    if (invoiceAttachments.length === 0) {
      return Response.json({ skipped: true, reason: "no PDF/image attachments" }, { headers: corsHeaders });
    }

    const now = new Date().toISOString();
    const created = [];

    for (const att of invoiceAttachments) {
      const filename = att.filename || att.name || "invoice.pdf";
      const base64Content = att.content || att.data || "";
      const contentTypeStr = att.content_type || att.type || "application/octet-stream";

      // Decode base64 and upload as file
      let fileUrl = null;
      if (base64Content) {
        const binaryStr = atob(base64Content);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        const blob = new Blob([bytes], { type: contentTypeStr });

        const uploaded = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });
        fileUrl = uploaded?.file_url || null;
      }

      const invoice = await base44.asServiceRole.entities.Invoice.create({
        business_id: business.id,
        source_email_from: from,
        subject: subject,
        received_date: now,
        file_url: fileUrl,
        file_name: filename,
        status: "captured",
      });
      created.push(invoice.id);
    }

    return Response.json({ success: true, invoices_created: created.length, ids: created }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});