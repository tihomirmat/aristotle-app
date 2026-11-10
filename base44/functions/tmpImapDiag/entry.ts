import { ImapFlow } from 'npm:imapflow@1.0.164';

// ZAČASNO: diagnostika povezave IMAP (brez pravih podatkov). Izbriši po uporabi.
Deno.serve(async () => {
  const out = [];
  for (const [host, port] of [['mail.spletnost.si', 993], ['mail.spletnost.si', 143]]) {
    const t0 = Date.now();
    const c = new ImapFlow({ host, port, secure: port === 993, auth: { user: 'diag-nobody@spletnost.si', pass: 'x' }, logger: false, connectionTimeout: 9000, greetingTimeout: 9000 });
    try { await c.connect(); out.push({ host, port, ok: true, ms: Date.now() - t0 }); await c.logout().catch(() => {}); }
    catch (e) { out.push({ host, port, ms: Date.now() - t0, message: e?.message, responseText: e?.responseText, code: e?.code, authFailed: e?.authenticationFailed, serverResponseCode: e?.serverResponseCode }); try { c.close(); } catch { /* */ } }
  }
  return Response.json(out);
});
