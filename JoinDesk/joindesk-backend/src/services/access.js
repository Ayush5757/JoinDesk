import { supabaseAdmin } from "../config/supabase.js";
import { getBillingConfig } from "../config/billing.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** When this user's free trial ends (ms since epoch). */
export function trialEndsAtMs(user, cfg = getBillingConfig()) {
  const start = Date.parse(user.trial_started_at || user.created_at || "");
  if (!Number.isFinite(start)) return 0;
  return start + cfg.trialDays * DAY_MS;
}

/**
 * Loads what we need to decide whether a user may join a desk: their row
 * (trial + subscription) and any free-access grants the admin gave their
 * email. Returns null if the user doesn't exist.
 */
export async function loadAccessContext(userId) {
  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("id, name, email, created_at, trial_started_at, subscription_expires_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!user) return null;

  const email = (user.email || "").toLowerCase();
  const { data: grants, error: grantsError } = await supabaseAdmin
    .from("access_grants")
    .select("id, scope, desk_id, note, granted_at")
    .eq("email", email);
  if (grantsError) throw grantsError;

  return { user, grants: grants || [] };
}

/**
 * The single source of truth for "can this person join this desk?".
 * Order matters (the first match wins, and is what gets logged as
 * `access_type` on the join event):
 *   1. paywall off            -> open
 *   2. admin gave ALL desks   -> free_all
 *   3. admin gave THIS desk   -> free_desk
 *   4. active paid month      -> paid
 *   5. inside the free trial  -> trial
 *   6. otherwise              -> expired (must pay)
 * Pure function (no DB) so it's easy to test.
 */
export function evaluateAccess(ctx, deskId, now = Date.now(), cfg = getBillingConfig()) {
  if (!cfg.paywallEnabled) return { allowed: true, type: "open" };
  if (!ctx) return { allowed: false, type: "expired" };

  const { user, grants } = ctx;

  if (grants.some((g) => g.scope === "all")) return { allowed: true, type: "free_all" };
  if (deskId && grants.some((g) => g.scope === "desk" && g.desk_id === deskId)) {
    return { allowed: true, type: "free_desk" };
  }

  const subUntil = user.subscription_expires_at ? Date.parse(user.subscription_expires_at) : 0;
  if (subUntil > now) return { allowed: true, type: "paid", until: subUntil };

  const trialUntil = trialEndsAtMs(user, cfg);
  if (trialUntil > now) return { allowed: true, type: "trial", until: trialUntil };

  return { allowed: false, type: "expired" };
}

/**
 * One-glance summary of a user's access (for the profile page and the
 * admin Users list). `status` is the "best" thing they currently have.
 */
export function summarizeAccess({ user, grants }, now = Date.now(), cfg = getBillingConfig()) {
  const freeAll = grants.some((g) => g.scope === "all");
  const freeDeskIds = grants.filter((g) => g.scope === "desk").map((g) => g.desk_id);
  const subUntil = user.subscription_expires_at ? Date.parse(user.subscription_expires_at) : 0;
  const trialUntil = trialEndsAtMs(user, cfg);

  let status = "expired";
  let until = null;

  if (!cfg.paywallEnabled) status = "open";
  else if (freeAll) status = "free_all";
  else if (subUntil > now) {
    status = "paid";
    until = new Date(subUntil).toISOString();
  } else if (trialUntil > now) {
    status = "trial";
    until = new Date(trialUntil).toISOString();
  } else if (freeDeskIds.length) status = "free_desks";

  return {
    status,
    until,
    freeAll,
    freeDeskIds,
    subscriptionExpiresAt: subUntil ? new Date(subUntil).toISOString() : null,
    trialEndsAt: trialUntil ? new Date(trialUntil).toISOString() : null,
    daysLeft: until ? Math.max(0, Math.ceil((Date.parse(until) - now) / DAY_MS)) : null,
  };
}

/** What the 402 response / paywall UI needs to show. */
export function paymentInfo(cfg = getBillingConfig()) {
  return { priceInr: cfg.priceInr, days: cfg.days, trialDays: cfg.trialDays };
}
