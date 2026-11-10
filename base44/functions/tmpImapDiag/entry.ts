import { imapConnect } from '../../shared/imap.js';

// ZAČASNO: preizkus lastnega IMAP odjemalca z napačnim geslom (pričakovana napaka »auth«). Izbriši po uporabi.
async function t(port) {
  const t0 = Date.now();
  try { const c = await imapConnect({ host: 'mail.spletnost.si', port, user: 'diag-nobody@spletnost.si', pass: 'x' }); await c.logout(); return { port, ok: true, ms: Date.now() - t0 }; }
  catch (e) { return { port, ms: Date.now() - t0, auth: !!e.auth, timeout: !!e.timeout, message: e.message }; }
}
Deno.serve(async () => Response.json(await Promise.all([t(993), t(143)])));
