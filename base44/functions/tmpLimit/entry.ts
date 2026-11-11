import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
// ZAČASNO: koliko zapisov vrne filter brez meje in z mejo (samo štetje, brez podatkov).
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  if (body.key !== 'lim-5521') return Response.json({ error: 'no' });
  const sr = base44.asServiceRole.entities;
  const out = {};
  for (const [name, lim] of [['none', undefined], ['l200', 200], ['l1000', 1000], ['l5000', 5000]]) {
    try { out[name] = (lim ? await sr.UsageLog.filter({}, '-created_date', lim) : await sr.UsageLog.filter({})).length; } catch (e) { out[name] = 'ERR ' + (e?.message || e); }
  }
  try { out.skip = (await sr.UsageLog.filter({}, '-created_date', 500, 500)).length; } catch (e) { out.skip = 'ERR ' + (e?.message || e); }
  const b = (await sr.Business.filter({ id: '69fdc32dd7a14b17ffa223d1' }))[0];
  out.passwordFieldsStored = { smtp_pass: !!b?.smtp_pass, imap_pass: !!b?.imap_pass, looksEncrypted: /^enc:|^v1:/.test(String(b?.smtp_pass || '')) };
  return Response.json(out);
});
