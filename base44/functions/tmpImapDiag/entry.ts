import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ZAČASNO: zažene syncInbox za podjetje Spletnost d.o.o. in vrne povzetek (brez vsebine sporočil). Izbriši po uporabi.
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const r = await base44.asServiceRole.functions.invoke('syncInbox', { business_id: '69fdc32dd7a14b17ffa223d1', internal_secret: Deno.env.get('INTERNAL_FUNCTION_SECRET') });
    return Response.json(r?.data ?? r);
  } catch (e) { return Response.json({ error: e?.message, data: e?.response?.data }); }
});
