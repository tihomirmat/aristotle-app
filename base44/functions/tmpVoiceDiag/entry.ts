// Začasna diagnostika ElevenLabs dovoljenj (brez porabe kreditov). Izbriši po uporabi.
Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  if (body.s !== '8f066c60297b86ffaadfe5afdac85128') return Response.json({ error: 'no' }, { status: 401 });
  const KEY = Deno.env.get('ELEVENLABS_API_KEY') || '';
  const VID = Deno.env.get('ELEVENLABS_VOICE_ID') || '21m00Tcm4TlvDq8ikWAM';
  const form = new FormData(); form.append('model_id', 'scribe_v2'); form.append('file', new Blob([new Uint8Array(1200)], { type: 'audio/webm' }), 'x.webm');
  const sttR = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': KEY }, body: form });
  const ttsR = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VID}`, { method: 'POST', headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: '', model_id: 'eleven_v3' }) });
  return Response.json({ stt: { status: sttR.status, body: (await sttR.text()).slice(0, 300) }, tts: { status: ttsR.status, body: (await ttsR.text()).slice(0, 300) } });
});
