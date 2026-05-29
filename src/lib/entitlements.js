/**
 * Faza 5 entitlement helper.
 * Returns true if the business has access to a given pillar:
 *  - During active trial (subscription_status === "trialing" AND trial_ends_at > now) → ALL pillars open
 *  - Otherwise → business[pillarKey] must be true
 */
export function hasModule(business, pillarKey) {
  if (!business) return false;
  const isTrialing =
    business.subscription_status === "trialing" &&
    business.trial_ends_at &&
    new Date(business.trial_ends_at) > new Date();
  if (isTrialing) return true;
  return business[pillarKey] === true;
}

export const PILLAR_KEYS = [
  "pillar_reactivation",
  "pillar_reviews",
  "pillar_leads",
  "pillar_chatbot",
  "pillar_assistant",
];