import { supabaseAdmin } from "../config/supabase.js";
import { getBillingConfig } from "../config/billing.js";
import { loadAccessContext, loadPaymentSettings, summarizeAccess } from "../services/access.js";
import {
  createRazorpayOrder,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from "../services/razorpay.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * GET /api/billing/config  (public)
 * Lets the frontend know the price/trial and whether the paywall is on,
 * without hardcoding any of it in the frontend build.
 */
export async function getConfig(req, res) {
  try {
    const cfg = getBillingConfig();
    const payment = await loadPaymentSettings(cfg);
    return res.status(200).json({
      enabled: payment.enabled,
      configured: cfg.razorpayConfigured,
      priceInr: payment.amountInr,
      days: cfg.days,
      trialDays: cfg.trialDays,
      message: payment.message,
    });
  } catch (err) {
    console.error("billing getConfig error:", err);
    return res.status(500).json({ error: "Failed to load billing config" });
  }
}

/**
 * GET /api/billing/status  (login required)
 * The logged-in user's access: paid until when, trial, free grants, and
 * their last few payments. Powers the card on the profile page.
 */
export async function getStatus(req, res) {
  try {
    const cfg = getBillingConfig();
    const ctx = await loadAccessContext(req.user.id);
    if (!ctx) return res.status(404).json({ error: "User not found" });

    const { data: payments } = await supabaseAdmin
      .from("payments")
      .select("id, amount_paise, status, paid_at, starts_at, expires_at, days")
      .eq("user_id", req.user.id)
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(5);

    return res.status(200).json({
      enabled: ctx.payment.enabled,
      configured: cfg.razorpayConfigured,
      priceInr: ctx.payment.amountInr,
      days: cfg.days,
      trialDays: cfg.trialDays,
      message: ctx.payment.message,
      access: summarizeAccess(ctx),
      payments: payments || [],
      manualSubs: ctx.manualSubs.map((m) => ({
        id: m.id,
        starts_at: m.starts_at,
        ends_at: m.ends_at,
        amount_inr: m.amount_inr,
      })),
    });
  } catch (err) {
    console.error("billing getStatus error:", err);
    return res.status(500).json({ error: "Failed to load billing status" });
  }
}

/**
 * POST /api/billing/order  (login required)
 * Creates a Razorpay order for one subscription period and remembers it in
 * `payments` (status 'created'). Returns what Razorpay Checkout needs.
 */
export async function createOrder(req, res) {
  try {
    const cfg = getBillingConfig();
    if (!cfg.razorpayConfigured) {
      return res.status(503).json({ error: "Payments are not set up yet. Please try again later." });
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, name, email")
      .eq("id", req.user.id)
      .single();

    const receipt = `jd_${Date.now().toString(36)}_${req.user.id.slice(0, 8)}`;
    const order = await createRazorpayOrder({
      amountPaise: cfg.amountPaise,
      receipt,
      notes: { user_id: req.user.id, email: user?.email || "" },
    });

    const { error } = await supabaseAdmin.from("payments").insert({
      user_id: req.user.id,
      razorpay_order_id: order.id,
      amount_paise: cfg.amountPaise,
      currency: "INR",
      days: cfg.days,
      status: "created",
    });
    if (error) throw error;

    return res.status(201).json({
      orderId: order.id,
      amount: cfg.amountPaise,
      currency: "INR",
      keyId: cfg.razorpayKeyId,
      priceInr: cfg.priceInr,
      days: cfg.days,
      prefill: { name: user?.name || "", email: user?.email || "" },
    });
  } catch (err) {
    console.error("billing createOrder error:", err);
    return res.status(500).json({ error: "Couldn't start the payment. Please try again." });
  }
}

/**
 * Marks an order paid and extends the user's subscription. Safe to call
 * more than once for the same order (browser verify + webhook both call
 * it): only the call that flips the status to 'paid' extends the access,
 * so a payment is never counted twice.
 *
 * A fresh payment while still subscribed EXTENDS from the current end
 * date (nobody loses days by renewing early).
 */
export async function activatePayment(orderId, razorpayPaymentId) {
  const { data: payment, error } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("razorpay_order_id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!payment) return { found: false };
  if (payment.status === "paid") return { found: true, alreadyPaid: true, payment };

  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .select("subscription_expires_at")
    .eq("id", payment.user_id)
    .single();
  if (userError) throw userError;

  const now = Date.now();
  const current = user.subscription_expires_at ? Date.parse(user.subscription_expires_at) : 0;
  const base = Math.max(now, current);
  const newExpiry = new Date(base + payment.days * DAY_MS).toISOString();

  // Claim the payment first — whoever flips created -> paid does the extend.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("payments")
    .update({
      status: "paid",
      razorpay_payment_id: razorpayPaymentId,
      paid_at: new Date(now).toISOString(),
      starts_at: new Date(base).toISOString(),
      expires_at: newExpiry,
    })
    .eq("id", payment.id)
    .neq("status", "paid")
    .select()
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return { found: true, alreadyPaid: true, payment };

  const { error: extendError } = await supabaseAdmin
    .from("users")
    .update({ subscription_expires_at: newExpiry })
    .eq("id", payment.user_id);
  if (extendError) {
    // Money is taken but access wasn't extended — make it loud in the logs.
    console.error(`CRITICAL: payment ${orderId} marked paid but user extend failed:`, extendError);
    throw extendError;
  }

  return { found: true, alreadyPaid: false, payment: claimed, expiresAt: newExpiry };
}

/**
 * POST /api/billing/verify  (login required)
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Called by the browser right after Razorpay Checkout succeeds.
 */
export async function verifyPayment(req, res) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

    if (!verifyCheckoutSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      return res.status(400).json({ error: "Payment verification failed" });
    }

    // The order must belong to the person verifying it.
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("user_id")
      .eq("razorpay_order_id", razorpay_order_id)
      .maybeSingle();
    if (!payment || payment.user_id !== req.user.id) {
      return res.status(404).json({ error: "Order not found" });
    }

    await activatePayment(razorpay_order_id, razorpay_payment_id);

    const ctx = await loadAccessContext(req.user.id);
    return res.status(200).json({ ok: true, access: summarizeAccess(ctx) });
  } catch (err) {
    console.error("billing verifyPayment error:", err);
    return res.status(500).json({ error: "Couldn't confirm the payment. If money was deducted, it will be activated automatically within a few minutes." });
  }
}

/**
 * POST /api/billing/webhook  (public, signed by Razorpay)
 * Safety net: if the user closes the tab right after paying, Razorpay
 * still tells us and we activate their access anyway.
 */
export async function webhook(req, res) {
  try {
    const signature = req.headers["x-razorpay-signature"];
    if (!verifyWebhookSignature(req.rawBody, signature)) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    const event = req.body?.event;
    if (event === "payment.captured" || event === "order.paid") {
      const entity = req.body?.payload?.payment?.entity;
      const orderId = entity?.order_id;
      const paymentId = entity?.id;

      if (orderId && paymentId) {
        const { data: payment } = await supabaseAdmin
          .from("payments")
          .select("amount_paise")
          .eq("razorpay_order_id", orderId)
          .maybeSingle();

        // Only activate when the amount paid matches what we asked for.
        if (payment && Number(entity.amount) === payment.amount_paise) {
          await activatePayment(orderId, paymentId);
        } else {
          console.error(`Webhook amount mismatch/unknown order for ${orderId}`);
        }
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("billing webhook error:", err);
    // 500 makes Razorpay retry, which is what we want for a transient DB error.
    return res.status(500).json({ error: "Webhook failed" });
  }
}
