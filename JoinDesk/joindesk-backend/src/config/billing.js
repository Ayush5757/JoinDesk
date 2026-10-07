import "dotenv/config";

const toBool = (v, d = false) =>
  v == null || v === "" ? d : ["1", "true", "yes", "on"].includes(String(v).trim().toLowerCase());
const toNum = (v, d) => {
  if (v == null || String(v).trim() === "") return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

/**
 * Everything the paywall/billing needs, read from .env. Read on every call
 * (cheap) so tests can change process.env; in production a change to .env
 * takes effect after a server restart, as usual.
 */
export function getBillingConfig() {
  const e = process.env;
  const priceInr = Math.max(1, toNum(e.SUBSCRIPTION_PRICE_INR, 149));
  const razorpayKeyId = (e.RAZORPAY_KEY_ID || "").trim();
  const razorpayKeySecret = (e.RAZORPAY_KEY_SECRET || "").trim();

  return {
    paywallEnabled: toBool(e.PAYWALL_ENABLED, false),
    trialDays: Math.max(0, toNum(e.TRIAL_DAYS, 0)),
    priceInr,
    amountPaise: Math.round(priceInr * 100),
    days: Math.max(1, Math.round(toNum(e.SUBSCRIPTION_DAYS, 30))),
    razorpayKeyId,
    razorpayKeySecret,
    razorpayWebhookSecret: (e.RAZORPAY_WEBHOOK_SECRET || "").trim(),
    razorpayConfigured: Boolean(razorpayKeyId && razorpayKeySecret),
    inactiveDays: Math.max(1, Math.round(toNum(e.INACTIVE_DAYS, 30))),
    tzOffsetMinutes: toNum(e.ANALYTICS_TZ_OFFSET_MINUTES, 330),
  };
}
