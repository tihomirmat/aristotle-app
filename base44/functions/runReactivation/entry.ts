import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Skupna avtorizacija / entitlements ───
const ownsBusiness = (user, business) => {
  if (!user || !business) return false;
  if (user.role === 'admin') return true;
  return business.created_by_id === user.id
    || (!!user.email && business.created_by === user.email)
    || (!!user.email && !!business.owner_email && business.owner_email === user.email);
};
const isTrialActive = (b) => b?.subscription_status === 'trialing' && !!b.trial_ends_at && new Date(b.trial_ends_at) > new Date();
const isTrialExpired = (b) => b?.subscription_status === 'trialing' && !!b.trial_ends_at && new Date(b.trial_ends_at) <= new Date();
const hasModule = (b, pillarKey) => !!b && (isTrialActive(b) || b[pillarKey] === true);

// Reaktivacija: za stranke brez stika 30+ dni ustvari osnutke prek generateDraft,
// da veljajo glas znamke, slovenski slog in ocenjevalec kakovosti (prej: ločen InvokeLLM brez teh plasti).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { business_id } = body;
    if (!business_id) return Response.json({ error: 'business_id manjka' }, { status: 400 });

    const business = (await base44.asServiceRole.entities.Business.filter({ id: business_id }))[0];
    if (!business) return Response.json({ error: 'Podjetje ni najdeno' }, { status: 404 });
    if (!ownsBusiness(user, business)) return Response.json({ error: 'Nimate dostopa do tega podjetja.', code: 'FORBIDDEN' }, { status: 403 });
    if (isTrialExpired(business) || !hasModule(business, 'pillar_reactivation')) {
      return Response.json({ error: 'Modul Reaktivacija ni aktiven. Aktivirajte ga v Nastavitve → Naročnina.', code: 'MODULE_LOCKED' }, { status: 402 });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const leads = await base44.asServiceRole.entities.Lead.filter({ business_id });
    const eligible = leads.filter((l) => {
      if (!l.email || !l.consent_email) return false;
      if (l.status === 'unsubscribed' || l.status === 'converted') return false;
      if (l.last_contacted_at && new Date(l.last_contacted_at) > thirtyDaysAgo) return false;
      return true;
    });
    if (eligible.length === 0) {
      return Response.json({ success: true, created: 0, eligible: 0, message: 'Ni ustreznih strank za reaktivacijo.' });
    }

    // Ne podvajaj: stranke, ki že imajo čakajoč ali označen reaktivacijski osnutek
    const existingDrafts = await base44.asServiceRole.entities.DraftMessage.filter({ business_id, pillar: 'reactivation' });
    const blocked = new Set(existingDrafts.filter((d) => ['pending', 'flagged_for_review', 'approved'].includes(d.status)).map((d) => d.lead_id));
    const toProcess = eligible.filter((l) => !blocked.has(l.id)).slice(0, 10);

    const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET') || '';
    let created = 0;
    let flagged = 0;
    const errors = [];
    for (const lead of toProcess) {
      try {
        const res = await base44.asServiceRole.functions.invoke('generateDraft', {
          business_id,
          lead_id: lead.id,
          pillar: 'reactivation',
          sequence_step: 1,
          internal_secret: internalSecret,
        });
        const data = res?.data ?? res;
        if (data?.error) { errors.push({ lead_id: lead.id, error: data.error, code: data.code }); if (data.code === 'TRIAL_CREDITS_EXHAUSTED' || data.code === 'MONTHLY_TRIAL_BUDGET_REACHED') break; continue; }
        created++;
        if (data?.draft?.status === 'flagged_for_review') flagged++;
      } catch (e) {
        errors.push({ lead_id: lead.id, error: e?.message || String(e) });
      }
    }

    return Response.json({ success: true, created, flagged, eligible: eligible.length, skipped_existing: eligible.length - toProcess.length, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
