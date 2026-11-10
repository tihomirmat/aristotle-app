import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ZAČASNO: zakaj crmEvents ni samodejno odobril osnutka kampanje. Izbriši po uporabi.
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole.entities;
  const d = (await sr.DraftMessage.filter({ id: '6af39e30e2d8ecd4925d035f' }))[0];
  const b = (await sr.Business.filter({ id: d.business_id }))[0];
  const c = (await sr.Campaign.filter({ id: d.campaign_id }))[0];
  let r;
  try { r = await base44.asServiceRole.functions.invoke('crmEvents', { args: { entity: 'DraftMessage' }, data: d, event: { type: 'create' } }); r = r?.data ?? r; }
  catch (e) { r = { err: e?.message, data: e?.response?.data }; }
  return Response.json({ sub: b?.subscription_status, camp_auto: c?.auto_send, camp_found: !!c, draft_status: d.status, crm: r });
});
