import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { business_id, visitor_id, message, conversation_id } = body;

    if (!business_id || !message) {
      return Response.json({ error: 'Manjkajoči parametri' }, { status: 400 });
    }

    // Pridobi podatke o podjetju
    const businesses = await base44.asServiceRole.entities.Business.filter({ id: business_id });
    const business = businesses[0];
    if (!business) return Response.json({ error: 'Podjetje ni najdeno' }, { status: 404 });

    // Pridobi bazo znanja
    const kbDocs = await base44.asServiceRole.entities.KnowledgeBase.filter({ business_id, active: true });
    const knowledgeContext = kbDocs.map(d => `## ${d.title}\n${d.content}`).join('\n\n');

    // Pridobi ali ustvari pogovor
    let conversation;
    if (conversation_id) {
      const convs = await base44.asServiceRole.entities.ChatbotConversation.filter({ id: conversation_id });
      conversation = convs[0];
    }

    const messages = conversation?.messages || [];
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
      ...messages,
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
      });
    }

    return Response.json({
      response: aiResponse,
      conversation_id: savedConversation.id,
      escalated: shouldEscalate,
      booking_intent: hasBookingIntent,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});