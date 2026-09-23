import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

// Varna base64 pretvorba (String.fromCharCode(...bytes) vrže napako pri datotekah > ~125 KB)
function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(binary);
}

// ─── Skupna avtorizacija / entitlements (kopija v vsaki funkciji — Base44 funkcije nimajo skupnih modulov) ───
const ownsBusiness = (user, business) => {
  if (!user || !business) return false;
  if (user.role === 'admin') return true;
  return business.created_by_id === user.id
    || (!!user.email && business.created_by === user.email)
    || (!!user.email && !!business.owner_email && business.owner_email === user.email);
};
const isTrialActive = (b) => b?.subscription_status === 'trialing' && !!b.trial_ends_at && new Date(b.trial_ends_at) > new Date();
const isTrialExpired = (b) => b?.subscription_status === 'trialing' && !!b.trial_ends_at && new Date(b.trial_ends_at) <= new Date();
// Enako kot src/lib/entitlements.js: aktiven trial odpre vse module, sicer mora biti pillar_* = true
const hasModule = (b, pillarKey) => !!b && (isTrialActive(b) || b[pillarKey] === true);

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
    if (!ownsBusiness(user, business)) return Response.json({ error: 'Nimate dostopa do tega podjetja.', code: 'FORBIDDEN' }, { status: 403 });
    if (isTrialExpired(business) || !hasModule(business, 'pillar_offers')) {
      return Response.json({ error: 'Modul Generator ponudb ni aktiven. Aktivirajte ga v Nastavitve → Naročnina.', code: 'MODULE_LOCKED' }, { status: 402 });
    }

    let extractedValues = {};

    // Image OCR via Anthropic vision
    if (['jpg', 'jpeg', 'png', 'image'].includes(file_type?.toLowerCase())) {
      const imageRes = await fetch(file_url);
      const imageBuffer = await imageRes.arrayBuffer();
      if (imageBuffer.byteLength > 20 * 1024 * 1024) return Response.json({ error: 'Datoteka je prevelika (največ 20 MB).' }, { status: 400 });
      const base64 = bytesToBase64(new Uint8Array(imageBuffer));
      const mediaType = file_type?.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg';

      const response = await anthropic.messages.create({
        model: 'claude-opus-4-5',
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
        model: 'claude-opus-4-5',
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