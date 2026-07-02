import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { business_id, file_url, file_type, variables } = body;

    if (!business_id || !file_url) {
      return Response.json({ error: 'Manjkajoči parametri' }, { status: 400 });
    }

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: business_id });
    const business = businesses[0];
    if (!business) return Response.json({ error: 'Podjetje ni najdeno' }, { status: 404 });

    let extractedValues = {};

    // Image OCR via Anthropic vision
    if (['jpg', 'jpeg', 'png', 'image'].includes(file_type?.toLowerCase())) {
      const imageRes = await fetch(file_url);
      const imageBuffer = await imageRes.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
      const mediaType = file_type?.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg';

      const response = await anthropic.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: `Ekstrahiraj vrednosti iz te slike za naslednje spremenljivke: ${JSON.stringify(variables || [])}. Vrni JSON objekt z vrednostmi. ZGOLJ JSON brez markdown ograj.` },
          ],
        }],
      });
      const text = response.content[0].text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
      try { extractedValues = JSON.parse(text); } catch { extractedValues = {}; }
    }

    // Text paste → LLM extraction
    if (file_type === 'paste' || file_type === 'transcript') {
      const textContent = file_url; // for paste, file_url contains the text
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 2000,
        system: 'Ekstrahiraj vrednosti iz besedila za podane spremenljivke. Vrni JSON objekt. ZGOLJ JSON brez markdown ograj.',
        messages: [{ role: 'user', content: `Spremenljivke: ${JSON.stringify(variables || [])}\n\nBesedilo:\n${textContent.substring(0, 4000)}` }],
      });
      const text = response.content[0].text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
      try { extractedValues = JSON.parse(text); } catch { extractedValues = {}; }
    }

    return Response.json({ success: true, extracted_values: extractedValues });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});