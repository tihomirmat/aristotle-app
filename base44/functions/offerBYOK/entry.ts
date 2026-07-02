import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';

async function encryptBYOK(plaintext) {
  const encKeyB64 = Deno.env.get('OFFERS_BYOK_ENCRYPTION_KEY');
  if (!encKeyB64) throw new Error('OFFERS_BYOK_ENCRYPTION_KEY ni nastavljen');
  const encKeyBytes = Uint8Array.from(atob(encKeyB64), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey('raw', encKeyBytes, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
  return btoa(JSON.stringify({
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
  }));
}

async function decryptBYOK(encryptedData) {
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

async function testAnthropicKey(apiKey, model) {
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({ model, max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] });
  return !!res.content;
}

async function testOpenAIKey(apiKey, model) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'OpenAI napaka');
  return true;
}

async function testGoogleKey(apiKey, model) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'Hi' }] }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Google napaka');
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action, business_id, provider, api_key, model } = body;

    if (!business_id) return Response.json({ error: 'Manjkajoči parametri' }, { status: 400 });

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: business_id });
    const business = businesses[0];
    if (!business) return Response.json({ error: 'Podjetje ni najdeno' }, { status: 404 });

    if (action === 'save') {
      if (!provider || !api_key || !model) {
        return Response.json({ error: 'Vsi parametri so obvezni: provider, api_key, model' }, { status: 400 });
      }
      const encrypted = await encryptBYOK(api_key);
      const last4 = api_key.slice(-4);
      await base44.asServiceRole.entities.Business.update(business_id, {
        offers_byok_provider: provider,
        offers_byok_key_encrypted: encrypted,
        offers_byok_model: model,
        offers_byok_verified_at: null,
        offers_byok_last_error: null,
      });
      return Response.json({ success: true, last4 });
    }

    if (action === 'test') {
      const biz = (await base44.asServiceRole.entities.Business.filter({ id: business_id }))[0];
      if (!biz?.offers_byok_key_encrypted) {
        return Response.json({ error: 'Ni shranjenega ključa' }, { status: 400 });
      }
      const decrypted = await decryptBYOK(biz.offers_byok_key_encrypted);
      const testModel = biz.offers_byok_model;
      const prov = biz.offers_byok_provider;
      try {
        if (prov === 'anthropic') await testAnthropicKey(decrypted, testModel);
        else if (prov === 'openai') await testOpenAIKey(decrypted, testModel);
        else if (prov === 'google') await testGoogleKey(decrypted, testModel);

        await base44.asServiceRole.entities.Business.update(business_id, {
          offers_byok_verified_at: new Date().toISOString(),
          offers_byok_last_error: null,
        });
        await base44.asServiceRole.entities.BYOKAuditLog.create({ business_id, user_id: user.id, provider: prov, endpoint: 'test', success: true, created_by: biz.created_by });
        return Response.json({ success: true, verified_at: new Date().toISOString() });
      } catch (err) {
        await base44.asServiceRole.entities.Business.update(business_id, {
          offers_byok_verified_at: null,
          offers_byok_last_error: err.message,
        });
        await base44.asServiceRole.entities.BYOKAuditLog.create({ business_id, user_id: user.id, provider: prov, endpoint: 'test', success: false, error: err.message, created_by: biz.created_by });
        return Response.json({ error: err.message }, { status: 400 });
      }
    }

    if (action === 'remove') {
      await base44.asServiceRole.entities.Business.update(business_id, {
        offers_byok_provider: null,
        offers_byok_key_encrypted: null,
        offers_byok_model: null,
        offers_byok_verified_at: null,
        offers_byok_last_error: null,
      });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Neznana akcija' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});