import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Skupna avtorizacija / entitlements (kopija v vsaki funkciji — Base44 funkcije nimajo skupnih modulov) ───
const isTrialActive = (b) => b?.subscription_status === 'trialing' && !!b.trial_ends_at && new Date(b.trial_ends_at) > new Date();
const isTrialExpired = (b) => b?.subscription_status === 'trialing' && !!b.trial_ends_at && new Date(b.trial_ends_at) <= new Date();
// Enako kot src/lib/entitlements.js: aktiven trial odpre vse module, sicer mora biti pillar_* = true
const hasModule = (b, pillarKey) => !!b && (isTrialActive(b) || b[pillarKey] === true);

// Javni endpoint (kliče ga vdelani chatbot widget na spletnih straneh strank) → CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (data, status = 200) => Response.json(data, { status, headers: corsHeaders });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { business_id, visitor_id, conversation_id } = body;
    const message = String(body.message || '').trim().slice(0, 1000); // omejitev dolžine (zloraba / stroški)

    if (!business_id || !message) {
      return json({ error: 'Manjkajoči parametri' }, 400);
    }

    // Pridobi podatke o podjetju
    const businesses = await base44.asServiceRole.entities.Business.filter({ id: business_id });
    const business = businesses[0];
    if (!business) return json({ error: 'Podjetje ni najdeno' }, 404);

    // Modul Klepet mora biti aktiven (trial ali kupljen) — sicer vljuden odgovor brez LLM klica
    if (isTrialExpired(business) || !hasModule(business, 'pillar_chatbot')) {
      const fallback = `Spletni klepet trenutno ni na voljo. Pokličite nas na ${business.phone || 'našo telefonsko številko'}${business.website ? ` ali obiščite ${business.website}` : ''}.`;
      return json({ response: fallback, conversation_id: conversation_id || null, escalated: false, booking_intent: false, module_locked: true });
    }

    // Pridobi bazo znanja
    const kbDocs = await base44.asServiceRole.entities.KnowledgeBase.filter({ business_id, active: true });
    const knowledgeContext = kbDocs.map(d => `## ${d.title}\n${d.content}`).join('\n\n');

    // Pridobi ali ustvari pogovor
    let conversation;
    if (conversation_id) {
      const convs = await base44.asServiceRole.entities.ChatbotConversation.filter({ id: conversation_id });
      conversation = convs[0];
      if (conversation && conversation.business_id !== business_id) conversation = undefined; // pogovor mora pripadati podjetju
    }

    const allMessages = conversation?.messages || [];
    if (allMessages.length >= 60) {
      return json({ response: 'Ta pogovor je dosegel največjo dolžino. Za nadaljevanje nas prosim pokličite ali pišite po e-pošti.', conversation_id: conversation.id, escalated: false, booking_intent: false });
    }
    const messages = allMessages.slice(-20); // kontekst za LLM: zadnjih 20 sporočil
    const conversationHistory = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));

    // Sestavi prompt
    const systemPrompt = `Si prijazen in profesionalen pomočnik za podjetje "${business.name}".
${business.industry_template ? `Panoga: ${business.industry_template}` : ''}
${business.services ? `Storitve: ${business.services}` : ''}
${business.hours ? `Delovni čas: ${business.hours}` : ''}
${business.address ? `Naslov: ${business.address}` : ''}
${business.phone ? `Telefon: ${business.phone}` : ''}
${business.website ? `Spletna stran: ${business.website}` : ''}
${business.current_offer ? `Trenutna ponudba: ${business.current_offer}` : ''}

BAZA ZNANJA:
${knowledgeContext || 'Ni posebnih dokumentov.'}

NAVODILA:
- Odgovarjaj SAMO v slovenščini, vikaj stranko
- Bodi jedrnat in prijazen
- Če ne poznaš odgovora, predlagi, da stranka pokliče ali pošlje e-pošto
- Če stranka izrazi interes za termin ali storitev, jo vprašaj za ime in email
- Nikoli ne izmišljuj informacij, ki niso v bazi znanja`;

    const fullPrompt = `${systemPrompt}

ZGODOVINA POGOVORA:
${conversationHistory.map(m => `${m.role === 'user' ? 'Stranka' : 'Pomočnik'}: ${m.content}`).join('\n')}

Stranka: ${message}
Pomočnik:`;

    const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: fullPrompt,
    });

    const aiResponse = typeof aiResult === 'string' ? aiResult : aiResult?.text || aiResult?.content || 'Oprostite, trenutno ne morem odgovoriti. Pokličite nas na ' + (business.phone || 'naši telefonski številki') + '.';

    // Posodobi sporočila
    const updatedMessages = [
      ...allMessages,
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: aiResponse, timestamp: new Date().toISOString() },
    ];

    // Zaznaj eskalacijo (ključne besede)
    const escalationKeywords = ['pritožba', 'škoda', 'sodišče', 'odvetnik', 'grozim', 'razjezen', 'skandal'];
    const shouldEscalate = escalationKeywords.some(k => message.toLowerCase().includes(k));

    // Zaznaj booking intent
    const bookingKeywords = ['termin', 'rezervacija', 'naročiti', 'naročim', 'kdaj', 'prosta mesta', 'appointment'];
    const hasBookingIntent = bookingKeywords.some(k => message.toLowerCase().includes(k));

    // Shrani / posodobi pogovor
    let savedConversation;
    if (conversation) {
      savedConversation = await base44.asServiceRole.entities.ChatbotConversation.update(conversation.id, {
        messages: updatedMessages,
        escalated: shouldEscalate || conversation.escalated,
        status: shouldEscalate ? 'escalated' : conversation.status,
      });
    } else {
      savedConversation = await base44.asServiceRole.entities.ChatbotConversation.create({
        business_id,
        visitor_id: visitor_id || `anon_${Date.now()}`,
        messages: updatedMessages,
        status: shouldEscalate ? 'escalated' : 'active',
        escalated: shouldEscalate,
        started_at: new Date().toISOString(),
        created_by: business.created_by,
        owner_email: business.owner_email || business.created_by, // owner visibility via RLS data.owner_email
      });
    }

    // Beleženje porabe (Base44 InvokeLLM — cena ni znana, beležimo klic za pregled v Admin → Poraba)
    base44.asServiceRole.entities.UsageLog.create({
      business_id,
      date: new Date().toISOString().split('T')[0],
      pillar: 'chatbot',
      feature: 'chatbot',
      subfeature: 'respond',
      model: 'base44-invokellm',
      input_tokens: 0,
      output_tokens: 0,
      cost_eur: 0,
      is_demo: false,
    }).catch(() => {});

    return json({
      response: aiResponse,
      conversation_id: savedConversation.id,
      escalated: shouldEscalate,
      booking_intent: hasBookingIntent,
    });
  } catch (error) {
    return json({ error: 'Napaka pri obdelavi sporočila.' }, 500);
  }
});