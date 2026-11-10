import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { imapConnect, imapDate, findSentBox } from '../../shared/imap.js';

// ZAČASNO: ali so testna sporočila v mapi Poslano in v prejetih (samo zadeve). Izbriši po uporabi.
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const b = (await base44.asServiceRole.entities.Business.filter({ id: '69fdc32dd7a14b17ffa223d1' }))[0];
  const c = await imapConnect({ host: b.imap_host, port: 993, user: b.imap_user, pass: b.imap_pass });
  const res = {};
  const subj = (buf) => (String(buf).match(/^Subject: (.*)$/mi) || [])[1] || '';
  const to = (buf) => (String(buf).match(/^To: (.*)$/mi) || [])[1] || '';
  for (const box of [findSentBox(await c.list())?.path, 'INBOX']) {
    if (!box) continue;
    await c.select(box);
    const uids = (await c.uidSearch(`SINCE ${imapDate(new Date(Date.now() - 86400000))}`)).slice(-6);
    const msgs = await c.uidFetchSource(uids);
    res[box] = msgs.map((m) => `${to(m.source).slice(0, 60)} | ${subj(m.source).slice(0, 80)}`);
  }
  await c.logout();
  return Response.json(res);
});
