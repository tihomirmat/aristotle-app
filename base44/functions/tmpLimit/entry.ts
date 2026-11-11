import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
// ZAČASNO: kontroliran preizkus — 260 zapisov, koliko jih vrne filter brez meje / z mejo. Na koncu vse izbriše.
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  if (body.key !== 'lim-5521') return Response.json({ error: 'no' });
  const sr = base44.asServiceRole.entities;
  const BID = 'tmp-limit-test';
  const out = {};
  try {
    const recs = Array.from({ length: 260 }, (_, i) => ({ business_id: BID, list_id: 'tmp', email: `t${i}@example.com`, status: 'ok', owner_email: 'tmp@example.com' }));
    for (let i = 0; i < recs.length; i += 130) await sr.ListContact.bulkCreate(recs.slice(i, i + 130));
    out.none = (await sr.ListContact.filter({ business_id: BID })).length;
    out.l100 = (await sr.ListContact.filter({ business_id: BID }, '-created_date', 100)).length;
    out.l1000 = (await sr.ListContact.filter({ business_id: BID }, '-created_date', 1000)).length;
    out.l5000 = (await sr.ListContact.filter({ business_id: BID }, '-created_date', 5000)).length;
    out.skip200 = (await sr.ListContact.filter({ business_id: BID }, '-created_date', 500, 200)).length;
  } catch (e) { out.err = e?.message || String(e); }
  // čiščenje
  try {
    let left = await sr.ListContact.filter({ business_id: BID }, '-created_date', 5000);
    let guard = 0;
    while (left.length && guard++ < 10) {
      for (let i = 0; i < left.length; i += 20) await Promise.all(left.slice(i, i + 20).map((r) => sr.ListContact.delete(r.id).catch(() => null)));
      left = await sr.ListContact.filter({ business_id: BID }, '-created_date', 5000);
    }
    out.leftAfterCleanup = left.length;
  } catch (e) { out.cleanupErr = e?.message || String(e); }
  return Response.json(out);
});
