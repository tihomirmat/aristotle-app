Deno.serve(async () => {
  const out = {};
  for (const d of ['spletnost.si', 'gmail.com', 'neobstaja-xyz-12345.si', 'siol.net']) {
    try { out[d] = await Deno.resolveDns(d, 'MX'); } catch (e) { out[d] = 'ERR ' + (e?.name || '') + ' ' + (e?.message || e); }
  }
  try { out.a = await Deno.resolveDns('neobstaja-xyz-12345.si', 'A'); } catch (e) { out.a = 'ERR ' + e?.name; }
  return Response.json(out);
});
