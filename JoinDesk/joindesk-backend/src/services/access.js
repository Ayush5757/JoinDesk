import { supabaseAdmin } from "../config/supabase.js";
import { getBillingConfig } from "../config/billing.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAYMENT_KEY = "payment_settings";

/** When this user's free trial ends (ms since epoch). */
export function trialEndsAtMs(user, cfg = getBillingConfig()) {
  const start = Date.parse(user.trial_started_at || user.created_at || "");
  if (!Number.isFinite(start)) return 0;
  return start + cfg.trialDays * DAY_MS;
}

// =========================
// Payment settings (admin editable: on/off, amount, "how to pay" message)
// =========================

/**
 * Stored in site_settings (key "payment_settings") as JSON:
 *   { enabled: boolean, amountInr: number, message: string }
 * If the admin never saved anything, "enabled" falls back to PAYWALL_ENABLED
 * from .env and the amount to SUBSCRIPTION_PRICE_INR.
 */
export function normalizePaymentSettings(raw, cfg = getBillingConfig()) {
  let obj = {};
  try {
    obj = typeof raw === "string" && raw ? JSON.parse(raw) : {};
  } catch {
    obj = {};
  }
  const amount = Number(obj.amountInr);
  return {
    enabled: typeof obj.enabled === "boolean" ? obj.enabled : cfg.paywallEnabled,
    amountInr: Number.isFinite(amount) && amount >= 0 ? amount : cfg.priceInr,
    message: typeof obj.message === "string" ? obj.message : "",
  };
}

export async function loadPaymentSettings(cfg = getBillingConfig()) {
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", PAYMENT_KEY)
    .maybeSingle();
  return normalizePaymentSettings(data?.value, cfg);
}

export async function savePaymentSettings({ enabled, amountInr, message }) {
  const clean = {
    enabled: Boolean(enabled),
    amountInr: Math.max(0, Math.round(Number(amountInr) || 0)),
    message: String(message || "").trim().slice(0, 1000),
  };
  const { error } = await supabaseAdmin.from("site_settings").upsert({
    key: PAYMENT_KEY,
    value: JSON.stringify(clean),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return clean;
}

// =========================
// Manual subscriptions (admin adds start date -> end date after UPI payment)
// =========================

export async function loadManualSubs(userId) {
  const { data, error } = await supabaseAdmin
    .from("manual_subscriptions")
    .select("id, starts_at, ends_at, amount_inr, note, created_at")
    .eq("user_id", userId)
    .order("starts_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/** user_id -> manual_subscriptions[] for many users at once. */
export async function loadManualSubsForUsers(userIds) {
  const map = new Map();
  const ids = [...new Set(userIds.filter(Boolean))];
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabaseAdmin
      .from("manual_subscriptions")
      .select("id, user_id, starts_at, ends_at, amount_inr, note, created_at")
      .in("user_id", ids.slice(i, i + 150));
    if (error) throw error;
    for (const r of data || []) {
      if (!map.has(r.user_id)) map.set(r.user_id, []);
      map.get(r.user_id).push(r);
    }
  }
  return map;
}

const activeSub = (subs, now) =>
  (subs || []).find((s) => Date.parse(s.starts_at) <= now && now < Date.parse(s.ends_at));

/**
 * Loads what we need to decide whether a user may join a (special) desk:
 * their row, free-access grants, manual subscriptions and payment settings.
 * Returns null if the user doesn't exist.
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

  const [manualSubs, payment] = await Promise.all([loadManualSubs(userId), loadPaymentSettings()]);
  return { user, grants: grants || [], manualSubs, payment };
}

/**
 * The single source of truth for "can this person join this desk?".
 * ONLY Special desks are paid. Every other desk is free for everyone.
 * For a Special desk, the first match wins (and is logged as `access_type`):
 *   0. not a special desk       -> open
 *   1. paywall switched off     -> open
 *   2. admin gave ALL desks     -> free_all
 *   3. admin gave THIS desk     -> free_desk
 *   4. inside a manual subscription (start date <= now < end of end date) -> paid
 *   5. active Razorpay month    -> paid
 *   6. inside the free trial    -> trial
 *   7. otherwise                -> expired (must pay)
 * Pure function (no DB) so it's easy to test.
 */
export function evaluateAccess(ctx, desk, now = Date.now(), cfg = getBillingConfig()) {
  const deskId = desk?.id;
  if (!desk?.is_special) return { allowed: true, type: "open" };

  const payment = ctx?.payment || normalizePaymentSettings(null, cfg);
  if (!payment.enabled) return { allowed: true, type: "open" };
  if (!ctx) return { allowed: false, type: "expired" };

  const { user, grants, manualSubs } = ctx;

  if (grants.some((g) => g.scope === "all")) return { allowed: true, type: "free_all" };
  if (deskId && grants.some((g) => g.scope === "desk" && g.desk_id === deskId)) {
    return { allowed: true, type: "free_desk" };
  }

  const manual = activeSub(manualSubs, now);
  if (manual) return { allowed: true, type: "paid", until: Date.parse(manual.ends_at) };

  const subUntil = user.subscription_expires_at ? Date.parse(user.subscription_expires_at) : 0;
  if (subUntil > now) return { allowed: true, type: "paid", until: subUntil };

  const trialUntil = trialEndsAtMs(user, cfg);
  if (trialUntil > now) return { allowed: true, type: "trial", until: trialUntil };

  // Why are they blocked? (so the message can say "starts on …" / "ended on …")
  const subs = manualSubs || [];
  const future = subs
    .filter((s) => Date.parse(s.starts_at) > now)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0];
  const lastEnded = subs
    .filter((s) => Date.parse(s.ends_at) <= now)
    .sort((a, b) => Date.parse(b.ends_at) - Date.parse(a.ends_at))[0];

  return {
    allowed: false,
    type: "expired",
    nextStartsAt: future ? future.starts_at : null,
    lastEndedAt: lastEnded ? lastEnded.ends_at : null,
  };
}

/**
 * One-glance summary of a user's access (profile page + admin Users list).
 * `status`: open | free_all | paid | scheduled | trial | free_desks | expired
 * "scheduled" = a subscription is saved but its start date hasn't come yet.
 */
export function summarizeAccess(
  { user, grants, manualSubs = [], payment },
  now = Date.now(),
  cfg = getBillingConfig()
) {
  const pay = payment || normalizePaymentSettings(null, cfg);
  const freeAll = grants.some((g) => g.scope === "all");
  const freeDeskIds = grants.filter((g) => g.scope === "desk").map((g) => g.desk_id);
  const manual = activeSub(manualSubs, now);
  const razorUntil = user.subscription_expires_at ? Date.parse(user.subscription_expires_at) : 0;
  const subUntil = manual ? Date.parse(manual.ends_at) : razorUntil > now ? razorUntil : 0;
  const trialUntil = trialEndsAtMs(user, cfg);
  const future = manualSubs
    .filter((s) => Date.parse(s.starts_at) > now)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0];

  let status = "expired";
  let until = null;

  if (!pay.enabled) status = "open";
  else if (freeAll) status = "free_all";
  else if (subUntil > now) {
    status = "paid";
    until = new Date(subUntil).toISOString();
  } else if (trialUntil > now) {
    status = "trial";
    until = new Date(trialUntil).toISOString();
  } else if (future) {
    status = "scheduled";
    until = future.starts_at;
  } else if (freeDeskIds.length) status = "free_desks";

  return {
    status,
    until,
    freeAll,
    freeDeskIds,
    subscriptionExpiresAt: subUntil ? new Date(subUntil).toISOString() : null,
    trialEndsAt: trialUntil ? new Date(trialUntil).toISOString() : null,
    scheduledStartsAt: future ? future.starts_at : null,
    daysLeft:
      status === "paid" || status === "trial"
        ? Math.max(0, Math.ceil((Date.parse(until) - now) / DAY_MS))
        : null,
  };
}

/** What the 402 response / paywall UI needs to show. */
export function paymentInfo(cfg = getBillingConfig(), payment, extra = {}) {
  const pay = payment || normalizePaymentSettings(null, cfg);
  return {
    priceInr: pay.amountInr,
    days: cfg.days,
    trialDays: cfg.trialDays,
    message: pay.message,
    nextStartsAt: extra.nextStartsAt || null,
    lastEndedAt: extra.lastEndedAt || null,
  };
}
