import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Entity automation: trigger ko Lead.status → converted ali replied
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const { event, data, old_data } = body;

    if (!data || !data.business_id || !data.id) {
      return Response.json({ skipped: true, reason: 'no data' });
    }

    // Samo ob spremembi statusa na converted/replied
    const newStatus = data.status;
    const oldStatus = old_data?.status;
    if (newStatus === oldStatus) return Response.json({ skipped: true, reason: 'status unchanged' });
    if (!["converted", "replied"].includes(newStatus)) return Response.json({ skipped: true, reason: 'not target status' });

    // Pridobi business
    const businesses = await base44.asServiceRole.entities.Business.filter({ id: data.business_id });
    const business = businesses[0];
    if (!business) return Response.json({ skipped: true, reason: 'no business' });

    // Preveri pogoje
    if (!business.review_requests_enabled) return Response.json({ skipped: true, reason: 'reviews disabled' });
    if (!business.google_review_link) return Response.json({ skipped: true, reason: 'no review link' });
    if (!data.consent_email) return Response.json({ skipped: true, reason: 'no consent' });
    if (data.status === 'unsubscribed') return Response.json({ skipped: true, reason: 'unsubscribed' });

    // Preveri ali je že bila prošnja v zadnjih 60 dneh
    const since60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const existingDrafts = await base44.asServiceRole.entities.DraftMessage.filter({
      business_id: data.business_id,
      lead_id: data.id,
      pillar: 'review_request',
    });
    const recentReview = existingDrafts.find(d => d.created_date > since60d);
    if (recentReview) return Response.json({ skipped: true, reason: 'recent review request exists' });

    // Zamik pošiljanja (počakaj X ur) — tukaj samo ustvarimo draft, timing je pri pošiljanju
    const delayHours = business.review_request_delay_hours || 24;

    // Sproži generateDraft
    await base44.asServiceRole.functions.invoke('generateDraft', {
      business_id: data.business_id,
      lead_id: data.id,
      pillar: 'review_request',
      sequence_step: 1,
    });

    return Response.json({ success: true, triggered: 'review_request', lead_id: data.id, delay_hours: delayHours });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});