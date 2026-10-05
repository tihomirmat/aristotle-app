import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Testni CRM podatki (is_demo=true) za predstavitev: podjetja, stranke, časovnica, opravila, termini, ponudbe, računi, kampanje.
// Demo sporočila se nikoli ne pošljejo zares (sendApprovedDraft). Počisti: Nastavitve → Demo podatki → Počisti.

const H = 3600e3, D = 24 * H;
const at = (offsetMs, hour) => { const d = new Date(Date.now() + offsetMs); if (hour !== undefined) d.setUTCHours(hour - 2, 0, 0, 0); return d.toISOString(); };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const user = await base44.auth.me().catch(() => null);
    if (user?.role !== 'admin') return Response.json({ error: 'Samo skrbnik.' });
    const business_id = body.business_id || body.args?.business_id || '69fdc32dd7a14b17ffa223d1';
    const sr = base44.asServiceRole.entities;
    const business = (await sr.Business.filter({ id: business_id }))[0];
    if (!business) return Response.json({ error: 'Ni podjetja.' });
    const owner = business.owner_email || business.created_by;
    const base = { business_id, owner_email: owner, created_by: owner, is_demo: true };

    // 1) počisti prejšnje demo zapise teh entitet
    let removed = 0;
    for (const e of ['Activity', 'Task', 'CampaignEnrollment', 'Campaign', 'ConfirmedBooking', 'OfferGeneration', 'Invoice', 'DraftMessage', 'Lead', 'Company']) {
      const rows = (await sr[e].filter({ business_id, is_demo: true })).filter((r) => r.business_id === business_id && r.is_demo === true);
      for (const r of rows) { await sr[e].delete(r.id); removed++; }
    }

    // 2) podjetja
    const C = {};
    const companies = [
      ['kos', { name: 'Gradnje Kos d.o.o.', email: 'info@gradnje-kos.si', phone: '+386 41 222 310', website: 'www.gradnje-kos.si', address: 'Industrijska cesta 12, Kranj', tax_id: 'SI48215573', industry: 'Gradbeništvo', value: 4800, notes: 'Želijo novo spletno stran z referencami in obrazcem za povpraševanja.' }],
      ['smile', { name: 'Zobna ordinacija Smile d.o.o.', email: 'recepcija@smile-dental.si', phone: '+386 1 430 22 10', website: 'www.smile-dental.si', address: 'Celovška 150, Ljubljana', tax_id: 'SI77120455', industry: 'Zdravstvo', value: 2900, notes: 'Zanima jih spletno naročanje in Google oglasi.' }],
      ['novak', { name: 'Mizarstvo Novak s.p.', email: 'mizarstvo.novak@siol.net', phone: '+386 31 555 812', website: 'www.mizarstvo-novak.si', address: 'Šentjernej 44', tax_id: 'SI23111890', industry: 'Mizarstvo', value: 1600 }],
      ['pulz', { name: 'Fitnes Pulz d.o.o.', email: 'info@fitnes-pulz.si', phone: '+386 40 610 700', website: 'www.fitnes-pulz.si', address: 'Tržaška 33, Maribor', tax_id: 'SI90123344', industry: 'Šport in rekreacija', value: 3600, notes: 'Stalna stranka — vzdrževanje strani + oglaševanje.' }],
      ['lipa', { name: 'Gostilna Pri Lipi', email: 'rezervacije@prilipi.si', phone: '+386 4 531 44 20', website: 'www.prilipi.si', address: 'Bled, Ljubljanska 8', tax_id: 'SI55120987', industry: 'Gostinstvo', value: 1200 }],
      ['kranjc', { name: 'Avtoservis Kranjc d.o.o.', email: 'servis@avto-kranjc.si', phone: '+386 2 620 11 50', website: 'www.avto-kranjc.si', address: 'Ptujska 101, Maribor', tax_id: 'SI61200455', industry: 'Avtomobilizem', value: 2200 }],
      ['bella', { name: 'Frizerski salon Bella s.p.', email: 'salon.bella@gmail.com', phone: '+386 51 300 900', address: 'Koper, Pristaniška 3', tax_id: 'SI10293847', industry: 'Lepota', value: 900 }],
      ['horvat', { name: 'Elektro Horvat d.o.o.', email: 'pisarna@elektro-horvat.si', phone: '+386 3 490 70 70', website: 'www.elektro-horvat.si', address: 'Celje, Mariborska 210', tax_id: 'SI39485721', industry: 'Elektroinštalacije', value: 3100 }],
    ];
    for (const [k, c] of companies) C[k] = await sr.Company.create({ ...base, ...c });

    // 3) stranke
    const L = {};
    const leads = [
      ['marko', { name: 'Marko Kos', position: 'direktor', company_id: C.kos.id, email: 'marko.kos@gradnje-kos.si', phone: '+386 41 222 311', source: 'email', status: 'replied', value: 4800, service_requested: 'Nova spletna stran z referencami', email_subject: 'Re: Ponudba za spletno stran', last_inbound_at: at(-3 * H), last_contacted_at: at(-2 * D), notes: 'Želi 3 jezike (SLO/DE/EN). Rok: pred sezono, marec. Odločata z ženo.' }],
      ['petra', { name: 'Petra Kos', position: 'računovodstvo', company_id: C.kos.id, email: 'petra@gradnje-kos.si', source: 'manual', status: 'contacted', last_contacted_at: at(-6 * D), notes: 'Kontakt za račune.' }],
      ['ana', { name: 'dr. Ana Zupan', position: 'lastnica', company_id: C.smile.id, email: 'ana.zupan@smile-dental.si', phone: '+386 40 112 334', source: 'form', status: 'booked', value: 2900, service_requested: 'Spletno naročanje pacientov', last_inbound_at: at(-1 * D), last_contacted_at: at(-1 * D), notes: 'Sestanek dogovorjen. Želi primerjavo s sistemom, ki ga ima konkurenca.' }],
      ['tina', { name: 'Tina Bizjak', position: 'recepcija', company_id: C.smile.id, email: 'recepcija@smile-dental.si', source: 'manual', status: 'contacted' }],
      ['janez', { name: 'Janez Novak', position: 'lastnik', company_id: C.novak.id, email: 'mizarstvo.novak@siol.net', phone: '+386 31 555 812', source: 'chatbot', status: 'new', value: 1600, service_requested: 'Galerija izdelkov in obrazec za ponudbo', last_inbound_at: at(-40 * 60e3), notes: 'Prek klepeta: »Rabim enostavno stran, kjer se vidijo kuhinje, ki smo jih naredili.«' }],
      ['luka', { name: 'Luka Vidmar', position: 'direktor', company_id: C.pulz.id, email: 'luka@fitnes-pulz.si', phone: '+386 40 610 701', source: 'import', status: 'converted', value: 3600, last_contacted_at: at(-9 * D), last_inbound_at: at(-9 * D), notes: 'Mesečno vzdrževanje 290 €. Zadovoljen — prositi za Google oceno.' }],
      ['maja', { name: 'Maja Golob', position: 'vodja', company_id: C.lipa.id, email: 'maja@prilipi.si', source: 'email', status: 'new', value: 1200, service_requested: 'Prenova menija na spletni strani + rezervacije', email_subject: 'Povpraševanje — spletna stran gostilne', last_inbound_at: at(-2 * H), notes: 'E-pošta: »Zanima nas prenova strani in možnost rezervacije mize prek spleta. Kakšna je okvirna cena?«' }],
      ['rok', { name: 'Rok Kranjc', position: 'direktor', company_id: C.kranjc.id, email: 'rok@avto-kranjc.si', phone: '+386 41 909 120', source: 'manual', status: 'contacted', value: 2200, last_contacted_at: at(-5 * D), notes: 'Spoznala na sejmu. Poslana predstavitev, čakam odziv.' }],
      ['sara', { name: 'Sara Bella', position: 'lastnica', company_id: C.bella.id, email: 'salon.bella@gmail.com', phone: '+386 51 300 900', source: 'form', status: 'lost', value: 900, last_contacted_at: at(-20 * D), notes: 'Preverjala cene, izbrala cenejšo rešitev.' }],
      ['igor', { name: 'Igor Horvat', position: 'direktor', company_id: C.horvat.id, email: 'igor@elektro-horvat.si', phone: '+386 41 777 210', source: 'email', status: 'booked', value: 3100, service_requested: 'SEO + Google oglasi za Celje', email_subject: 'Oglaševanje na Googlu', last_inbound_at: at(-26 * H), last_contacted_at: at(-25 * H) }],
      ['mojca', { name: 'Mojca Horvat', position: 'pisarna', company_id: C.horvat.id, email: 'pisarna@elektro-horvat.si', source: 'manual', status: 'contacted' }],
      ['eva', { name: 'Eva Kralj', email: 'eva.kralj@gmail.com', phone: '+386 40 333 210', source: 'chatbot', status: 'new', service_requested: 'Spletna trgovina za ročno izdelan nakit', last_inbound_at: at(-5 * H), notes: 'Klepet: zanima jo, koliko stane manjša spletna trgovina (do 50 izdelkov).' }],
      ['matej', { name: 'Matej Potočnik', email: 'matej.potocnik@outlook.com', phone: '+386 31 404 505', source: 'form', status: 'contacted', value: 700, service_requested: 'Osebna stran za fotografa', last_contacted_at: at(-3 * D), last_inbound_at: at(-4 * D) }],
      ['nina', { name: 'Nina Kovač', email: 'nina.kovac@gmail.com', source: 'email', status: 'replied', value: 1500, service_requested: 'Prenova WordPress strani', email_subject: 'Re: Predlog prenove', last_inbound_at: at(-20 * H), last_contacted_at: at(-3 * D), notes: 'Odpisala: »Hvala, predlog je super. Ali lahko začnemo konec meseca?«' }],
      ['bojan', { name: 'Bojan Mlakar', email: 'bojan.mlakar@siol.net', phone: '+386 41 800 900', source: 'import', status: 'converted', value: 1100, last_contacted_at: at(-210 * D), last_inbound_at: at(-200 * D), notes: 'Stranka iz 2025 — spletna stran za turistično kmetijo.' }],
      ['klara', { name: 'Klara Rozman', email: 'klara.rozman@gmail.com', source: 'import', status: 'converted', value: 850, last_contacted_at: at(-180 * D), last_inbound_at: at(-185 * D), notes: 'Lanska stranka — logotip in vizitke.' }],
      ['gregor', { name: 'Gregor Zajc', email: 'gregor@zajc-arhitekti.si', source: 'import', status: 'contacted', last_contacted_at: at(-150 * D), notes: 'Arhitekt, zanimal se je za portfolio stran.' }],
      ['urska', { name: 'Urška Lesjak', email: 'urska.lesjak@gmail.com', phone: '+386 40 908 070', source: 'form', status: 'new', service_requested: 'Spletna stran za psihoterapevtko', last_inbound_at: at(-26 * H), notes: 'Obrazec: »Potrebujem preprosto stran z opisom storitev in naročanjem na prvi posvet.«' }],
    ];
    for (const [k, l] of leads) L[k] = await sr.Lead.create({ ...base, consent_email: true, ...l });

    // 4) časovnica
    const acts = [
      ['marko', 'email_in', 'inbound', 'Povpraševanje: nova spletna stran', 'Pozdravljeni, za naše gradbeno podjetje potrebujemo novo spletno stran z referencami in obrazcem za povpraševanja. Lahko pošljete okvirno ponudbo?', -12 * D],
      ['marko', 'email_out', 'outbound', 'Re: Povpraševanje: nova spletna stran', 'Spoštovani g. Kos, hvala za povpraševanje. Predlagam kratek klic, da uskladimo obseg. Ali vam ustreza četrtek ob 10:00?', -11 * D],
      ['marko', 'call', 'outbound', 'Klic', 'Pogovor 20 min. Želi 3 jezike, galerijo projektov, obrazec. Proračun okoli 5.000 €. Pošljem ponudbo do petka.', -9 * D],
      ['marko', 'offer', 'internal', 'Pripravljena ponudba (4.800 €)', 'Spletna stran Gradnje Kos — 3 jeziki, reference, obrazec, SEO osnove.', -8 * D],
      ['marko', 'email_out', 'outbound', 'Ponudba za spletno stran', 'Spoštovani g. Kos, v prilogi pošiljam ponudbo. Na voljo sem za vprašanja.', -8 * D],
      ['marko', 'email_in', 'inbound', 'Re: Ponudba za spletno stran', 'Hvala. Ponudba je v redu, imam pa vprašanje glede vzdrževanja — je vključeno v ceno prvo leto?', -3 * H],
      ['ana', 'form', 'inbound', 'Povpraševanje prek obrazca na spletni strani', 'Zanima nas spletno naročanje pacientov, povezano z našim koledarjem.', -4 * D],
      ['ana', 'email_out', 'outbound', 'Spletno naročanje za vašo ordinacijo', 'Spoštovana dr. Zupan, hvala za zanimanje. Predlagam 30-minutni sestanek v ordinaciji.', -3 * D],
      ['ana', 'booking', 'internal', 'Termin potrjen', 'Sestanek v ordinaciji — predstavitev rešitve.', -1 * D],
      ['janez', 'chat', 'inbound', 'Kontakt iz spletnega klepeta', 'Rabim enostavno stran, kjer se vidijo kuhinje, ki smo jih naredili. Koliko bi to stalo?', -40 * 60e3],
      ['luka', 'system', 'internal', 'Faza: Termin → Stranka', '', -60 * D],
      ['luka', 'meeting', 'outbound', 'Sestanek', 'Mesečni pregled oglasov: CTR 4,1 %, 38 novih članov iz oglasov. Dogovor: poleti akcija za študente.', -9 * D],
      ['luka', 'note', 'internal', 'Opomba', 'Zelo zadovoljen. Primeren za Google oceno in referenco.', -9 * D],
      ['maja', 'email_in', 'inbound', 'Povpraševanje — spletna stran gostilne', 'Zanima nas prenova strani in možnost rezervacije mize prek spleta. Kakšna je okvirna cena?', -2 * H],
      ['rok', 'meeting', 'outbound', 'Sestanek', 'Spoznala na sejmu Narava-zdravje. Zanima ga spletno naročanje na servis.', -7 * D],
      ['rok', 'email_out', 'outbound', 'Predstavitev — spletno naročanje na servis', 'Spoštovani g. Kranjc, kot dogovorjeno pošiljam kratko predstavitev in primer.', -5 * D],
      ['sara', 'form', 'inbound', 'Povpraševanje prek obrazca', 'Koliko stane stran za frizerski salon?', -30 * D],
      ['sara', 'email_out', 'outbound', 'Ponudba za salon Bella', 'Spoštovana ga. Bella, pošiljam ponudbo za predstavitveno stran.', -28 * D],
      ['sara', 'system', 'internal', 'Faza: Kontaktirano → Izgubljeno', 'Izbrala cenejšo rešitev.', -20 * D],
      ['igor', 'email_in', 'inbound', 'Oglaševanje na Googlu', 'Pozdravljeni, radi bi bili višje na Googlu za »elektroinštalacije Celje«. Kaj predlagate?', -2 * D],
      ['igor', 'email_out', 'outbound', 'Re: Oglaševanje na Googlu', 'Spoštovani g. Horvat, predlagam kombinacijo SEO in oglasov. Ali se lahko dobimo jutri ob 14:00?', -25 * H],
      ['igor', 'email_in', 'inbound', 'Re: Oglaševanje na Googlu', 'Jutri ob 14:00 mi ustreza. Lep pozdrav, Igor', -26 * H],
      ['igor', 'booking', 'internal', 'Termin potrjen', 'Sestanek pri stranki, Celje.', -24 * H],
      ['eva', 'chat', 'inbound', 'Kontakt iz spletnega klepeta', 'Koliko stane manjša spletna trgovina (do 50 izdelkov)? Prodajam ročno izdelan nakit.', -5 * H],
      ['matej', 'form', 'inbound', 'Povpraševanje prek obrazca', 'Potrebujem osebno stran za fotografa s portfeljem.', -4 * D],
      ['matej', 'email_out', 'outbound', 'Predlog za vašo stran', 'Spoštovani g. Potočnik, pošiljam predlog in tri primere portfeljev.', -3 * D],
      ['nina', 'email_out', 'outbound', 'Predlog prenove', 'Spoštovana ga. Kovač, v prilogi predlog prenove vaše WordPress strani.', -3 * D],
      ['nina', 'email_in', 'inbound', 'Re: Predlog prenove', 'Hvala, predlog je super. Ali lahko začnemo konec meseca?', -20 * H],
      ['bojan', 'email_out', 'outbound', 'Spletna stran za turistično kmetijo — predaja', 'Stran je objavljena. Hvala za sodelovanje!', -210 * D],
      ['klara', 'email_out', 'outbound', 'Logotip — končne datoteke', 'Pošiljam končne datoteke logotipa in vizitk.', -180 * D],
      ['urska', 'form', 'inbound', 'Povpraševanje prek obrazca', 'Potrebujem preprosto stran z opisom storitev in naročanjem na prvi posvet.', -26 * H],
    ];
    for (const [k, type, direction, subject, content, off] of acts) {
      await sr.Activity.create({ ...base, lead_id: L[k].id, company_id: L[k].company_id || null, type, direction, subject, content, occurred_at: at(off), is_automated: ['email_in', 'form', 'chat'].includes(type) });
    }
    await sr.Activity.create({ ...base, company_id: C.pulz.id, type: 'note', direction: 'internal', subject: 'Opomba', content: 'Pogodba za vzdrževanje podaljšana do konca 2027.', occurred_at: at(-15 * D) });

    // 5) opravila
    const tasks = [
      ['marko', 'Odgovorite: Marko Kos (vzdrževanje v ceni?)', 'email', 'high', at(2 * H)],
      ['maja', 'Pošljite okvirno ceno Gostilni Pri Lipi', 'email', 'high', at(0, 16)],
      ['rok', 'Pokličite Roka Kranjca glede predstavitve', 'call', 'normal', at(-2 * D, 10)],
      ['nina', 'Potrdite začetek prenove z Nino Kovač', 'email', 'high', at(-1 * D, 9)],
      ['ana', 'Pripravite primerjavo sistemov za Smile', 'task', 'normal', at(1 * D, 9)],
      ['igor', 'Analiza ključnih besed za Elektro Horvat', 'task', 'normal', at(2 * D, 12)],
      ['luka', 'Prosite Luka Vidmarja za Google oceno', 'followup', 'low', at(3 * D, 9)],
      ['matej', 'Ponovni stik: Matej Potočnik', 'followup', 'normal', at(4 * D, 9)],
      ['eva', 'Pripravite paket za spletno trgovino (Eva Kralj)', 'task', 'normal', at(0, 13)],
      ['gregor', 'Ponovni stik z arhitektom Zajcem', 'followup', 'low', at(14 * D, 9)],
    ];
    for (const [k, title, type, priority, due_at] of tasks) await sr.Task.create({ ...base, lead_id: L[k].id, company_id: L[k].company_id || null, title, type, priority, due_at, status: 'open', source: k === 'marko' ? 'system' : 'manual' });
    for (const [k, title, off] of [['ana', 'Poslati predlog termina dr. Zupan', -3 * D], ['marko', 'Pripraviti ponudbo za Gradnje Kos', -8 * D], ['igor', 'Potrditi sestanek Elektro Horvat', -1 * D]]) {
      await sr.Task.create({ ...base, lead_id: L[k].id, company_id: L[k].company_id || null, title, type: 'task', priority: 'normal', due_at: at(off), status: 'done', done_at: at(off), source: 'manual' });
    }
    await sr.Task.create({ ...base, company_id: C.pulz.id, title: 'Mesečno poročilo oglasov za Fitnes Pulz', type: 'task', priority: 'normal', due_at: at(5 * D, 9), status: 'open', source: 'manual' });

    // 6) termini
    const bookings = [
      ['igor', at(0, 14), 60, 'Sestanek pri stranki, Celje — SEO in oglasi', 'confirmed'],
      ['ana', at(1 * D, 10), 45, 'Predstavitev spletnega naročanja v ordinaciji', 'confirmed'],
      ['marko', at(3 * D, 9), 30, 'Klic: dokončna potrditev ponudbe', 'confirmed'],
      ['luka', at(-9 * D, 11), 60, 'Mesečni pregled oglasov', 'completed'],
    ];
    for (const [k, booked_at, duration_minutes, notes, status] of bookings) await sr.ConfirmedBooking.create({ ...base, lead_id: L[k].id, booked_at, duration_minutes, notes, status });

    // 7) ponudbe
    const offers = [
      ['marko', C.kos.id, 'Gradnje Kos d.o.o.', 4800, 'sent', '# Ponudba: spletna stran Gradnje Kos\n\n- Trijezična stran (SLO/DE/EN)\n- Reference in galerija projektov\n- Obrazec za povpraševanja\n- Osnovni SEO\n\n**Skupaj: 4.800 € + DDV**'],
      ['ana', C.smile.id, 'Zobna ordinacija Smile d.o.o.', 2900, 'draft', '# Ponudba: spletno naročanje\n\n- Modul za naročanje pacientov\n- Povezava s koledarjem\n- Opomniki po SMS/e-pošti\n\n**Skupaj: 2.900 € + DDV**'],
      ['luka', C.pulz.id, 'Fitnes Pulz d.o.o.', 3600, 'accepted', '# Ponudba: letno vzdrževanje in oglaševanje\n\n- Vzdrževanje strani\n- Google in Meta oglasi\n\n**Skupaj: 290 €/mesec**'],
      ['sara', C.bella.id, 'Frizerski salon Bella s.p.', 900, 'rejected', '# Ponudba: predstavitvena stran\n\n**Skupaj: 900 € + DDV**'],
    ];
    for (const [k, company_id, client_name, amount, offer_status, md] of offers) {
      await sr.OfferGeneration.create({ ...base, lead_id: L[k].id, company_id, client_name, amount, offer_status, kind: 'full', input_method: 'form', status: 'completed', output_markdown: md, inputs_json: { stranka_naziv: client_name }, resolved_vars_json: { stranka_naziv: client_name, cena: String(amount) }, provider_used: 'platform_anthropic', model_used: 'demo', cost_eur: 0 });
    }

    // 8) prejeti računi (iz pošte)
    const month = new Date().toISOString().slice(0, 7);
    const invoices = [
      ['Telekom Slovenije d.d.', 'racuni@telekom.si', 'E-račun za september', 42.9, -4],
      ['Elektro energija d.o.o.', 'eracun@elektro-energija.si', 'Račun za električno energijo', 68.35, -3],
      ['Hosting Neoserv d.o.o.', 'billing@neoserv.si', 'Račun 2026-0912 — gostovanje', 119.0, -2],
      ['Adobe Systems', 'no-reply@adobe.com', 'Your Adobe invoice', 72.59, -2],
      ['Računovodstvo Bilanca d.o.o.', 'info@bilanca.si', 'Račun za računovodske storitve', 180.0, -1],
      ['Petrol d.d.', 'eracun@petrol.si', 'Mesečni račun Petrol Klub', 156.4, 0],
    ];
    for (const [supplier_name, from, subject, amount, dOff] of invoices) {
      const d = at(dOff * D).slice(0, 10);
      await sr.Invoice.create({ ...base, supplier_name, source_email_from: from, subject, amount, invoice_date: d, period: month, received_date: at(dOff * D), file_name: `${supplier_name.split(' ')[0].toLowerCase()}-${d}.pdf`, status: 'captured', source: 'email', message_id: `demo-${supplier_name}-${d}` });
    }

    // 9) kampanje
    const reactivation = await sr.Campaign.create({ ...base, name: 'Vrnite stare stranke — jesen', goal: 'reactivation', description: 'Strankam, ki se dolgo niso oglasile, pošlje prijazno sporočilo.', status: 'active', auto_send: false,
      audience: { stages: ['converted', 'contacted'], inactive_days: 120, sources: [], has_company: 'any', auto_enroll: true },
      steps: [
        { order: 1, delay_days: 0, subject: 'Že dolgo se nismo slišali', body: 'Spoštovani,\n\nže nekaj časa se nismo slišali. Ali vam lahko pri čem pomagamo — morda osvežitev strani pred novo sezono?', ai_personalize: true },
        { order: 2, delay_days: 7, subject: 'Kratek opomnik', body: 'Spoštovani,\n\nle kratek opomnik na prejšnje sporočilo. Za obstoječe stranke imamo ta mesec brezplačen pregled strani.', ai_personalize: true },
      ], last_run_at: at(-1 * H), stats: { enrolled: 3, active: 3, replied: 0 } });
    await sr.Campaign.create({ ...base, name: 'Novica: kaj je novega pri Spletnosti', goal: 'newsletter', description: 'Vsem strankam pošlje novico ali akcijo.', status: 'draft', auto_send: false,
      audience: { stages: ['converted'], inactive_days: 0, sources: [], has_company: 'any', auto_enroll: false },
      steps: [{ order: 1, delay_days: 0, subject: 'Novo: AI klepet za vašo spletno stran', body: 'Spoštovani,\n\nod tega meseca lahko na vašo stran dodamo AI klepet, ki strankam odgovarja tudi ponoči.\n\nZa vprašanja preprosto odgovorite na to sporočilo.', ai_personalize: false }] });
    const enrolls = [['bojan', 1, 'active', 6 * D], ['klara', 1, 'active', 6 * D], ['gregor', 0, 'active', 2 * H]];
    for (const [k, step, status, next] of enrolls) await sr.CampaignEnrollment.create({ ...base, campaign_id: reactivation.id, lead_id: L[k].id, current_step: step, status, next_send_at: at(next), last_sent_at: step ? at(-1 * D) : null });

    // 10) sporočila za odobritev
    const drafts = [
      ['maja', 'web_form_lead', 'Prenova strani in spletne rezervacije', 'Spoštovana ga. Golob,\n\nhvala za vaše povpraševanje. Prenova strani z možnostjo spletne rezervacije mize je zelo smiselna — gostje rezervirajo tudi zvečer, ko je gostilna zaprta.\n\nOkvirno se taka stran začne pri 1.200 € + DDV. Predlagam kratek 15-minutni klic, da vidim, kaj točno potrebujete. Vam ustreza četrtek dopoldne?', null, null, 9],
      ['marko', 'manual', 'Re: Ponudba za spletno stran', 'Spoštovani g. Kos,\n\nhvala za vprašanje. Da — prvo leto je vzdrževanje (posodobitve, varnostne kopije, manjši popravki) vključeno v ceno. Od drugega leta naprej je 39 € na mesec.\n\nČe vam ustreza, lahko začnemo že naslednji teden.', null, null, 9],
      ['janez', 'chatbot_handoff', 'Spletna stran za vaše mizarstvo', 'Spoštovani g. Novak,\n\nhvala, da ste se nam oglasili preko spletnega klepeta. Stran z galerijo kuhinj in obrazcem za ponudbo je odlična izbira — fotografije prodajajo same.\n\nPredlagam kratek klic, kjer pogledava, koliko izdelkov želite pokazati. Kdaj vam ustreza?', null, null, 8],
      ['bojan', 'campaign', 'Že dolgo se nismo slišali', 'Pozdravljeni, g. Mlakar,\n\nže nekaj časa se nismo slišali. Kako kaj kmetija? Pred novo turistično sezono je dober čas za osvežitev strani — nove fotografije, cenik, rezervacije.\n\nČe vas zanima, preprosto odgovorite na to sporočilo.', reactivation.id, 1, 8],
    ];
    for (const [k, pillar, subject, b, campaign_id, campaign_step, q] of drafts) {
      await sr.DraftMessage.create({ ...base, lead_id: L[k].id, pillar, channel: 'email', subject, body: b, status: 'pending', quality_score: q, ai_model_used: 'demo', ai_reasoning: 'Testni podatki.', scheduled_at: at(0), ...(campaign_id ? { campaign_id, campaign_step } : {}) });
    }
    // poslana sporočila (zgodovina v Za odobritev → Poslano)
    for (const [k, subject, off] of [['igor', 'Re: Oglaševanje na Googlu', -25 * H], ['nina', 'Predlog prenove', -3 * D], ['matej', 'Predlog za vašo stran', -3 * D]]) {
      await sr.DraftMessage.create({ ...base, lead_id: L[k].id, pillar: 'manual', channel: 'email', subject, body: '(testno sporočilo)', status: 'sent', sent_at: at(off), quality_score: 8, ai_model_used: 'demo', reviewer_notes: 'Testni podatki: sporočilo ni bilo zares poslano.' });
    }

    return Response.json({ success: true, removed, companies: companies.length, leads: leads.length, activities: acts.length + 1, tasks: tasks.length + 4, bookings: bookings.length, offers: offers.length, invoices: invoices.length, drafts: drafts.length + 3 });
  } catch (error) {
    return Response.json({ error: 'seedCrmDemo: ' + (error?.message || String(error)) });
  }
});
