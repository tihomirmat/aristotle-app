import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ADMIN: aktivira naročnino po naročilu (SubscriptionRequest) ali ročno ({ business_id, modules[] | bundle }).
// Nastavi pillar_*, subscription_status=active, billing_mode, bundle_active, integration_fee_paid in obvesti stranko.

const ALL_MODULES = ['pillar_reactivation', 'pillar_reviews', 'pillar_leads', 'pillar_chatbot', 'pillar_assistant', 'pillar_offers'];
const LABELS = { pillar_reactivation: 'Reaktivacija strank', pillar_reviews: 'Ocene & napotitve', pillar_leads: 'Pridobivanje strank', pillar_chatbot: 'Klepetalni pomočnik', pillar_assistant: 'Osebni asistent', pillar_offers: 'Generator ponudb' };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { request_id, action = 'activate' } = body;
    let business_id = body.business_id;
    let modules = Array.isArray(body.modules) ? body.modules.filter((m) => ALL_MODULES.includes(m)) : [];
    let bundle = body.bundle === true;
    let request = null;

    if (request_id) {
      const reqs = await base44.asServiceRole.entities.SubscriptionRequest.filter({ id: request_id });
      request = reqs[0];
      if (!request) return Response.json({ error: 'Naročilo ni najdeno' }, { status: 404 });
      business_id = request.business_id;
      modules = (request.modules || []).filter((m) => ALL_MODULES.includes(m));
      bundle = request.bundle === true;
    }
    if (!business_id) return Response.json({ error: 'business_id manjka' }, { status: 400 });

    if (action === 'reject') {
      if (!request) return Response.json({ error: 'request_id manjka' }, { status: 400 });
      await base44.asServiceRole.entities.SubscriptionRequest.update(request.id, { status: 'rejected', note: String(body.note || request.note || '').slice(0, 1000) });
      return Response.json({ success: true, rejected: true });
    }

    if (bundle) modules = [...ALL_MODULES];
    if (modules.length === 0) return Response.json({ error: 'Izberite vsaj en modul.' }, { status: 400 });
    const isBundle = bundle || modules.length === ALL_MODULES.length;

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: business_id });
    const business = businesses[0];
    if (!business) return Response.json({ error: 'Podjetje ni najdeno' }, { status: 404 });

    const updates = {};
    ALL_MODULES.forEach((k) => { updates[k] = modules.includes(k); });
    updates.pillar_digest = updates.pillar_assistant;
    updates.subscription_status = 'active';
    updates.billing_mode = isBundle ? 'bundle' : 'alacarte';
    updates.bundle_active = isBundle;
    updates.integration_fee_paid = true;
    await base44.asServiceRole.entities.Business.update(business_id, updates);

    const now = new Date().toISOString();
    if (request) {
      await base44.asServiceRole.entities.SubscriptionRequest.update(request.id, { status: 'activated', activated_at: now });
    }

    const ownerEmail = business.owner_email || request?.owner_email || (String(business.created_by || '').includes('@no-reply.base44.com') ? '' : business.created_by);
    if (ownerEmail) {
      const moduleList = modules.map((m) => `• ${LABELS[m]}`).join('\n');
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: ownerEmail,
        from_name: 'AI Aristotle',
        subject: 'Vaša naročnina je aktivna',
        body: `Pozdravljeni,\n\nvaša naročnina AI Aristotle je aktivirana. Aktivni moduli:\n\n${moduleList}\n\n${isBundle ? 'Paket vseh modulov: 399 €/mes' : `${modules.length} × 99 €/mes`} (brez DDV).\n\nPrijavite se: ${(Deno.env.get('APP_URL') || 'https://aristotle-smart-growth.base44.app')}\n\nHvala za zaupanje.\nEkipa AI Aristotle`,
      }).catch(() => {});
    }

    return Response.json({ success: true, business_id, modules, bundle: isBundle });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
