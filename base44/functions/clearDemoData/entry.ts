import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { business_id } = await req.json();
  if (!business_id) return Response.json({ error: 'business_id required' }, { status: 400 });

  const db = base44.asServiceRole;
  const filter = { business_id, is_demo: true };

  const entities = ['Lead', 'DraftMessage', 'KnowledgeBase', 'ChatbotConversation', 'AssistantChat', 'AssistantBriefing', 'BookingProposal', 'ConfirmedBooking', 'ExecutiveDigest'];

  let totalDeleted = 0;
  for (const entityName of entities) {
    const records = await db.entities[entityName].filter(filter);
    await Promise.all(records.map((r) => db.entities[entityName].delete(r.id)));
    totalDeleted += records.length;
  }

  return Response.json({ success: true, deleted: totalDeleted });
});