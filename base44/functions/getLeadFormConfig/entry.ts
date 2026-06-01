import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Public endpoint — returns lead form config for a business
// GET /getLeadFormConfig?business_id=XXX

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const business_id = url.searchParams.get("business_id");

    if (!business_id) {
      return Response.json({ error: "business_id is required" }, { status: 400, headers: corsHeaders });
    }

    const base44 = createClientFromRequest(req);
    const business = await base44.asServiceRole.entities.Business.get(business_id);

    if (!business) {
      return Response.json({ error: "Business not found" }, { status: 404, headers: corsHeaders });
    }

    // Return only public lead form config fields
    return Response.json({
      lead_form_title: business.lead_form_title || "Pošljite povpraševanje",
      lead_form_button_text: business.lead_form_button_text || "Pošlji povpraševanje",
      lead_form_success_message: business.lead_form_success_message || "Hvala! Kontaktirali vas bomo v najkrajšem možnem času.",
      lead_form_consent_text: business.lead_form_consent_text || null,
      lead_form_primary_color: business.lead_form_primary_color || "#10b981",
      lead_form_show_phone: business.lead_form_show_phone !== false,
      lead_form_show_service: business.lead_form_show_service === true,
    }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});