import tls from 'node:tls';
import net from 'node:net';
import { ImapFlow } from 'npm:imapflow@1.0.164';

// ZAČASNO: diagnostika povezave IMAP (brez prave prijave). Izbriši po uporabi.
function greet(host, port, secure) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const done = (r) => { try { s.destroy(); } catch { /* */ } resolve({ host, port, secure, ms: Date.now() - t0, ...r }); };
    const s = secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
    const timer = setTimeout(() => done({ error: 'timeout 8s' }), 8000);
    s.once('data', (d) => { clearTimeout(timer); done({ greeting: String(d).slice(0, 140) }); });
    s.once('error', (e) => { clearTimeout(timer); done({ error: e?.message }); });
  });
}

async function flow(host, port) {
  const t0 = Date.now();
  const c = new ImapFlow({ host, port, secure: port === 993, auth: { user: 'diag-nobody@spletnost.si', pass: 'x' }, logger: false, connectionTimeout: 9000, greetingTimeout: 9000 });
  c.on('error', () => {});
  try {
    await Promise.race([c.connect(), new Promise((_, r) => setTimeout(() => r(new Error('timeout 15s')), 15000))]);
    return { flow: `${host}:${port}`, ok: true, ms: Date.now() - t0 };
  } catch (e) { return { flow: `${host}:${port}`, ms: Date.now() - t0, message: e?.message, responseText: e?.responseText, authFailed: e?.authenticationFailed }; }
  finally { try { c.close(); } catch { /* */ } }
}

Deno.serve(async () => {
  const g = await Promise.all([greet('mail.spletnost.si', 993, true), greet('mail.spletnost.si', 143, false)]);
  const f = await Promise.all([flow('mail.spletnost.si', 993), flow('mail.spletnost.si', 143)]);
  return Response.json({ g, f });
});
