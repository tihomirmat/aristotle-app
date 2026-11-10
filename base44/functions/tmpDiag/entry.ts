import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ZAČASNO: pošlji odobrena testna sporočila kampanje (2 kosa). Izbriši po uporabi.
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const out = [];
  for (const id of ['6af39e2182551be23a251a0f', '6af39e162557134a9b4ba0f7']) {
    try { const r = await base44.asServiceRole.functions.invoke('sendApprovedDraft', { data: { id } }); out.push({ id, r: r?.data ?? r }); }
    catch (e) { out.push({ id, err: e?.message, data: e?.response?.data }); }
  }
  return Response.json(out);
});
