import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { syncCampaignMailboxesFor } from '../../shared/campaignSync.js';

// Bere predale za e-poštne kampanje (odbita sporočila, odgovori, odjave) — logika je v shared/campaignSync.js.
// Klic: urnik/interno { internal_secret, business_id?, mailbox_id? } ali lastnik { business_id | mailbox_id }.

const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') || '';
const VERSION = 'campaign-mail-2026-11-11g';
const ownsBusiness = (user, b) => !!user && !!b && (user.role === 'admin' || b.created_by_id === user.id
  || (!!user.email && (b.created_by === user.email || b.owner_email === user.email)));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const internal = !!INTERNAL_SECRET && body?.internal_secret === INTERNAL_SECRET;
    const user = internal ? null : await base44.auth.me().catch(() => null);
    const scheduled = internal || (user?.role === 'admin' && !body.business_id && !body.mailbox_id);
    if (!scheduled && !user) return Response.json({ error: 'Unauthorized', version: VERSION }, { status: 401 });
    if (!scheduled && !body.business_id && !body.mailbox_id) return Response.json({ error: 'business_id manjka', version: VERSION });
    const results = await syncCampaignMailboxesFor(base44, {
      mailboxId: body.mailbox_id, businessId: body.business_id,
      canAccess: scheduled ? null : (b) => ownsBusiness(user, b),
    });
    return Response.json({ success: true, version: VERSION, results });
  } catch (error) {
    return Response.json({ error: 'syncCampaignMailboxes: ' + (error?.message || String(error)), version: VERSION });
  }
});
