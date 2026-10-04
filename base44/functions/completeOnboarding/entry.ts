import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Completes onboarding for a new user: creates the Business + seeds the Knowledge Base.
// Runs asServiceRole so entity RLS cannot block first-time signups.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { form } = body;
    if (!form?.name?.trim()) return Response.json({ error: 'Ime podjetja je obvezno' }, { status: 400 });
    if (!form.gdpr_confirmed) return Response.json({ error: 'GDPR soglasje je obvezno' }, { status: 400 });

    // Guard: one business per user (avoid duplicates on double-click/retry)
    const [byOwner, byCreator] = await Promise.all([
      base44.asServiceRole.entities.Business.filter({ owner_email: user.email, is_demo: false }),
      base44.asServiceRole.entities.Business.filter({ created_by: user.email, is_demo: false }),
    ]);
    const existing = [...byOwner, ...byCreator.filter(b => !byOwner.some(o => o.id === b.id))];
    if (existing.length > 0 && existing.some(b => b.onboarding_complete)) {
      return Response.json({ success: true, business_id: existing[0].id, already_exists: true });
    }

    const industryVal = form.industry_template === 'other2' ? 'other' : (form.industry_template || 'other');
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const business = await base44.asServiceRole.entities.Business.create({
      name: form.name,
      industry_template: industryVal,
      phone: form.phone || '',
      address: form.address || '',
      website: form.website || '',
      hours: form.hours || '',
      services: form.services || '',
      current_offer: form.current_offer || '',
      google_review_link: form.google_review_link || '',
      brand_voice: form.brand_voice || '',
      tone_preset: form.brand_voice ? 'warm_personal' : 'industry_default',
      onboarding_complete: true,
      draft_mode: true,
      locale: 'sl',
      subscription_status: 'trialing',
      billing_mode: 'trial',
      trial_ends_at: trialEndsAt,
      trial_cost_cap_eur: 0.45,
      trial_cost_used_eur: 0,
      trial_sends_remaining: 20,
      trial_model_lock: 'haiku',
      anthropic_model: 'haiku',
      trial_emails_sent: [],
      pillar_reactivation: true,
      pillar_reviews: true,
      pillar_leads: true,
      pillar_chatbot: true,
      pillar_assistant: true,
      pillar_digest: true,
      pillar_offers: true,
      review_requests_enabled: true,
      review_request_delay_hours: 24,
      created_by: user.email,
      owner_email: user.email, // owner visibility via RLS data.owner_email
    });

    // Baza znanja: iz skenirane spletne strani (brez izmišljenih podatkov); sicer samo kontakt in storitve, ki jih je vnesel uporabnik.
    const kb = (title, content, category) =>
      base44.asServiceRole.entities.KnowledgeBase.create({
        business_id: business.id, title, content, category, active: true, created_by: user.email, owner_email: user.email,
      });
    const scanned = Array.isArray(form.knowledge) ? form.knowledge.filter((k) => k?.title && k?.content).slice(0, 8) : [];
    if (scanned.length > 0) {
      await Promise.all(scanned.map((k) => kb(String(k.title).slice(0, 120), String(k.content).slice(0, 4000), k.category || 'O podjetju')));
    } else {
      const parts = [];
      if (form.services) parts.push(`Storitve: ${form.services}.`);
      if (form.hours) parts.push(`Delovni čas: ${form.hours}.`);
      if (form.phone) parts.push(`Telefon: ${form.phone}.`);
      if (form.address) parts.push(`Naslov: ${form.address}.`);
      if (form.website) parts.push(`Spletna stran: ${form.website}.`);
      if (form.current_offer) parts.push(`Trenutna ponudba: ${form.current_offer}.`);
      if (parts.length) await kb('O podjetju', `${form.name}. ${parts.join(' ')}`, 'O podjetju');
    }

    return Response.json({ success: true, business_id: business.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
