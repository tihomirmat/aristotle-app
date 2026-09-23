import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Entity automation: trigger ko nov Lead.source = form/chatbot
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const { data } = body;

    if (!data || !data.business_id || !data.id) {
      return Response.json({ skipped: true, reason: 'no data' });
    }

    // Samo novi leadi iz obrazca ali klepeta
    if (!["form", "chatbot"].includes(data.source)) {
      return Response.json({ skipped: true, reason: 'not form/chatbot source' });
    }

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: data.business_id });
    const business = businesses[0];
    if (!business) return Response.json({ skipped: true, reason: 'no business' });
    const trialActive = business.subscription_status === 'trialing' && business.trial_ends_at && new Date(business.trial_ends_at) > new Date();
    if (!trialActive && business.pillar_leads !== true) return Response.json({ skipped: true, reason: 'pillar_leads disabled' });

    const pillar = data.source === 'chatbot' ? 'chatbot_handoff' : 'web_form_lead';

    await base44.asServiceRole.functions.invoke('generateDraft', {
      business_id: data.business_id,
      lead_id: data.id,
      pillar,
      sequence_step: 1,
      internal_secret: Deno.env.get('INTERNAL_FUNCTION_SECRET') || '',
    });

    return Response.json({ success: true, triggered: pillar, lead_id: data.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});