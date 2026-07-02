import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { pillar, lead_id, business_id } = body;

    if (!pillar || !lead_id || !business_id) {
      return Response.json({ error: 'Manjkajoči parametri: pillar, lead_id, business_id' }, { status: 400 });
    }

    // Pridobi podatke o podjetju in stranki
    const businesses = await base44.entities.Business.filter({ id: business_id });
    const business = businesses[0];
    if (!business) return Response.json({ error: 'Podjetje ni najdeno' }, { status: 404 });

    const leads = await base44.entities.Lead.filter({ id: lead_id });
    const lead = leads[0];
    if (!lead) return Response.json({ error: 'Stranka ni najdena' }, { status: 404 });

    const PILLAR_PROMPTS = {
      reactivation: `Napiši kratko prijazno e-poštno sporočilo za reaktivacijo stranke, ki že dlje časa ni obiskala podjetja.
Sporočilo naj bo:
- V slovenščini, vikanje
- Toplo, osebno, brez splošnih fraz
- Kratko (3–5 stavkov)
- Vključuj ime stranke: ${lead.name}
- Omeni podjetje: ${business.name}
- Panoga: ${business.industry_template || 'storitve'}
- Ponudba: ${business.current_offer || 'posebna ponudba za stalne stranke'}
- NE vključuj generičnih fraz kot "Upamo, da ste dobro"`,

      review_request: `Napiši kratko e-poštno sporočilo, ki stranko vabi, da pusti Google oceno.
- Slovenščina, vikanje
- Ime stranke: ${lead.name}
- Podjetje: ${business.name}
- Google ocena povezava: ${business.google_review_link || '(dodajte v nastavitvah)'}
- Kratko in direktno (2–4 stavki)
- Zahvala za obisk`,

      web_form_lead: `Napiši e-pošto za novo stranko, ki je izpolnila spletni obrazec.
- Slovenščina, vikanje
- Ime: ${lead.name}
- Podjetje: ${business.name}
- Storitve: ${business.services || 'naše storitve'}
- Cilj: potrditev prejema in povabilo na pogovor/termin`,

      referral_ask: `Napiši kratko e-pošto, ki zadovoljno stranko prosi, da priporoči podjetje prijateljem.
- Slovenščina, vikanje  
- Ime: ${lead.name}
- Podjetje: ${business.name}
- Kratko, prijazno (3 stavki)`,
    };

    const promptText = PILLAR_PROMPTS[pillar] || PILLAR_PROMPTS.reactivation;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `${promptText}

Vrni JSON z:
- subject: zadeva e-pošte (kratka, privlačna, v slovenščini)
- body: besedilo e-pošte (brez "Zadeva:", brez HTML, samo navadni tekst z odstavki)`,
      response_json_schema: {
        type: 'object',
        properties: {
          subject: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['subject', 'body'],
      },
    });

    // Shrani osnutek
    const draft = await base44.asServiceRole.entities.DraftMessage.create({
      business_id: business_id,
      lead_id: lead_id,
      pillar: pillar,
      channel: 'email',
      subject: result.subject,
      body: result.body,
      status: 'pending',
      ai_model_used: 'haiku',
      scheduled_at: new Date().toISOString(),
      created_by: business.created_by,
      owner_email: business.owner_email || business.created_by,
    });

    return Response.json({ success: true, draft });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});