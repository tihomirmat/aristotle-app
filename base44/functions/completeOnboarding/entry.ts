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
    const existing = await base44.asServiceRole.entities.Business.filter({ created_by: user.email, is_demo: false });
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

    // Auto-seed Knowledge Base
    const phone = form.phone || 'še ni vneseno';
    const address = form.address || 'še ni vneseno';
    const website = form.website || 'še ni vneseno';
    const services = form.services || 'naše storitve';
    const email = user.email || 'še ni vneseno';
    const kb = (title, content, category) =>
      base44.asServiceRole.entities.KnowledgeBase.create({
        business_id: business.id, title, content, category, active: true, created_by: user.email, owner_email: user.email,
      });
    await Promise.all([
      kb('Naše storitve', `Pri ${form.name} ponujamo: ${services}. Za info pišite na ${email} ali pokličite ${phone}. Termini in cene se prilagajajo. Z veseljem vam pripravimo personaliziran predlog.`, 'Storitve'),
      kb('Rezervacija termina', `Termin lahko rezervirate na 3 načine: 1) Kliknete spodaj na Rezerviraj termin. 2) Pokličete ${phone}. 3) Pišete na ${email} s preferenco. Delovni čas pon-pet od 09:00 do 17:00. Potrditev v isti delovni dan.`, 'Termini'),
      kb('Pogosta vprašanja', `Ali ponujate brezplačno posvetovanje? Da, prvi razgovor je brezplačen. Kako poteka prvo srečanje? Spoznamo potrebe, predstavimo storitve, določimo naslednje korake. Ali izdajate račune? Da, s pravilno izdanim računom (z DDV kjer relevantno). Kako prekličem termin? Brezplačno do 24 ur pred rezervacijo. Kakšen rok za odgovor? V naslednjih delovnih dneh, običajno isti dan.`, 'FAQ'),
      kb('Kontaktni podatki', `Naslov: ${address}. Telefon: ${phone}. Email: ${email}. Spletna stran: ${website}. Delovni čas: pon-pet, 09:00-17:00.`, 'Kontakt'),
    ]);

    return Response.json({ success: true, business_id: business.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
