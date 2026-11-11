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
  return Response.json({ keyLen: KEY.length, vidLen: VID.length, sub, hist, voice: voice && { status: voice.status, body: voice.body.slice(0, 400) }, usage });
});
