import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Zaključi onboarding: ustvari Business + bazo znanja (service role, da RLS ne blokira novih uporabnikov).

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { form } = body;
    if (!form?.name?.trim()) return Response.json({ error: 'Ime podjetja je obvezno' }, { status: 400 });
    if (!form.gdpr_confirmed) return Response.json({ error: 'GDPR soglašje je obvezno' }, { status: 400 });

    const [byOwner, byCreator] = await Promise.all([
      base44.asServiceRole.entities.Business.filter({ owner_email: user.email, is_demo: false }),
      base44.asServiceRole.entities.Business.filter({ created_by: user.email, is_demo: false }),
    ]);
    const existing = [...byOwner, ...byCreator.filter(b => !byOwner.some(o => o.id === b.id))];
    if (existing.length > 0 && existing.some(b => b.onboarding_complete)) {
      return Response.json({ success: true, business_id: existing[0].id, already_exists: true });
    }

    const allowed = ['gym', 'dental_medspa', 'home_services', 'restaurant', 'salon_barber', 'auto', 'other'];
    const industryVal = allowed.includes(form.industry_template) ? form.industry_template : 'other';
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
      owner_email: user.email,
    });

    // Baza znanja: iz skenirane spletne strani (brez izmišljenih podatkov); sicer samo to, kar je vnesel uporabnik.
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
