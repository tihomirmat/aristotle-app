/**
 * Scheduled task: runs every hour.
 * Expires any trialing Business where trial_ends_at <= now.
 * Sets subscription_status = "past_due" and clears all pillar flags.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PILLAR_KEYS = [
  "pillar_reactivation",
  "pillar_reviews",
  "pillar_leads",
  "pillar_chatbot",
  "pillar_assistant",
  "pillar_digest",
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const trialing = await base44.asServiceRole.entities.Business.filter({ subscription_status: "trialing" });

    const expired = trialing.filter((b) => b.trial_ends_at && new Date(b.trial_ends_at) <= now);

    let count = 0;
    for (const biz of expired) {
      const pillarOff = {};
      PILLAR_KEYS.forEach((k) => { pillarOff[k] = false; });
      await base44.asServiceRole.entities.Business.update(biz.id, {
        ...pillarOff,
        subscription_status: "past_due",
      });
      count++;
    }

    return Response.json({ processed: count, expired_ids: expired.map((b) => b.id) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});