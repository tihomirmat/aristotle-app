import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Stranka odda naročilo modulov (Nastavitve → Naročnina → "Naroči module").
// NE aktivira ničesar — ustvari SubscriptionRequest, obvesti admina in stranko.
// Aktivacijo (po plačilu predračuna) izvede admin: /admin/businesses → "Aktiviraj (plačano)" (adminActivateSubscription).

// ─── Skupna avtorizacija / entitlements (kopija v vsaki funkciji — Base44 funkcije nimajo skupnih modulov) ───
const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') || '';
const isInternalCall = (body) => !!INTERNAL_SECRET && body?.internal_secret === INTERNAL_SECRET;
const ownsBusiness = (user, business) => {
  if (!user || !business) return false;
  if (user.role === 'admin') return true;
  return business.created_by_id === user.id
    || (!!user.email && business.created_by === user.email)
    || (!!user.email && !!business.owner_email && business.owner_email === user.email);
};

const MODULES = {
  pillar_reactivation: 'Reaktivacija strank',
  pillar_reviews: 'Ocene & napotitve',
  pillar_leads: 'Pridobivanje strank',
  pillar_chatbot: 'Klepetalni pomočnik',
  pillar_assistant: 'Osebni asistent',
  pillar_offers: 'Generator ponudb',
};
const MODULE_PRICE = 99;
const BUNDLE_PRICE = 399;
const INTEGRATION_FEE = 199;
const ADMIN_EMAIL = Deno.env.get('ADMIN_NOTIFY_EMAIL') || 'ingenius.tihomir@gmail.com';
const APP_URL = (Deno.env.get('APP_URL') || 'https://aristotle-smart-growth.base44.app').replace(/\/$/, '');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { business_id } = body;
    const bundle = body.bundle === true;
    const modules = bundle ? Object.keys(MODULES) : (Array.isArray(body.modules) ? body.modules.filter((m) => MODULES[m]) : []);
    if (!business_id) return Response.json({ error: 'business_id manjka' }, { status: 400 });
    if (modules.length === 0) return Response.json({ error: 'Izberite vsaj en modul.' }, { status: 400 });

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: business_id });
    const business = businesses[0];
    if (!business) return Response.json({ error: 'Podjetje ni najdeno' }, { status: 404 });
    if (!ownsBusiness(user, business)) return Response.json({ error: 'Nimate dostopa do tega podjetja.', code: 'FORBIDDEN' }, { status: 403 });

    // Eno odprto naročilo naenkrat
    const open = await base44.asServiceRole.entities.SubscriptionRequest.filter({ business_id, status: 'pending' });
    if (open.length > 0) {
      return Response.json({ success: true, request: open[0], already_pending: true });
    }

    const isBundle = bundle || modules.length === Object.keys(MODULES).length;
    const monthly = isBundle ? BUNDLE_PRICE : modules.length * MODULE_PRICE;
    const fee = (isBundle || business.integration_fee_paid) ? 0 : INTEGRATION_FEE;
    const ownerEmail = business.owner_email || user.email;

    const request = await base44.asServiceRole.entities.SubscriptionRequest.create({
      business_id,
      business_name: business.name,
      owner_email: ownerEmail,
      modules,
      bundle: isBundle,
      monthly_total_eur: monthly,
      integration_fee_eur: fee,
      status: 'pending',
      note: String(body.note || '').slice(0, 1000),
    });

    const moduleList = modules.map((m) => `• ${MODULES[m]}`).join('\n');
    const summary = `Podjetje: ${business.name}\nLastnik: ${ownerEmail}\n\nModuli:\n${moduleList}\n\nMesečno: ${monthly} € (brez DDV)${fee ? `\nStrošek namestitve (enkratno): ${fee} €` : ''}\nPrvi račun: ${monthly + fee} €`;

    // Obvestilo adminu + potrditev stranki (napake pri e-pošti ne podrejo naročila)
    await Promise.allSettled([
      base44.asServiceRole.integrations.Core.SendEmail({
        to: ADMIN_EMAIL,
        from_name: 'AI Aristotle',
        subject: `Novo naročilo modulov — ${business.name}`,
        body: `${summary}\n\nAktivacija: ${APP_URL}/admin/businesses\nID naročila: ${request.id}`,
      }),
      base44.asServiceRole.integrations.Core.SendEmail({
        to: ownerEmail,
        from_name: 'AI Aristotle',
        subject: 'Prejeli smo vaše naročilo modulov',
        body: `Pozdravljeni,\n\nhvala za naročilo. Povzetek:\n\n${summary}\n\nV enem delovnem dnevu vam pošljemo predračun; po plačilu module aktiviramo in vas obvestimo po e-pošti. Če imate vprašanja, odgovorite na to sporočilo.\n\nLep pozdrav,\nEkipa AI Aristotle`,
      }),
    ]);

    return Response.json({ success: true, request });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
