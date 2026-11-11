import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Glas za Asistenta (ElevenLabs): govor → besedilo (Scribe) in besedilo → govor (Eleven v3, podpira slovenščino).
// action transcribe { business_id, audio (base64), mime } → { text }
// action speak { business_id, text } → { audio (base64 mp3) }
// Ključ: secret ELEVENLABS_API_KEY; glas: ELEVENLABS_VOICE_ID (neobvezno).

const VERSION = 'voice-2026-11-11b';
// Ključ brez dovoljenja (ElevenLabs → API Keys → Restrict key) vrne 401 missing_permissions.
const permError = (status, raw, what) => (status === 401 && /missing_permissions|missing the permission/i.test(raw)
  ? `Glasovni ${what} ni na voljo: ključ ElevenLabs nima dovoljenja »${what === 'vnos' ? 'Speech to Text' : 'Text to Speech'}«.`
  : status === 401 ? 'Ključ ElevenLabs ni veljaven.' : status === 402 || /quota|credits/i.test(raw) ? 'Na računu ElevenLabs ni več kreditov.' : null);
const KEY = Deno.env.get('ELEVENLABS_API_KEY') || '';
const VOICE_ID = Deno.env.get('ELEVENLABS_VOICE_ID') || '21m00Tcm4TlvDq8ikWAM';
const API = 'https://api.elevenlabs.io/v1';
const ownsBusiness = (user, b) => !!user && !!b && (user.role === 'admin' || b.created_by_id === user.id
  || (!!user.email && (b.created_by === user.email || b.owner_email === user.email)));

const b64ToBytes = (b64) => Uint8Array.from(atob(String(b64).replace(/^data:[^,]*,/, '')), (c) => c.charCodeAt(0));
function bytesToB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
// Besedilo za branje: brez markdowna, povezav in seznamov z zvezdicami.
const speakable = (t) => String(t || '')
  .replace(/```[\s\S]*?```/g, '')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/https?:\/\/\S+/g, '')
  .replace(/^#+\s*/gm, '').replace(/[*_`>#]/g, '').replace(/^\s*[-•]\s+/gm, '')
  .replace(/\n{2,}/g, '\n').trim().slice(0, 700); // branje stane ~1 kredit na znak → največ ~700

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized', version: VERSION }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const business = body.business_id ? (await base44.asServiceRole.entities.Business.filter({ id: body.business_id }))[0] : null;
    if (!business || !ownsBusiness(user, business)) return Response.json({ error: 'Nimate dostopa do tega podjetja.', version: VERSION });
    if (body.action === 'status') return Response.json({ success: true, enabled: !!KEY, version: VERSION });
    if (!KEY) return Response.json({ error: 'Glasovni vnos še ni vklopljen.', code: 'NO_KEY', version: VERSION });

    if (body.action === 'transcribe') {
      const bytes = b64ToBytes(body.audio || '');
      if (bytes.length < 800) return Response.json({ error: 'Posnetek je prekratek. Držite gumb in govorite.', version: VERSION });
      if (bytes.length > 3_000_000) return Response.json({ error: 'Posnetek je predolg.', version: VERSION });
      const mime = String(body.mime || 'audio/webm');
      const form = new FormData();
      form.append('model_id', 'scribe_v2');
      form.append('language_code', body.language || 'sl');
      form.append('file', new Blob([bytes], { type: mime }), `posnetek.${mime.includes('mp4') ? 'mp4' : mime.includes('ogg') ? 'ogg' : 'webm'}`);
      const r = await fetch(`${API}/speech-to-text`, { method: 'POST', headers: { 'xi-api-key': KEY }, body: form });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { const raw = JSON.stringify(j); return Response.json({ error: permError(r.status, raw, 'vnos') || `Prepis ni uspel (${r.status}).`, detail: raw.slice(0, 300), version: VERSION }); }
      return Response.json({ success: true, text: String(j.text || '').trim(), language: j.language_code, version: VERSION });
    }

    if (body.action === 'speak') {
      const text = speakable(body.text);
      if (!text) return Response.json({ error: 'Ni besedila za branje.', version: VERSION });
      const r = await fetch(`${API}/text-to-speech/${VOICE_ID}?output_format=mp3_44100_64`, {
        method: 'POST', headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: 'eleven_v3', language_code: 'sl' }),
      });
      if (!r.ok) { const t = await r.text().catch(() => ''); return Response.json({ error: permError(r.status, t, 'odgovor') || `Branje ni uspelo (${r.status}).`, detail: t.slice(0, 300), version: VERSION }); }
      return Response.json({ success: true, audio: bytesToB64(new Uint8Array(await r.arrayBuffer())), version: VERSION });
    }
    return Response.json({ error: 'Neznano dejanje.', version: VERSION });
  } catch (error) {
    return Response.json({ error: 'Glas: ' + (error?.message || String(error)), version: VERSION });
  }
});
