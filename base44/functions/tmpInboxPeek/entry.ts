import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { imapConnect, imapDate } from '../../shared/imap.js';

// ZAČASNO: zadnja sporočila v predalu (samo UID, pošiljatelj, zadeva, datum). Izbriši po uporabi.
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const b = (await base44.asServiceRole.entities.Business.filter({ id: '69fdc32dd7a14b17ffa223d1' }))[0];
  const c = await imapConnect({ host: b.imap_host, port: 993, user: b.imap_user, pass: b.imap_pass });
  await c.select('INBOX');
  const uids = (await c.uidSearch(`SINCE ${imapDate(new Date(Date.now() - 86400000))}`)).slice(-6);
  const msgs = await c.uidFetchSource(uids);
  await c.logout();
  const h = (src, k) => (String(src).slice(0, 8000).match(new RegExp(`^${k}: (.*)$`, 'mi')) || [])[1] || '';
  return Response.json({ now: new Date().toISOString(), last_uid: b.imap_last_uid, last_sync: b.imap_last_sync_at, msgs: msgs.map((m) => ({ uid: m.uid, from: h(m.source, 'From'), subject: h(m.source, 'Subject'), date: h(m.source, 'Date'), size: m.source.length })) });
});
