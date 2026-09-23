import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Briše demo podatke SAMO za podano podjetje; kliče ga lahko le lastnik podjetja ali admin.
const ownsBusiness = (user, business) => {
  if (!user || !business) return false;
  if (user.role === 'admin') return true;
  return business.created_by_id === user.id
    || (!!user.email && business.created_by === user.email)
    || (!!user.email && !!business.owner_email && business.owner_email === user.email);
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { business_id } = body;
    if (!business_id) return Response.json({ error: 'business_id required' }, { status: 400 });

    const db = base44.asServiceRole;
    const businesses = await db.entities.Business.filter({ id: business_id });
    const business = businesses[0];
    if (!business) return Response.json({ error: 'Podjetje ni najdeno' }, { status: 404 });
    if (!ownsBusiness(user, business)) return Response.json({ error: 'Nimate dostopa do tega podjetja.', code: 'FORBIDDEN' }, { status: 403 });

    // Briše SAMO demo zapise TEGA podjetja (business_id + is_demo)
    const filter = { business_id, is_demo: true };
    const entities = ['Lead', 'DraftMessage', 'KnowledgeBase', 'ChatbotConversation', 'AssistantChat', 'AssistantBriefing', 'BookingProposal', 'ConfirmedBooking', 'ExecutiveDigest'];

    let totalDeleted = 0;
    for (const entityName of entities) {
      const records = await db.entities[entityName].filter(filter);
      const own = records.filter((r) => r.business_id === business_id && r.is_demo === true);
      await Promise.all(own.map((r) => db.entities[entityName].delete(r.id)));
      totalDeleted += own.length;
    }

    return Response.json({ success: true, deleted: totalDeleted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
