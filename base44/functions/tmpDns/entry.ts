Deno.serve(async () => {
  const out = {};
  for (const d of ['spletnost.si', 'gmail.com', 'neobstaja-xyz-12345.si', 'siol.net']) {
    try {
      const t = Date.now();
      const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${d}&type=MX`, { headers: { accept: 'application/dns-json' } });
      const j = await r.json();
      out[d] = { ms: Date.now() - t, Status: j.Status, mx: (j.Answer || []).map((a) => a.data) };
    } catch (e) { out[d] = 'ERR ' + (e?.message || e); }
  }
  return Response.json(out);
});
