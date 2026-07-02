import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { business_id } = body;
    if (!business_id) return Response.json({ error: 'business_id manjka' }, { status: 400 });

    const businesses = await base44.entities.Business.filter({ id: business_id });
    const business = businesses[0];
    if (!business) return Response.json({ error: 'Podjetje ni najdeno' }, { status: 404 });

    const today = new Date().toISOString().split('T')[0];

    // Preveri ali briefing za danes že obstaja
    const existing = await base44.asServiceRole.entities.AssistantBriefing.filter({
      business_id: business_id,
      date: today,
    });
    if (existing.length > 0) {
      return Response.json({ success: true, briefing: existing[0], cached: true });
    }

    // Pridobi podatke za briefing
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [leads, drafts, bookings] = await Promise.all([
      base44.asServiceRole.entities.Lead.filter({ business_id }),
      base44.asServiceRole.entities.DraftMessage.filter({ business_id }),
      base44.asServiceRole.entities.ConfirmedBooking.filter({ business_id }),
    ]);

    const newLeadsThisWeek = leads.filter(l => new Date(l.created_date) >= weekAgo).length;
    const pendingDrafts = drafts.filter(d => d.status === 'pending').length;
    const sentThisWeek = drafts.filter(d => d.status === 'sent' && d.sent_at && new Date(d.sent_at) >= weekAgo).length;
    const upcomingBookings = bookings.filter(b => b.status === 'confirmed' && b.booked_at && new Date(b.booked_at) >= now).length;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Si osebni AI asistent podjetja "${business.name}".
Napiši kratko jutranjo poročilo za danes (${today}) v slovenščini, vikanje.

Podatki:
- Skupaj strank v sistemu: ${leads.length}
- Novih strank ta teden: ${newLeadsThisWeek}
- Sporočil čaka na odobritev: ${pendingDrafts}
- Poslanih sporočil ta teden: ${sentThisWeek}
- Prihodnjih potrjenih terminov: ${upcomingBookings}
- Panoga: ${business.industry_template || 'storitve'}
- Trenutna ponudba: ${business.current_offer || '—'}

Navodila:
- Poročilo naj bo v Markdown formatu
- Kratko in jedrnato (5–8 stavkov)
- Poudarite najpomembnejše akcije za danes
- Ton: profesionalen, pozitiven, koristne informacije
- Vključite razdelek ## Danes priporočamo za predlog ene konkretne akcije`,
    });

    const briefing = await base44.asServiceRole.entities.AssistantBriefing.create({
      business_id,
      date: today,
      content: result,
      generated_at: new Date().toISOString(),
      created_by: business.created_by,
      owner_email: business.owner_email || business.created_by,
    });

    return Response.json({ success: true, briefing });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});