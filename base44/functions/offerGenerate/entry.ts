import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

function pickModel(business, kind) {
  if (business.subscription_status === 'trialing') {
    return { provider: 'platform_anthropic', model: 'claude-opus-4-7' };
  }
  if (business.offers_byok_provider && business.offers_byok_verified_at) {
    return { provider: 'byok_' + business.offers_byok_provider, model: business.offers_byok_model };
  }
  if (kind === 'full' && (business.offers_free_generations_used || 0) < 5) {
    return { provider: 'platform_anthropic', model: 'claude-opus-4-7' };
  }
  if (kind === 'improvement' && (business.offers_free_improvements_used || 0) < 10) {
    return { provider: 'platform_anthropic', model: 'claude-opus-4-7' };
  }
  throw new Error('BYOK_REQUIRED');
}

async function callLLM(business, provider, model, systemPrompt, userMsg) {
  if (provider === 'platform_anthropic' || provider === 'byok_anthropic') {
    const apiKey = provider === 'platform_anthropic'
      ? Deno.env.get('ANTHROPIC_API_KEY')
      : await decryptBYOK(business.offers_byok_key_encrypted);
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model,
      max_tokens: 6000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMsg }],
    });
    return { text: res.content[0].text, tokensIn: res.usage?.input_tokens || 0, tokensOut: res.usage?.output_tokens || 0 };
  }
  if (provider === 'byok_openai') {
    const apiKey = await decryptBYOK(business.offers_byok_key_encrypted);
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 6000, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }] }),
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    return { text, tokensIn: data.usage?.prompt_tokens || 0, tokensOut: data.usage?.completion_tokens || 0 };
  }
  if (provider === 'byok_google') {
    const apiKey = await decryptBYOK(business.offers_byok_key_encrypted);
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt + '\n\n' + userMsg }] }] }),
    });
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const tokensIn = data.usageMetadata?.promptTokenCount || 0;
    const tokensOut = data.usageMetadata?.candidatesTokenCount || 0;
    return { text, tokensIn, tokensOut };
  }
  throw new Error('Unknown provider: ' + provider);
}

async function decryptBYOK(encryptedData) {
  if (!encryptedData) throw new Error('Ni BYOK ključa');
  const encKeyB64 = Deno.env.get('OFFERS_BYOK_ENCRYPTION_KEY');
  if (!encKeyB64) throw new Error('OFFERS_BYOK_ENCRYPTION_KEY ni nastavljen');
  const encKeyBytes = Uint8Array.from(atob(encKeyB64), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey('raw', encKeyBytes, 'AES-GCM', false, ['decrypt']);
  const parsed = JSON.parse(atob(encryptedData));
  const iv = Uint8Array.from(atob(parsed.iv), c => c.charCodeAt(0));
  const data = Uint8Array.from(atob(parsed.data), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
  return new TextDecoder().decode(decrypted);
}

function markdownToHtml(markdown, vars) {
  let html = markdown;
  // Replace variables
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      html = html.replaceAll(`{{${k}}}`, String(v || ''));
    }
  }
  // Basic markdown conversion
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  html = html.replace(/\n\n/g, '</p><p>');
  return `<html><body style="font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 40px;color:#333;line-height:1.6"><p>${html}</p></body></html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { business_id, template_id, kind = 'full', resolved_vars, input_method = 'form', parent_id, section_to_improve } = body;

    if (!business_id) return Response.json({ error: 'Manjkajoči parametri' }, { status: 400 });

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: business_id });
    const business = businesses[0];
    if (!business) return Response.json({ error: 'Podjetje ni najdeno' }, { status: 404 });

    // ─── Gates ────────────────────────────────────────────────────────────────
    const isTrialing = business.subscription_status === 'trialing';
    const hasByok = business.offers_byok_provider && business.offers_byok_verified_at;

    if (kind === 'full' && !isTrialing && !hasByok && (business.offers_free_generations_used || 0) >= 5) {
      return Response.json({ error: 'Brezplačna kvota 5 ponudb je porabljena.', code: 'OFFERS_FREE_QUOTA_REACHED' }, { status: 402 });
    }
    if (kind === 'improvement' && !isTrialing && !hasByok && (business.offers_free_improvements_used || 0) >= 10) {
      return Response.json({ error: 'Brezplačna kvota 10 izboljšav je porabljena.', code: 'OFFERS_IMPROVEMENTS_QUOTA_REACHED' }, { status: 402 });
    }

    let { provider, model } = pickModel(business, kind);

    // Load template if provided
    let template = null;
    if (template_id) {
      const templates = await base44.asServiceRole.entities.OfferTemplate.filter({ id: template_id });
      template = templates[0];
    }

    const globalVars = business.offers_global_vars || {};
    const templateVars = (template?.variables || []).reduce((acc, v) => { if (v.default) acc[v.key] = v.default; return acc; }, {});
    const mergedVars = { ...globalVars, ...templateVars, ...(resolved_vars || {}) };

    // Build prompt
    const systemPrompt = `Ti si strokovnjak za pisanje poslovnih ponudb v slovenščini. Generiraj profesionalno, strukturirano ponudbo na podlagi template-a in podatkov. Vrni JSON z:
{
  "output_markdown": "Celotna ponudba v Markdown formatu z razrešenimi spremenljivkami",
  "improvements_suggested": [
    { "section": "Ime sekcije", "before": "Obstoječe besedilo", "after": "Predlagano izboljšano besedilo", "rationale": "Razlog za izboljšavo" }
  ]
}
VRNI ZGOLJ ČIST JSON BREZ MARKDOWN OGRAJ.`;

    const templateBody = template?.body_markdown || 'Ustvari profesionalno ponudbo za naslednje podatke:';
    const userMsg = JSON.stringify({
      kind,
      template_body: kind === 'improvement' ? section_to_improve : templateBody,
      resolved_vars: mergedVars,
      business_context: { name: business.name, services: business.services, phone: business.phone },
    });

    const { text, tokensIn, tokensOut } = await callLLM(business, provider, model, systemPrompt, userMsg);

    let result = { output_markdown: text, improvements_suggested: [] };
    try {
      const clean = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
      result = JSON.parse(clean);
    } catch { /* use raw text */ }

    // Cost calc (only for platform)
    const isPlatform = provider === 'platform_anthropic';
    const costEur = isPlatform ? (tokensIn * 0.000015) + (tokensOut * 0.000075) : 0;

    // Create OfferGeneration record
    const generation = await base44.asServiceRole.entities.OfferGeneration.create({
      business_id,
      template_id: template_id || null,
      kind,
      input_method,
      inputs_json: resolved_vars || {},
      resolved_vars_json: mergedVars,
      output_markdown: result.output_markdown || text,
      improvements_suggested: result.improvements_suggested || [],
      model_used: model,
      provider_used: provider,
      cost_eur: costEur,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      status: 'completed',
      parent_id: parent_id || null,
      created_by: business.created_by,
    });

    // Update counters and costs
    const updates = {};
    if (isPlatform) {
      if (kind === 'full') updates.offers_free_generations_used = (business.offers_free_generations_used || 0) + 1;
      if (kind === 'improvement') updates.offers_free_improvements_used = (business.offers_free_improvements_used || 0) + 1;
      if (isTrialing && costEur > 0) updates.trial_cost_used_eur = (business.trial_cost_used_eur || 0) + costEur;
    }
    if (Object.keys(updates).length > 0) {
      await base44.asServiceRole.entities.Business.update(business_id, updates);
    }

    // UsageLog
    const today = new Date().toISOString().split('T')[0];
    await base44.asServiceRole.entities.UsageLog.create({
      business_id,
      date: today,
      pillar: 'offers',
      feature: 'offers',
      subfeature: kind,
      model,
      input_tokens: tokensIn,
      output_tokens: tokensOut,
      cost_eur: costEur,
      is_demo: false,
      created_by: business.created_by,
    });

    // BYOK audit log
    if (!isPlatform) {
      await base44.asServiceRole.entities.BYOKAuditLog.create({
        business_id,
        user_id: user.id,
        provider: business.offers_byok_provider,
        endpoint: 'generate_offer',
        success: true,
        created_by: business.created_by,
      });
    }

    return Response.json({ success: true, generation_id: generation.id, output_markdown: result.output_markdown || text, improvements_suggested: result.improvements_suggested || [] });
  } catch (error) {
    const code = error.message === 'BYOK_REQUIRED' ? 'BYOK_REQUIRED' : undefined;
    return Response.json({ error: error.message, code }, { status: code ? 402 : 500 });
  }
});