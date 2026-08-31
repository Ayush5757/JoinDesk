import { supabaseAdmin } from "../config/supabase.js";
import { getVapidPublicKey, isPushConfigured } from "../services/push.js";

/**
 * GET /api/push/vapid-public-key
 * Public. The frontend calls this before subscribing, to know which VAPID
 * key to hand to PushManager.subscribe(). `configured: false` tells the
 * frontend to silently skip notifications (server admin hasn't set the
 * VAPID env vars yet) instead of throwing an error at the user.
 */
export function getPublicKey(req, res) {
  const publicKey = getVapidPublicKey();
  return res.status(200).json({ publicKey, configured: isPushConfigured() });
}

/**
 * POST /api/push/subscribe
 * Body: { subscription: PushSubscriptionJSON }  (endpoint + keys.p256dh + keys.auth)
 * Saves/updates this browser's push subscription against the logged-in
 * user. A user can have many rows here (one per device/browser).
 */
export async function subscribe(req, res) {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: "A valid push subscription object is required" });
    }

    const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
      {
        user_id: req.user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      { onConflict: "endpoint" }
    );

    if (error) throw error;

    return res.status(200).json({ subscribed: true });
  } catch (err) {
    console.error("push subscribe error:", err);
    return res.status(500).json({ error: "Failed to save push subscription" });
  }
}

/**
 * POST /api/push/unsubscribe
 * Body: { endpoint }
 * Called when the user turns notifications off in their browser/device.
 */
export async function unsubscribe(req, res) {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: "endpoint is required" });
    }

    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint)
      .eq("user_id", req.user.id);

    if (error) throw error;

    return res.status(200).json({ subscribed: false });
  } catch (err) {
    console.error("push unsubscribe error:", err);
    return res.status(500).json({ error: "Failed to remove push subscription" });
  }
}
