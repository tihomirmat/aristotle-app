import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { business_id } = await req.json();
  if (!business_id) return Response.json({ error: 'business_id required' }, { status: 400 });

  const db = base44.asServiceRole;

  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const nextWeek = new Date(now); nextWeek.setDate(now.getDate() + 7);

  const randomPastDate = (daysBack) => {
    const d = new Date(now);
    d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
    return d.toISOString();
  };

  // 10 Leads
  const leadData = [
    { name: "Ana Novak", email: "ana.novak@gmail.com", phone: "+386 40 111 001", status: "new", source: "form", tags: [] },
    { name: "Marko Horvat", email: "marko.horvat@gmail.com", phone: "+386 40 111 002", status: "contacted", source: "import", tags: ["VIP"] },
    { name: "Petra Kovač", email: "petra.kovac@gmail.com", phone: "+386 40 111 003", status: "replied", source: "manual", tags: [] },
    { name: "Jure Krajnc", email: "jure.krajnc@gmail.com", phone: "+386 40 111 004", status: "new", source: "chatbot", tags: [] },
    { name: "Maja Vidmar", email: "maja.vidmar@gmail.com", phone: "+386 40 111 005", status: "contacted", source: "form", tags: [] },
    { name: "Tomaž Zupančič", email: "tomaz.zupancic@gmail.com", phone: "+386 40 111 006", status: "replied", source: "import", tags: ["VIP"] },
    { name: "Nina Rupnik", email: "nina.rupnik@gmail.com", phone: "+386 40 111 007", status: "new", source: "manual", tags: [] },
    { name: "Andrej Pavlič", email: "andrej.pavlic@gmail.com", phone: "+386 40 111 008", status: "contacted", source: "form", tags: [] },
    { name: "Sara Bezjak", email: "sara.bezjak@gmail.com", phone: "+386 40 111 009", status: "new", source: "chatbot", tags: [] },
    { name: "Luka Hribar", email: "luka.hribar@gmail.com", phone: "+386 40 111 010", status: "replied", source: "import", tags: [] },
  ];

  const leads = await Promise.all(leadData.map((l) =>
    db.entities.Lead.create({
      ...l,
      business_id,
      consent_email: true,
      booking_intent: false,
      last_contacted_at: randomPastDate(30),
      is_demo: true,
    })
  ));

  // 3 DraftMessages for first 3 leads
  await Promise.all([
    db.entities.DraftMessage.create({
      business_id,
      lead_id: leads[0].id,
      pillar: "reactivation",
      channel: "email",
      subject: "Pogrešamo vas, Ana!",
      body: "Pozdravljeni Ana,\n\nopazili smo, da nas že nekaj časa niste obiskali. Radi bi vam ponudili posebno priložnost – ta mesec pripravljamo ekskluzivno ponudbo samo za naše stalne stranke.\n\nVas zanima? Z veseljem vam rezerviramo termin po vaši izbiri.\n\nLep pozdrav,\nVaša ekipa",
      status: "pending",
      ai_model_used: "haiku",
      is_demo: true,
    }),
    db.entities.DraftMessage.create({
      business_id,
      lead_id: leads[1].id,
      pillar: "review_request",
      channel: "email",
      subject: "Kako smo se odrezali, Marko?",
      body: "Pozdravljeni Marko,\n\nhvala, ker ste nas nedavno obiskali! Vaše mnenje nam veliko pomeni.\n\nBi si vzeli 2 minuti in nam pustili oceno? Vsaka beseda nam pomaga, da se izboljšamo in pomagamo novim strankam pri odločitvi.\n\n👉 Pustite oceno: https://g.page/r/primer\n\nIskrena hvala!\nVaša ekipa",
      status: "pending",
      ai_model_used: "haiku",
      is_demo: true,
    }),
    db.entities.DraftMessage.create({
      business_id,
      lead_id: leads[2].id,
      pillar: "web_form_lead",
      channel: "email",
      subject: "Hvala za vaše povpraševanje, Petra!",
      body: "Pozdravljeni Petra,\n\nhvala za vaše povpraševanje prek naše spletne strani!\n\nVaše sporočilo smo prejeli in vam bomo odgovorili v najkrajšem možnem času. Medtem si lahko ogledate naše storitve in ceniki na spletni strani.\n\nCe imate kakršnakoli vprašanja, nas pokličite na +386 40 000 000.\n\nLep pozdrav,\nVaša ekipa",
      status: "pending",
      ai_model_used: "haiku",
      is_demo: true,
    }),
  ]);

  // 1 BookingProposal with 3 slots next week
  const slot1Start = new Date(nextWeek); slot1Start.setHours(9, 0, 0, 0);
  const slot1End = new Date(slot1Start); slot1End.setMinutes(60);
  const slot2Start = new Date(nextWeek); slot2Start.setDate(slot2Start.getDate() + 1); slot2Start.setHours(14, 0, 0, 0);
  const slot2End = new Date(slot2Start); slot2End.setMinutes(60);
  const slot3Start = new Date(nextWeek); slot3Start.setDate(slot3Start.getDate() + 2); slot3Start.setHours(11, 0, 0, 0);
  const slot3End = new Date(slot3Start); slot3End.setMinutes(60);

  await db.entities.BookingProposal.create({
    business_id,
    lead_id: leads[3].id,
    proposed_slots: [
      { start_datetime: slot1Start.toISOString(), end_datetime: slot1End.toISOString(), label: slot1Start.toLocaleDateString("sl-SI", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) },
      { start_datetime: slot2Start.toISOString(), end_datetime: slot2End.toISOString(), label: slot2Start.toLocaleDateString("sl-SI", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) },
      { start_datetime: slot3Start.toISOString(), end_datetime: slot3End.toISOString(), label: slot3Start.toLocaleDateString("sl-SI", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) },
    ],
    message: "Spoštovani Jure,\n\nv skladu z vašo željo vam predlagamo naslednje razpoložljive termine za sestanek. Prosimo, da izberete termin, ki vam najbolj ustreza, in nam sporočite svojo odločitev.\n\nZ lepimi pozdravi",
    service_requested: "Posvetovanje",
    duration_minutes: 60,
    status: "pending",
    expires_at: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
    is_demo: true,
  });

  // 1 ConfirmedBooking for tomorrow
  const tomorrowAt10 = new Date(tomorrow); tomorrowAt10.setHours(10, 0, 0, 0);
  await db.entities.ConfirmedBooking.create({
    business_id,
    lead_id: leads[4].id,
    booked_at: tomorrowAt10.toISOString(),
    duration_minutes: 60,
    notes: "Stranka je prosila za posvetovanje glede novih storitev. Pripravite prospekt.",
    status: "confirmed",
    is_demo: true,
  });

  // 2 KnowledgeBase articles
  await Promise.all([
    db.entities.KnowledgeBase.create({
      business_id,
      title: "Naše storitve",
      content: "Nudimo širok nabor storitev prilagojenih vašim potrebam:\n\n• Osnovno svetovanje (60 min) – 50 €\n• Poglobljeno posvetovanje (90 min) – 80 €\n• Mesečno vzdrževanje – od 150 €/mes\n• Skupinski paketi – po dogovoru\n\nVse storitve izvajamo v naših prostorih ali na daljavo. Za rezervacijo termina nas kontaktirajte po telefonu ali e-pošti.",
      category: "storitve",
      active: true,
      is_demo: true,
    }),
    db.entities.KnowledgeBase.create({
      business_id,
      title: "Pogosta vprašanja",
      content: "**Kako rezerviram termin?**\nTermin lahko rezervirate po telefonu, e-pošti ali prek spletnega obrazca na naši strani.\n\n**Kako dolgo traja sestanek?**\nStandardni sestanek traja 60 minut. Daljše sesije so na voljo po dogovoru.\n\n**Kakšne so možnosti plačila?**\nSprejemamo gotovino, kartice in bančno nakazilo.\n\n**Ali nudite popuste?**\nZa stalne stranke nudimo 10% popust na vse storitve. Za podjetja in večje naročile se cene dogovorimo individualno.\n\n**Kje se nahajate?**\nNaše pisarne so v centru Ljubljane. Točen naslov prejmete ob potrditvi termina.",
      category: "faq",
      active: true,
      is_demo: true,
    }),
  ]);

  return Response.json({ success: true, leads_created: leads.length });
});