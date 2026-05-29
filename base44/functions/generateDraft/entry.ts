import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

// ─── Plast 1: ARISTOTLE PERSONA ───────────────────────────────────────────────
const ARISTOTLE_PERSONA = `Ti si AI Aristotle, digitalni asistent za male podjetnike v Sloveniji. Pravila: spoštljivo vikanje povsod (vi, vam, vas, vaš). Topel, profesionalen, brez prodajnih trikov. Brez Nujno!, Samo še danes!, Ne zamudite!. Brez VELIKIH ČRK v telesu. Brez emojijev v formalnih panogah (dental_medspa, auto, home_services, marketing_services). Max 1 emoji v sproščenih panogah (gym, restaurant, salon_barber). Telo pod 120 besedami. Brez anglicizmov (Hej→Pozdravljeni). Pozdrav: Spoštovani {ime} (moški) ali Spoštovana {ime} (ženska). Zaključek: Lep pozdrav, {business.name}. Nikoli ne navajaj cen razen če current_offer pove ceno. Nikoli ne dodaj odjavne povezave v body — backend doda v footer.`;

// ─── Plast 2: SLOVENE STYLE GUIDE ────────────────────────────────────────────
const SLOVENE_STYLE_GUIDE = `1) Sklanjatve: Ana→Spoštovana Ana, Tomaž→Spoštovani Tomaž, z g./ga.: Spoštovani g. Krajnc / Spoštovana ga. Novak. 2) Črke: ohrani č/š/ž/ć (Tomaž ne Tomaz). 3) Števila: decimalka vejica "35,50 €", tisočni pika "1.000 €", valuta za številko "49 €". 4) Datumi: "20. maj 2026" (mala črka mesec) ali "20. 5. 2026". 5) Čas 24-urni: 14:30, 9:00. 6) Dnevi/meseci mala začetnica. 7) Vikanje plural za oba spola: ste prejeli, vam pošiljamo. 8) "ki" namesto "kateri" kjer možno. 9) "vaš" mala začetnica. 10) Telefoni z razmaki: "+386 40 555 111".`;

// ─── Plast 4: Pillar prompts ──────────────────────────────────────────────────
const PILLAR_PROMPTS = {
  reactivation: `REACTIVATION_AGENT: Generiraj reaktivacijski email. Korak 1: mehko brez prodaje. Korak 2 (+7 dni): omeni current_offer kot info. Korak 3 (+14 dni): zadnji vljudni poskus. Prilagodi ton glede na industry_template (gym motivacijsko, dental strokovno mirno, restaurant toplo, salon prijazno, auto tehnično, marketing partnersko, home praktično, other nevtralno). IZHOD JSON: {"subject": "(4-8 besed)", "body_text": "(brez subject/podpisa/footer)", "ai_reasoning": "..."}`,

  review_request: `REVIEW_REQUEST_AGENT: Vljudna prošnja za Google oceno. Korak 1: iskrena zahvala + link. Korak 2 (+7 dni): krajši opomnik. Struktura: zahvala 1-2 stavka, razlog 1-2 stavka, link "Oceno lahko oddate tukaj: {google_review_link}". Nikoli nagrade za oceno, ne reci "Pričakujemo 5 zvezdic". IZHOD JSON: {"subject": "(3-6 besed)", "body_text": "...", "ai_reasoning": "..."}`,

  web_form_lead: `LEAD_NURTURE_AGENT: Hiter prvi odgovor novemu leadu (form/chatbot). Korak 1 takoj: zahvala, parafraziraj lead.notes, konkretni naslednji korak, telefon. Korak 2 (+2 dni): vljuden opomnik. Korak 3 (+7 dni): zadnji "če se kasneje pojavi potreba". Nikoli "v 24 urah", uporabi "v naslednjih delovnih dneh". Če lead.source=chatbot dodaj "Hvala, da ste se nam oglasili preko spletnega klepeta". IZHOD JSON: {"subject": "(3-6 besed)", "body_text": "(pod 130 besed)", "ai_reasoning": "..."}`,

  chatbot_handoff: `LEAD_NURTURE_AGENT: Hiter prvi odgovor novemu leadu (form/chatbot). Korak 1 takoj: zahvala, parafraziraj lead.notes, konkretni naslednji korak, telefon. Nikoli "v 24 urah", uporabi "v naslednjih delovnih dneh". Dodaj "Hvala, da ste se nam oglasili preko spletnega klepeta". IZHOD JSON: {"subject": "(3-6 besed)", "body_text": "(pod 130 besed)", "ai_reasoning": "..."}`,

  booking_proposal: `BOOKING_AI_AGENT: Email s 3 termini iz available_slots (backend pošlje, ti ne računaš). Korak 1: zahvala, omemba storitve, 3 bullet termini iz label polja, vprašanje "Kateri ustreza?", alternativa "Če noben, predlagajte vi". Korak 2 (+1 dan): krajši opomnik. Prilagodi (dental "termini za pregled", gym "termini za trening", salon "termini za striženje", auto "termini za servis", home "termin za obisk", restaurant "rezervacija mize"). IZHOD JSON: {"subject": "(4-7 besed)", "body_text": "...", "proposed_slots_summary": "...", "ai_reasoning": "..."}`,

  referral_ask: `Napiši kratko e-pošto, ki zadovoljno stranko prosi, da priporoči podjetje prijateljem. V slovenščini, vikanje. Kratko, prijazno (3 stavki). IZHOD JSON: {"subject": "(3-5 besed)", "body_text": "...", "ai_reasoning": "..."}`,
};

const QUALITY_REVIEWER_PROMPT = `Pregled v 7 točkah: 1)slovnica (sklanjatve, vikanje, č/š/ž), 2)oblikovanje (35,50 €, 1.000 €, "20. maj", 14:30), 3)ton (brez "NUJNO!", VELIKIH ČRK, emojiji glede na panogo), 4)personalizacija (merge tokeni izpolnjeni, "vaš" mala), 5)struktura (pozdrav+vejica+prazna+telo+Lep pozdrav), 6)subject (pod 50 znakov, brez !!!), 7)brez odjavne povezave v body. Score 7+ approved=true, sicer revised verzije. IZHOD JSON: {"approved": true/false, "quality_score": 1-10, "issues_found": [], "revised_subject": "...", "revised_body": "...", "reviewer_notes": "..."}`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { business_id, lead_id, pillar, sequence_step = 1, available_slots } = body;

    if (!pillar || !lead_id || !business_id) {
      return Response.json({ error: 'Manjkajoči parametri: pillar, lead_id, business_id' }, { status: 400 });
    }

    const [businesses, leads] = await Promise.all([
      base44.asServiceRole.entities.Business.filter({ id: business_id }),
      base44.asServiceRole.entities.Lead.filter({ id: lead_id }),
    ]);
    const business = businesses[0];
    const lead = leads[0];
    if (!business) return Response.json({ error: 'Podjetje ni najdeno' }, { status: 404 });
    if (!lead) return Response.json({ error: 'Stranka ni najdena' }, { status: 404 });

    // ─── TRIAL GATE: per-business credit cap ─────────────────────────────────
    if (business.subscription_status === 'trialing') {
      const used = business.trial_cost_used_eur || 0;
      const cap = business.trial_cost_cap_eur || 0.45;
      if (used >= cap) {
        return Response.json(
          { error: 'Brezplačni krediti za preizkus so porabljeni. Aktivirajte naročnino za nadaljevanje.', code: 'TRIAL_CREDITS_EXHAUSTED' },
          { status: 402 }
        );
      }
      // Global monthly org budget (only blocks trialing)
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      const allLogs = await base44.asServiceRole.entities.UsageLog.filter({ is_demo: false });
      const monthTotal = allLogs
        .filter((l) => l.date >= monthStart && l.date <= monthEnd)
        .reduce((s, l) => s + (l.cost_eur || 0), 0);
      const MONTHLY_BUDGET = parseFloat(Deno.env.get('MONTHLY_LLM_BUDGET_EUR') || '100');
      if (monthTotal >= MONTHLY_BUDGET) {
        return Response.json(
          { error: 'Sistem je trenutno zaseden. Poskusite znova čez nekaj minut.', code: 'MONTHLY_TRIAL_BUDGET_REACHED' },
          { status: 503 }
        );
      }
    }

    // ─── MODEL SELECTION — force haiku during trial ───────────────────────────
    const modelMap = { haiku: 'claude-haiku-4-5', sonnet: 'claude-sonnet-4-5', opus: 'claude-opus-4-5' };
    const effectiveModelKey = business.subscription_status === 'trialing' ? 'haiku' : (business.anthropic_model || 'haiku');
    const primaryModel = modelMap[effectiveModelKey] || 'claude-haiku-4-5';

    // ─── Plast 3: Tenant brand voice ─────────────────────────────────────────
    const brandVoiceLayer = [
      business.brand_voice ? `GLAS ZNAMKE: ${business.brand_voice}` : '',
      business.tone_preset ? `TON PRESET: ${business.tone_preset}` : '',
      business.example_good_messages?.length ? `PRIMERI DOBRIH SPOROČIL:\n${business.example_good_messages.map(m => `Subject: ${m.subject}\nBody: ${m.body}\nZakaj dobro: ${m.why_good}`).join('\n---\n')}` : '',
      business.example_bad_messages?.length ? `PRIMERI SLABIH SPOROČIL (izogni se):\n${business.example_bad_messages.map(m => `Subject: ${m.subject}\nBody: ${m.body}\nZakaj slabo: ${m.why_bad}`).join('\n---\n')}` : '',
    ].filter(Boolean).join('\n\n');

    const systemPrompt = [
      `## PLAST 1 – ARISTOTLE PERSONA\n${ARISTOTLE_PERSONA}`,
      `## PLAST 2 – SLOVENE STYLE GUIDE\n${SLOVENE_STYLE_GUIDE}`,
      brandVoiceLayer ? `## PLAST 3 – GLAS ZNAMKE\n${brandVoiceLayer}` : '',
      `## PLAST 4 – PILLAR AGENT\n${PILLAR_PROMPTS[pillar] || PILLAR_PROMPTS.reactivation}`,
      `VRNI ZGOLJ ČIST JSON BREZ MARKDOWN OGRAJ.`,
    ].filter(Boolean).join('\n\n');

    const userPayload = {
      business: {
        name: business.name,
        industry_template: business.industry_template,
        phone: business.phone,
        services: business.services,
        current_offer: business.current_offer,
        google_review_link: business.google_review_link,
        booking_hours_start: business.booking_hours_start,
        booking_hours_end: business.booking_hours_end,
      },
      lead: {
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        notes: lead.notes,
        source: lead.source,
        status: lead.status,
        tags: lead.tags,
      },
      sequence_step,
      available_slots: available_slots || [],
    };

    // ─── Klic 1: Primary AI Draft ─────────────────────────────────────────────
    const t1Start = Date.now();
    const primaryRes = await anthropic.messages.create({
      model: primaryModel,
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: JSON.stringify(userPayload) }],
    });
    const t1Ms = Date.now() - t1Start;
    const primaryText = primaryRes.content[0].text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    let draftData = {};
    try { draftData = JSON.parse(primaryText); } catch { draftData = { subject: 'Sporočilo', body_text: primaryText, ai_reasoning: '' }; }

    const tokensIn1 = primaryRes.usage?.input_tokens || 0;
    const tokensOut1 = primaryRes.usage?.output_tokens || 0;
    const cost1 = (tokensIn1 * 0.000003) + (tokensOut1 * 0.000015);

    // ─── Klic 2: Quality Reviewer (Haiku) ────────────────────────────────────
    const reviewPayload = {
      subject: draftData.subject || '',
      body_text: draftData.body_text || '',
      industry: business.industry_template,
      lead_name: lead.name,
    };
    const t2Start = Date.now();
    const reviewRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 800,
      system: QUALITY_REVIEWER_PROMPT + '\nVRNI ZGOLJ ČIST JSON BREZ MARKDOWN OGRAJ.',
      messages: [{ role: 'user', content: JSON.stringify(reviewPayload) }],
    });
    const reviewText = reviewRes.content[0].text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    let reviewData = { approved: true, quality_score: 7, issues_found: [], revised_subject: draftData.subject, revised_body: draftData.body_text, reviewer_notes: '' };
    try { reviewData = { ...reviewData, ...JSON.parse(reviewText) }; } catch { /* keep defaults */ }

    const tokensIn2 = reviewRes.usage?.input_tokens || 0;
    const tokensOut2 = reviewRes.usage?.output_tokens || 0;
    const cost2 = (tokensIn2 * 0.00000025) + (tokensOut2 * 0.00000125);

    const qualityScore = reviewData.quality_score || 7;
    const draftStatus = qualityScore < 6 ? 'flagged_for_review' : 'pending';

    // ─── Shrani DraftMessage ─────────────────────────────────────────────────
    const draft = await base44.asServiceRole.entities.DraftMessage.create({
      business_id,
      lead_id,
      pillar,
      channel: 'email',
      subject: reviewData.revised_subject || draftData.subject || 'Sporočilo',
      body: reviewData.revised_body || draftData.body_text || '',
      status: draftStatus,
      ai_model_used: primaryModel,
      quality_score: qualityScore,
      ai_reasoning: draftData.ai_reasoning || '',
      reviewer_notes: reviewData.reviewer_notes || '',
      scheduled_at: new Date().toISOString(),
    });

    // ─── Beleži UsageLog + trial cost increment ───────────────────────────────
    const today = new Date().toISOString().split('T')[0];
    const totalCost = cost1 + cost2;
    await Promise.all([
      base44.asServiceRole.entities.UsageLog.create({
        business_id,
        date: today,
        pillar,
        feature: pillar,
        model: primaryModel,
        input_tokens: tokensIn1,
        output_tokens: tokensOut1,
        cost_eur: cost1,
        is_demo: false,
      }),
      base44.asServiceRole.entities.UsageLog.create({
        business_id,
        date: today,
        pillar: pillar + '_review',
        feature: pillar,
        subfeature: 'review',
        model: 'claude-haiku-4-5',
        input_tokens: tokensIn2,
        output_tokens: tokensOut2,
        cost_eur: cost2,
        is_demo: false,
      }),
    ]);

    // Increment trial cost if trialing
    if (business.subscription_status === 'trialing' && totalCost > 0) {
      await base44.asServiceRole.entities.Business.update(business_id, {
        trial_cost_used_eur: (business.trial_cost_used_eur || 0) + totalCost,
      });
    }

    return Response.json({ success: true, draft, quality_score: qualityScore, approved: reviewData.approved, issues: reviewData.issues_found });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});