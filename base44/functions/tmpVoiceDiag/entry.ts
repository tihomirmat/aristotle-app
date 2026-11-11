// Začasna diagnostika ElevenLabs (samo branje, brez stroškov). Izbriši po uporabi.
Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  if (body.s !== '8f066c60297b86ffaadfe5afdac85128') return Response.json({ error: 'no' }, { status: 401 });
  const KEY = Deno.env.get('ELEVENLABS_API_KEY') || '';
  const VID = Deno.env.get('ELEVENLABS_VOICE_ID') || '';
  const g = async (p) => { const r = await fetch('https://api.elevenlabs.io' + p, { headers: { 'xi-api-key': KEY } }); const t = await r.text(); return { status: r.status, body: t.slice(0, 3000) }; };
  const sub = await g('/v1/user/subscription');
  const hist = await g('/v1/history?page_size=10');
  const voice = VID ? await g('/v1/voices/' + VID) : null;
  const now = Math.floor(Date.now() / 1000);
  const q = (b) => g(`/v1/usage/character-stats?start_unix=${(now - 86400 * 2) * 1000}&end_unix=${now * 1000}&aggregation_interval=hour&breakdown_type=${b}`);
  const usage = { product: await q('product_type'), model: await q('model'), keys: await q('all_api_keys'), resource: await q('resource') };
  // Dovoljenja: neveljaven (prazen) posnetek in prazno besedilo — brez porabe kreditov.
  const form = new FormData(); form.append('model_id', 'scribe_v2'); form.append('file', new Blob([new Uint8Array(1200)], { type: 'audio/webm' }), 'x.webm');
  const sttR = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': KEY }, body: form });
  const stt = { status: sttR.status, body: (await sttR.text()).slice(0, 400) };
  const ttsR = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VID || '21m00Tcm4TlvDq8ikWAM'}`, { method: 'POST', headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: '', model_id: 'eleven_v3' }) });
  const tts = { status: ttsR.status, body: (await ttsR.text()).slice(0, 400) };
  if (body.only === 'perm') return Response.json({ stt, tts });
  return Response.json({ keyLen: KEY.length, vidLen: VID.length, sub, hist, voice: voice && { status: voice.status, body: voice.body.slice(0, 400) }, usage });
});
