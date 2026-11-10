import { ImapFlow as Old } from 'npm:imapflow@1.0.164';
import { ImapFlow as New } from 'npm:imapflow@1.7.8';

// ZAČASNO: diagnostika IMAP knjižnice (brez prave prijave). Izbriši po uporabi.
async function flow(Cls, label, port) {
  const t0 = Date.now(); const log = [];
  const L = (lvl) => (o) => log.push(`${lvl}:${o?.msg || ''}${o?.err ? ' ' + o.err.message : ''}`.slice(0, 120));
  const c = new Cls({ host: 'mail.spletnost.si', port, secure: port === 993, auth: { user: 'diag-nobody@spletnost.si', pass: 'x' },
    logger: { debug: L('d'), info: L('i'), warn: L('w'), error: L('e') }, connectionTimeout: 9000, greetingTimeout: 9000 });
  c.on('error', () => {});
  try {
    await Promise.race([c.connect(), new Promise((_, r) => setTimeout(() => r(new Error('timeout 14s')), 14000))]);
    return { label, port, ok: true, ms: Date.now() - t0 };
  } catch (e) { return { label, port, ms: Date.now() - t0, message: e?.message, responseText: e?.responseText, authFailed: e?.authenticationFailed, log: log.slice(-8) }; }
  finally { try { c.close(); } catch { /* */ } }
}

Deno.serve(async () => Response.json(await Promise.all([flow(Old, 'old', 993), flow(New, 'new', 993), flow(New, 'new', 143)])));
