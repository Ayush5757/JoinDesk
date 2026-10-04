import crypto from "node:crypto";
import { getBillingConfig } from "../config/billing.js";

const RAZORPAY_API = "https://api.razorpay.com/v1";

function safeEqualHex(a, b) {
  try {
    const bufA = Buffer.from(String(a), "hex");
    const bufB = Buffer.from(String(b), "hex");
    return bufA.length > 0 && bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Creates a Razorpay order. The amount ALWAYS comes from the server's .env
 * (never from the browser), so a user can't pay less by editing the request.
 * Uses plain fetch + Basic auth — no extra SDK dependency.
 */
export async function createRazorpayOrder({ amountPaise, receipt, notes }) {
  const { razorpayKeyId, razorpayKeySecret } = getBillingConfig();
  const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");

  const res = await fetch(`${RAZORPAY_API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt, notes }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error?.description || `Razorpay order failed (${res.status})`);
  }
  return body; // { id, amount, currency, ... }
}

/** Checks the signature Razorpay Checkout returns to the browser after payment. */
export function verifyCheckoutSignature(orderId, paymentId, signature) {
  const { razorpayKeySecret } = getBillingConfig();
  if (!razorpayKeySecret || !orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac("sha256", razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeEqualHex(expected, signature);
}

/** Checks the X-Razorpay-Signature header on a webhook call (needs the RAW body). */
export function verifyWebhookSignature(rawBody, signature) {
  const { razorpayWebhookSecret } = getBillingConfig();
  if (!razorpayWebhookSecret || !rawBody || !signature) return false;
  const expected = crypto
    .createHmac("sha256", razorpayWebhookSecret)
    .update(rawBody)
    .digest("hex");
  return safeEqualHex(expected, signature);
}
