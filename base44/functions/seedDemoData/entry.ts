import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { business_id } = body;
    if (!business_id) return Response.json({ error: 'business_id required' }, { status: 400 });

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: business_id });
    const business = businesses[0];
    if (!business) return Response.json({ error: 'Business not found' }, { status: 404 });

    const DEMO_LEADS = [
      { name: "Ana Novak", email: "ana.novak@example.si", phone: "+386 40 111 222", status: "new", source: "form", notes: "Zanima me vaša storitev" },
      { name: "Marko Horvat", email: "marko.horvat@example.si", phone: "+386 41 333 444", status: "contacted", source: "chatbot" },
      { name: "Petra Kovač", email: "petra.kovac@example.si", phone: "+386 31 555 666", status: "replied", source: "manual", tags: ["VIP"] },
      { name: "Jure Krajnc", email: "jure.krajnc@example.si", phone: "+386 51 777 888", status: "new", source: "import" },
      { name: "Maja Vidmar", email: "maja.vidmar@example.si", phone: "+386 40 999 111", status: "converted", source: "form" },
      { name: "Tomaž Zupančič", email: "tomaz.zupancic@example.si", phone: "+386 41 222 333", status: "contacted", source: "chatbot", tags: ["VIP"] },
      { name: "Nina Rupnik", email: "nina.rupnik@example.si", phone: "+386 31 444 555", status: "new", source: "manual" },
      { name: "Andrej Pavlič", email: "andrej.pavlic@example.si", phone: "+386 51 666 777", status: "unsubscribed", source: "form" },
      { name: "Sara Bezjak", email: "sara.bezjak@example.si", phone: "+386 40 888 999", status: "replied", source: "chatbot" },
      { name: "Luka Hribar", email: "luka.hribar@example.si", phone: "+386 41 111 333", status: "converted", source: "manual" },
    ];

    const createdLeads = await Promise.all(
      DEMO_LEADS.map((l) =>
        base44.asServiceRole.entities.Lead.create({
          ...l,
          tags: l.tags || [],
          business_id,
          consent_email: true,
          is_demo: true,
        })
      )
    );

    const ana = createdLeads.find(l => l.name === "Ana Novak");
    const marko = createdLeads.find(l => l.name === "Marko Horvat");
    const petra = createdLeads.find(l => l.name === "Petra Kovač");
    const maja = createdLeads.find(l => l.name === "Maja Vidmar");
    const luka = createdLeads.find(l => l.name === "Luka Hribar");

    // Generiraj AI drafts za 3 leade
    const draftResults = await Promise.all([
      base44.asServiceRole.functions.invoke('generateDraft', {
        business_id,
        lead_id: ana?.id,
        pillar: 'reactivation',
        sequence_step: 1,
      }).catch(() => null),
      base44.asServiceRole.functions.invoke('generateDraft', {
        business_id,
        lead_id: marko?.id,
        pillar: 'review_request',
        sequence_step: 1,
      }).catch(() => null),
      base44.asServiceRole.functions.invoke('generateDraft', {
        business_id,
        lead_id: petra?.id,
        pillar: 'web_form_lead',
        sequence_step: 1,
      }).catch(() => null),
    ]);

    // Booking proposal za Maja
    const now = new Date();
    const slot1 = new Date(now); slot1.setDate(slot1.getDate() + 7); slot1.setHours(9, 0, 0, 0);
    const slot2 = new Date(now); slot2.setDate(slot2.getDate() + 8); slot2.setHours(11, 0, 0, 0);
    const slot3 = new Date(now); slot3.setDate(slot3.getDate() + 9); slot3.setHours(14, 0, 0, 0);

    await base44.asServiceRole.entities.BookingProposal.create({
      business_id,
      lead_id: maja?.id,
      service_requested: "Uvodni termin",
      duration_minutes: 60,
      status: "pending",
      expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      proposed_slots: [
        { start_datetime: slot1.toISOString(), end_datetime: new Date(slot1.getTime() + 60 * 60000).toISOString(), label: slot1.toLocaleDateString("sl-SI", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) },
        { start_datetime: slot2.toISOString(), end_datetime: new Date(slot2.getTime() + 60 * 60000).toISOString(), label: slot2.toLocaleDateString("sl-SI", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) },
        { start_datetime: slot3.toISOString(), end_datetime: new Date(slot3.getTime() + 60 * 60000).toISOString(), label: slot3.toLocaleDateString("sl-SI", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) },
      ],
      is_demo: true,
    });

    // Confirmed booking za Luka
    const bookedAt = new Date(now); bookedAt.setDate(bookedAt.getDate() + 2); bookedAt.setHours(10, 0, 0, 0);
    await base44.asServiceRole.entities.ConfirmedBooking.create({
      business_id,
      lead_id: luka?.id,
      booked_at: bookedAt.toISOString(),
      duration_minutes: 60,
      notes: "Osebni termin",
      status: "confirmed",
      is_demo: true,
    });

    // Knowledge Base auto-seed
    const phone = business.phone || "še ni vneseno";
    const email = user.email || "še ni vneseno";
    const address = business.address || "še ni vneseno";
    const website = business.website || "še ni vneseno";
    const services = business.services || "naše storitve";
    const hoursStart = business.booking_hours_start || "09:00";
    const hoursEnd = business.booking_hours_end || "17:00";

    await Promise.all([
      base44.asServiceRole.entities.KnowledgeBase.create({
        business_id,
        title: "Naše storitve",
        content: `Pri ${business.name} ponujamo: ${services}. Za info pišite na ${email} ali pokličite ${phone}. Termini in cene se prilagajajo. Z veseljem vam pripravimo personaliziran predlog.`,
        category: "Storitve",
        active: true,
        is_demo: true,
      }),
      base44.asServiceRole.entities.KnowledgeBase.create({
        business_id,
        title: "Rezervacija termina",
        content: `Termin lahko rezervirate na 3 načine: 1) Kliknete spodaj na Rezerviraj termin. 2) Pokličete ${phone}. 3) Pišete na ${email} s preferenco. Delovni čas pon-pet od ${hoursStart} do ${hoursEnd}. Potrditev v isti delovni dan.`,
        category: "Termini",
        active: true,
        is_demo: true,
      }),
      base44.asServiceRole.entities.KnowledgeBase.create({
        business_id,
        title: "Pogosta vprašanja",
        content: `Ali ponujate brezplačno posvetovanje? Da, prvi razgovor je brezplačen. Kako poteka prvo srečanje? Spoznamo potrebe, predstavimo storitve, določimo naslednje korake. Ali izdajate račune? Da, s pravilno izdanim računom (z DDV kjer relevantno). Kako prekličem termin? Brezplačno do 24 ur pred rezervacijo. Kakšen rok za odgovor? V naslednjih delovnih dneh, običajno isti dan.`,
        category: "FAQ",
        active: true,
        is_demo: true,
      }),
      base44.asServiceRole.entities.KnowledgeBase.create({
        business_id,
        title: "Kontaktni podatki",
        content: `Naslov: ${address}. Telefon: ${phone}. Email: ${email}. Spletna stran: ${website}. Delovni čas: pon-pet, ${hoursStart}-${hoursEnd}.`,
        category: "Kontakt",
        active: true,
        is_demo: true,
      }),
    ]);

    return Response.json({
      success: true,
      leads_created: createdLeads.length,
      drafts_attempted: 3,
      kb_records: 4,
      message: "Demo podatki ustvarjeni z AI drafti in bazo znanja",
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});