import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { imapConnect, imapDate } from '../../shared/imap.js';

// ZAČASNO: diagnostika branja predala za eno podjetje (ne vrača gesel ne vsebine). Izbriši po uporabi.
Deno.serve(async (req) => {
  const steps = []; const t0 = Date.now(); const s = (x) => steps.push(`${Date.now() - t0}ms ${x}`);
  let c = null;
  try {
    const base44 = createClientFromRequest(req);
    const b = (await base44.asServiceRole.entities.Business.filter({ id: '69fdc32dd7a14b17ffa223d1' }))[0];
    s(`host=${b.imap_host} port=${b.imap_port} user=${b.imap_user} pass=${b.imap_pass ? 'yes' : 'no'}`);
    c = await imapConnect({ host: b.imap_host, port: Number(b.imap_port) || 993, user: b.imap_user, pass: b.imap_pass });
    s('login ok');
    await c.select('INBOX'); s('select ok');
    const uids = await c.uidSearch(`SINCE ${imapDate(new Date(Date.now() - 7 * 86400000))}`); s(`search ${uids.length}`);
    const last = uids.slice(-3);
    const sizes = await c.uidSizes(last); s(`sizes ${JSON.stringify([...sizes])}`);
    const f = await c.uidFetchSource(last); s(`fetched ${f.map((m) => `${m.uid}:${m.source.length}`).join(',')}`);
    const boxes = await c.list(); s(`boxes ${boxes.map((x) => x.path + (x.flags.includes('\\Sent') ? '*' : '')).join('|').slice(0, 300)}`);
    await c.logout(); s('logout');
  } catch (e) { s(`ERROR ${e?.message} auth=${!!e?.auth} timeout=${!!e?.timeout}`); try { c?.close(); } catch { /* */ } }
  return Response.json(steps);
});
