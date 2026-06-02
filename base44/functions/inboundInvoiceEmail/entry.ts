import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Public inbound-email webhook — provider-agnostic (Mailgun + Resend style).
//
// Mailgun posts multipart/form-data with fields:
//   recipient, sender, subject, attachment-count, attachment-1..N (files)
// Resend posts application/json with fields:
//   to (array|string), from, subject, attachments: [{filename, content (base64)}]
//
// Token is extracted from the recipient address: inv-<token>@...

const ALLOWED_EXTS = [".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".webp", ".gif"];
const ALLOWED_MIME = ["application/pdf", "image/"];

function isAllowedAttachment(filename, contentType) {
  const fn = (filename || "").toLowerCase();
  const ct = (contentType || "").toLowerCase();
  return ALLOWED_EXTS.some(e => fn.endsWith(e)) || ALLOWED_MIME.some(m => ct.startsWith(m));
}

function extractToken(address) {
  // address may be "Name <inv-TOKEN@domain>" or "inv-TOKEN@domain"
  const cleaned = (address || "").replace(/.*<(.+)>.*/, "$1").trim();
  const local = cleaned.split("@")[0];
  const m = local.match(/^inv-(.+)$/i);
  return m ? m[1] : null;
}

async function uploadBase64(base44, b64, filename, mimeType) {
  const binary = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType || "application/octet-stream" });
  const result = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });
  return result?.file_url || null;
}

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });

  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (e) {
    return Response.json({ error: "init failed", detail: e.message }, { status: 500, headers: cors });
  }

  const contentType = req.headers.get("content-type") || "";
  let recipientRaw = "", from = "", subject = "";
  const attachmentsToProcess = []; // { filename, base64, mimeType }

  try {
    if (contentType.includes("multipart/form-data")) {
      // ── Mailgun style ──────────────────────────────────────────────────────
      let form;
      try { form = await req.formData(); } catch (e) {
        console.error("formData parse error:", e.message);
        return Response.json({ skipped: true, reason: "bad multipart" }, { headers: cors });
      }

      recipientRaw = form.get("recipient") || form.get("to") || form.get("X-Envelope-To") || "";
      from = form.get("sender") || form.get("from") || "";
      subject = form.get("subject") || "";

      // Mailgun attaches files as attachment-1, attachment-2, ...
      // Also check generic keys like "attachments" (some providers)
      const count = parseInt(form.get("attachment-count") || "0");
      for (let i = 1; i <= Math.max(count, 20); i++) {
        const file = form.get(`attachment-${i}`);
        if (!file) break;
        if (file instanceof File) {
          if (!isAllowedAttachment(file.name, file.type)) continue;
          const ab = await file.arrayBuffer();
          const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
          attachmentsToProcess.push({ filename: file.name, base64: b64, mimeType: file.type });
        }
      }
      // Some providers send a JSON "attachments" field too
      const attJson = form.get("attachments");
      if (attJson) {
        try {
          const arr = JSON.parse(attJson);
          if (Array.isArray(arr)) {
            for (const a of arr) {
              const fn = a.filename || a.name || "";
              const ct = a.content_type || a.type || "";
              const b64 = a.content || a.data || "";
              if (b64 && isAllowedAttachment(fn, ct)) {
                attachmentsToProcess.push({ filename: fn, base64: b64, mimeType: ct });
              }
            }
          }
        } catch { /* ignore */ }
      }

    } else if (contentType.includes("application/json")) {
      // ── Resend / JSON style ────────────────────────────────────────────────
      let body;
      try { body = await req.json(); } catch (e) {
        console.error("json parse error:", e.message);
        return Response.json({ skipped: true, reason: "bad json" }, { headers: cors });
      }

      // Resend: to is array; Mailgun-JSON: recipient string
      const toField = body.to || body.recipient || body.recipients || "";
      recipientRaw = Array.isArray(toField) ? toField.join(",") : String(toField);
      from = body.from || body.sender || "";
      subject = body.subject || "";

      const atts = body.attachments || body.attachment || [];
      for (const a of (Array.isArray(atts) ? atts : [])) {
        const fn = a.filename || a.name || "";
        const ct = a.content_type || a.type || "application/octet-stream";
        const b64 = a.content || a.data || "";
        if (b64 && isAllowedAttachment(fn, ct)) {
          attachmentsToProcess.push({ filename: fn, base64: b64, mimeType: ct });
        }
      }

    } else {
      console.warn("Unsupported content-type:", contentType);
      return Response.json({ skipped: true, reason: "unsupported content-type" }, { headers: cors });
    }
  } catch (parseErr) {
    console.error("Payload parse error:", parseErr.message);
    return Response.json({ skipped: true, reason: "parse error", detail: parseErr.message }, { headers: cors });
  }

  // Extract token — check all recipient addresses (comma-separated possible)
  const candidates = recipientRaw.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  let token = null;
  for (const addr of candidates) {
    token = extractToken(addr);
    if (token) break;
  }

  if (!token) {
    console.warn("No inv- token found in recipients:", recipientRaw);
    return Response.json({ skipped: true, reason: "no invoice token in recipient" }, { headers: cors });
  }

  // Look up business
  let business;
  try {
    const matches = await base44.asServiceRole.entities.Business.filter({ invoice_inbound_token: token });
    business = matches[0];
  } catch (e) {
    console.error("Business lookup error:", e.message);
    return Response.json({ error: "db error" }, { status: 500, headers: cors });
  }

  if (!business) return Response.json({ skipped: true, reason: "no business for token" }, { headers: cors });

  if (attachmentsToProcess.length === 0) {
    console.log("No PDF/image attachments in email to", recipientRaw);
    return Response.json({ skipped: true, reason: "no PDF/image attachments" }, { headers: cors });
  }

  const now = new Date().toISOString();
  const created = [];

  for (const att of attachmentsToProcess) {
    try {
      const fileUrl = await uploadBase64(base44, att.base64, att.filename, att.mimeType);
      const inv = await base44.asServiceRole.entities.Invoice.create({
        business_id: business.id,
        source_email_from: from,
        subject: subject,
        received_date: now,
        file_url: fileUrl,
        file_name: att.filename,
        status: "captured",
        created_by: business.created_by,
      });
      created.push(inv.id);
    } catch (e) {
      console.error("Failed to save attachment", att.filename, e.message);
      // Continue with others
    }
  }

  return Response.json({ success: true, invoices_created: created.length, ids: created }, { headers: cors });
});