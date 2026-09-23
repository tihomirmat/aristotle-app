import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Skupna avtorizacija / entitlements (kopija v vsaki funkciji — Base44 funkcije nimajo skupnih modulov) ───
const ownsBusiness = (user, business) => {
  if (!user || !business) return false;
  if (user.role === 'admin') return true;
  return business.created_by_id === user.id
    || (!!user.email && business.created_by === user.email)
    || (!!user.email && !!business.owner_email && business.owner_email === user.email);
};
const isTrialActive = (b) => b?.subscription_status === 'trialing' && !!b.trial_ends_at && new Date(b.trial_ends_at) > new Date();
const isTrialExpired = (b) => b?.subscription_status === 'trialing' && !!b.trial_ends_at && new Date(b.trial_ends_at) <= new Date();
// Enako kot src/lib/entitlements.js: aktiven trial odpre vse module, sicer mora biti pillar_* = true
const hasModule = (b, pillarKey) => !!b && (isTrialActive(b) || b[pillarKey] === true);

// Zaženi reaktivacijo za vse neaktivne stranke podjetja
// Ustvari AI osnutke za stranke, ki niso bile kontaktirane 30+ dni
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { business_id } = body;
    if (!business_id) return Response.json({ error: 'business_id manjka' }, { status: 400 });

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: business_id });
    const business = businesses[0];
    if (!business) return Response.json({ error: 'Podjetje ni najdeno' }, { status: 404 });
    if (!ownsBusiness(user, business)) return Response.json({ error: 'Nimate dostopa do tega podjetja.', code: 'FORBIDDEN' }, { status: 403 });
    if (isTrialExpired(business) || !hasModule(business, 'pillar_reactivation')) {
      return Response.json({ error: 'Modul Reaktivacija ni aktiven. Aktivirajte ga v Nastavitve → Naročnina.', code: 'MODULE_LOCKED' }, { status: 402 });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const leads = await base44.entities.Lead.filter({ business_id });

    // Filtriraj: stranke z e-pošto, soglasjem, statusom new/contacted, niso bile kontaktirane 30+ dni
    const eligible = leads.filter(l => {
      if (!l.email || !l.consent_email) return false;
      if (l.status === 'unsubscribed' || l.status === 'converted') return false;
      if (l.last_contacted_at && new Date(l.last_contacted_at) > thirtyDaysAgo) return false;
      return true;
    });

    if (eligible.length === 0) {
      return Response.json({ success: true, created: 0, message: 'Ni ustreznih strank za reaktivacijo.' });
    }

    // Preveri obstoječe pendinge da ne podvajamo
    const existingDrafts = await base44.entities.DraftMessage.filter({ business_id, status: 'pending', pillar: 'reactivation' });
    const existingLeadIds = new Set(existingDrafts.map(d => d.lead_id));

    const toProcess = eligible.filter(l => !existingLeadIds.has(l.id)).slice(0, 10); // max 10 naenkrat

    let created = 0;
    for (const lead of toProcess) {
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Napiši kratko prijazno reaktivacijsko e-pošto v slovenščini (vikanje) za stranko ${lead.name} podjetja ${business.name}.
Panoga: ${business.industry_template || 'storitve'}
Ponudba: ${business.current_offer || 'posebna ponudba za stalne stranke'}
Bodi topel, oseben, konkreten. Ne generičnih fraz. 3–5 stavkov.
Vrni JSON z subject in body.`,
        response_json_schema: {
          type: 'object',
          properties: {
            subject: { type: 'string' },
            body: { type: 'string' },
          },
          required: ['subject', 'body'],
        },
      });

      await base44.asServiceRole.entities.DraftMessage.create({
        business_id,
        lead_id: lead.id,
        pillar: 'reactivation',
        channel: 'email',
        subject: result.subject,
        body: result.body,
        status: 'pending',
        ai_model_used: 'haiku',
        scheduled_at: new Date().toISOString(),
        created_by: business.created_by,
        owner_email: business.owner_email || business.created_by,
      });
      created++;
    }

    return Response.json({ success: true, created, eligible: eligible.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});