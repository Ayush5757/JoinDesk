import { supabaseAdmin } from "../config/supabase.js";
import { getBillingConfig } from "../config/billing.js";
import { getRandomConfig } from "../config/random.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAYMENT_KEY = "payment_settings";

/**
 * When this user's free days end (ms since epoch): `days` after they created their
 * account. The number of days is set by the admin (Payments -> "New users get ... free days").
 */
export function trialEndsAtMs(user, days) {
  const start = Date.parse(user.trial_started_at || user.created_at || "");
  if (!Number.isFinite(start)) return 0;
  return start + Number(days || 0) * DAY_MS;
}

// =========================
// Payment settings (admin editable: on/off, amount, "how to pay" message)
// =========================

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const PAID_FEATURES = ["normalDesks", "specialDesks", "randomChat"];

/** "YYYY-MM-DD" today in the app's timezone (IST by default). */
function todayIst(now, cfg) {
  return new Date(now + cfg.tzOffsetMinutes * 60000).toISOString().slice(0, 10);
}

/**
 * Stored in site_settings (key "payment_settings") as JSON:
 *   { amountInr, message, freeUntil, features: { normalDesks, specialDesks, randomChat } }
 *
 *  - features.X = true means "X needs a subscription"...
 *  - ...but only AFTER the free period: while today <= freeUntil everything is free.
 *    freeUntil null = no free period (a switched-on feature is paid right away).
 * Older saved settings ({ enabled, amountInr, message }) still work: `enabled`
 * becomes the Special desks switch.
 */
export function normalizePaymentSettings(raw, cfg = getBillingConfig(), random = getRandomConfig()) {
  let obj = {};
  try {
    obj = typeof raw === "string" && raw ? JSON.parse(raw) : {};
  } catch {
    obj = {};
  }
  const f = obj.features && typeof obj.features === "object" ? obj.features : null;
  const legacy = !f && typeof obj.enabled === "boolean"; // saved before the master switch existed
  const features = f
    ? {
        normalDesks: Boolean(f.normalDesks),
        specialDesks: Boolean(f.specialDesks),
        randomChat: Boolean(f.randomChat),
      }
    : legacy
      ? { normalDesks: false, specialDesks: obj.enabled, randomChat: random.paid }
      : { normalDesks: true, specialDesks: true, randomChat: true };

  // The master switch: false = everything is free for everyone.
  const paid =
    typeof obj.paid === "boolean"
      ? obj.paid
      : f || legacy
        ? Object.values(features).some(Boolean)
        : cfg.paywallEnabled || random.paid;

  const days = Math.round(Number(obj.trialDays));
  const amount = Number(obj.amountInr);
  return {
    paid,
    enabled: paid && features.specialDesks, // kept for older callers
    features,
    freeUntil: typeof obj.freeUntil === "string" && DATE_RE.test(obj.freeUntil) ? obj.freeUntil : null,
    trialDays: obj.trialDays !== undefined && Number.isFinite(days) && days >= 0 && days <= 365 ? days : cfg.trialDays,
    amountInr: Number.isFinite(amount) && amount >= 0 ? amount : cfg.priceInr,
    message: typeof obj.message === "string" ? obj.message : "",
  };
}

/** Is this feature asking for a subscription at this moment? */
export function isFeaturePaid(payment, feature, now = Date.now(), cfg = getBillingConfig()) {
  if (!payment?.paid || !payment.features?.[feature]) return false;
  if (!payment.freeUntil) return true;
  return todayIst(now, cfg) > payment.freeUntil;
}

export function paywallFlags(payment, now = Date.now(), cfg = getBillingConfig()) {
  return Object.fromEntries(PAID_FEATURES.map((k) => [k, isFeaturePaid(payment, k, now, cfg)]));
}

export async function loadPaymentSettings(cfg = getBillingConfig()) {
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", PAYMENT_KEY)
    .maybeSingle();
  return normalizePaymentSettings(data?.value, cfg);
}

export async function savePaymentSettings(input) {
  const current = await loadPaymentSettings();
  const hasFeatures = input.features && typeof input.features === "object";
  const features = hasFeatures
    ? {
        normalDesks: Boolean(input.features.normalDesks),
        specialDesks: Boolean(input.features.specialDesks),
        randomChat: Boolean(input.features.randomChat),
      }
    : { ...current.features, ...(typeof input.enabled === "boolean" ? { specialDesks: input.enabled } : {}) };
  const paid =
    typeof input.paid === "boolean" ? input.paid : typeof input.enabled === "boolean" ? input.enabled : current.paid;
  const freeUntil =
    input.freeUntil === undefined
      ? current.freeUntil
      : typeof input.freeUntil === "string" && DATE_RE.test(input.freeUntil)
        ? input.freeUntil
        : null;
  const trial = input.trialDays === undefined ? current.trialDays : Math.round(Number(input.trialDays));
  const clean = {
    paid,
    features,
    freeUntil,
    trialDays: Number.isFinite(trial) && trial >= 0 && trial <= 365 ? trial : current.trialDays,
    amountInr: Math.max(0, Math.round(Number(input.amountInr ?? current.amountInr) || 0)),
    message: String(input.message ?? current.message ?? "").trim().slice(0, 1000),
  };
  const { error } = await supabaseAdmin.from("site_settings").upsert({
    key: PAYMENT_KEY,
    value: JSON.stringify(clean),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return normalizePaymentSettings(JSON.stringify(clean));
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
 * The paid part of the check (everything AFTER "is this even paid right now?").
 * First match wins and is logged as `access_type`:
 *   free_all   admin gave ALL desks / all features
 *   free_desk  admin gave THIS desk
 *   paid       inside a manual subscription (start date <= now < end of end date)
 *   paid       active Razorpay month
 *   trial      inside the free trial
 *   expired    otherwise -> must pay
 */
function evaluatePaid(ctx, deskId, now, cfg) {
  const { user, grants, manualSubs } = ctx;

  if (grants.some((g) => g.scope === "all")) return { allowed: true, type: "free_all" };
  if (deskId && grants.some((g) => g.scope === "desk" && g.desk_id === deskId)) {
    return { allowed: true, type: "free_desk" };
  }

  const manual = activeSub(manualSubs, now);
  if (manual) return { allowed: true, type: "paid", until: Date.parse(manual.ends_at) };

  const subUntil = user.subscription_expires_at ? Date.parse(user.subscription_expires_at) : 0;
  if (subUntil > now) return { allowed: true, type: "paid", until: subUntil };

  const trialUntil = trialEndsAtMs(user, ctx.payment?.trialDays ?? cfg.trialDays);
  if (trialUntil > now) return { allowed: true, type: "trial", until: trialUntil };

  // Why are they blocked? (so the message can say "starts on ..." / "ended on ...")
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
 * Can this person join this desk?
 * A normal desk follows the "Normal desks" switch, a Special desk the
 * "Special desks" switch (admin panel -> Payments). A switch only matters once the free
 * period is over. Pure function (no DB) so it's easy to test.
 */
export function evaluateAccess(ctx, desk, now = Date.now(), cfg = getBillingConfig()) {
  const feature = desk?.is_special ? "specialDesks" : "normalDesks";
  const payment = ctx?.payment || normalizePaymentSettings(null, cfg);
  if (!isFeaturePaid(payment, feature, now, cfg)) return { allowed: true, type: "open" };
  if (!ctx) return { allowed: false, type: "expired" };
  return evaluatePaid(ctx, desk?.id, now, cfg);
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
  const flags = paywallFlags(pay, now, cfg);
  const anyPaid = Object.values(flags).some(Boolean);
  const freeAll = grants.some((g) => g.scope === "all");
  const freeDeskIds = grants.filter((g) => g.scope === "desk").map((g) => g.desk_id);
  const manual = activeSub(manualSubs, now);
  const razorUntil = user.subscription_expires_at ? Date.parse(user.subscription_expires_at) : 0;
  const subUntil = manual ? Date.parse(manual.ends_at) : razorUntil > now ? razorUntil : 0;
  const trialUntil = trialEndsAtMs(user, pay.trialDays);
  const future = manualSubs
    .filter((s) => Date.parse(s.starts_at) > now)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0];

  let status = "expired";
  let until = null;

  if (!anyPaid) status = "open";
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
    paywall: flags, // which features need a subscription right now
    freeUntil: pay.freeUntil,
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
    trialDays: pay.trialDays,
    message: pay.message,
    freeUntil: pay.freeUntil,
    nextStartsAt: extra.nextStartsAt || null,
    lastEndedAt: extra.lastEndedAt || null,
  };
}

/**
 * Can this person use Random Chat? It follows the "Random chat" switch in
 * the admin panel (and its free period). When it is paid: an active
 * subscription, or free access to ALL desks. A pass for ONE desk doesn't unlock it.
 */
export function evaluateRandomAccess(ctx, now = Date.now(), cfg = getBillingConfig()) {
  const payment = ctx?.payment || normalizePaymentSettings(null, cfg);
  if (!isFeaturePaid(payment, "randomChat", now, cfg)) return { allowed: true, type: "open" };
  if (!ctx) return { allowed: false, type: "expired" };
  return evaluatePaid({ ...ctx, grants: ctx.grants.filter((g) => g.scope === "all") }, null, now, cfg);
}
