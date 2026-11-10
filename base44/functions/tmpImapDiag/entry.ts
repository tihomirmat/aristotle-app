// ZAČASNO: diagnostika povezave IMAP/SMTP (brez prijave). Izbriši po uporabi.
const tm = (p, ms, label) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout ' + label)), ms))]);

async function probe(host, port, tls) {
  const t0 = Date.now();
  let conn;
  try {
    conn = await tm(tls ? Deno.connectTls({ hostname: host, port }) : Deno.connect({ hostname: host, port }), 8000, 'connect');
    const tConn = Date.now() - t0;
    const buf = new Uint8Array(512);
    const n = await tm(conn.read(buf), 8000, 'greeting');
    return { host, port, tls, connectMs: tConn, totalMs: Date.now() - t0, greeting: new TextDecoder().decode(buf.subarray(0, n || 0)).slice(0, 160) };
  } catch (e) { return { host, port, tls, ms: Date.now() - t0, error: e?.message }; }
  finally { try { conn?.close(); } catch { /* */ } }
}

Deno.serve(async () => {
  const out = await Promise.all([
    probe('mail.spletnost.si', 993, true), probe('mail.spletnost.si', 143, false),
    probe('mail.spletnost.si', 587, false), probe('mail.spletnost.si', 465, true),
  ]);
  return Response.json(out);
});
