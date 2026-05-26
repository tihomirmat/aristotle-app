import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Public webhook endpoint — no user auth required
// POST /leadWebhook
// Body: { business_id, name, email, phone?, message?, source?, secret? }
// Optional: set LEAD_WEBHOOK_SECRET env var to require ?secret=xxx query param

Deno.serve(async (req) => {
  // CORS headers for embed form
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const { business_id, name, email, phone, message, source, secret } = body;

    // Optional secret validation
    const expectedSecret = Deno.env.get("LEAD_WEBHOOK_SECRET");
    if (expectedSecret && secret !== expectedSecret) {
      return Response.json({ error: "Invalid secret" }, { status: 401, headers: corsHeaders });
    }

    if (!business_id) {
      return Response.json({ error: "business_id is required" }, { status: 400, headers: corsHeaders });
    }
    if (!name || !email) {
      return Response.json({ error: "name and email are required" }, { status: 400, headers: corsHeaders });
    }

    // Check if lead already exists (by email + business)
    const existing = await base44.asServiceRole.entities.Lead.filter({ business_id, email });
    if (existing.length > 0) {
      return Response.json({ success: true, lead_id: existing[0].id, duplicate: true }, { headers: corsHeaders });
    }

    // Create lead
    const lead = await base44.asServiceRole.entities.Lead.create({
      business_id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || "",
      notes: message?.trim() || "",
      source: source || "form",
      status: "new",
      consent_email: true,
    });

    // Trigger AI draft via generateDraft function
    await base44.asServiceRole.functions.invoke('generateDraft', {
      business_id,
      lead_id: lead.id,
      pillar: 'web_form_lead',
      sequence_step: 1,
    });

    return Response.json({ success: true, lead_id: lead.id }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});