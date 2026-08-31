import webpush from "web-push";
import "dotenv/config";
import { supabaseAdmin } from "../config/supabase.js";

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, FRONTEND_URL } = process.env;

// Web Push (the same underlying tech behind Chrome/Firefox/Edge "site
// notifications" and Android's notification popups) is completely free and
// has no sending cap — no Firebase project, no Google Cloud billing, no API
// key from a paid vendor. The only "key" involved is a VAPID keypair we
// generate ourselves once (see README section 8) and paste into .env.
const isConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (isConfigured) {
  webpush.setVapidDetails(
    VAPID_SUBJECT || "mailto:admin@example.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

/** Used by GET /api/push/vapid-public-key so the frontend can subscribe. */
export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY || null;
}

export function isPushConfigured() {
  return isConfigured;
}

/**
 * Sends one push payload to a list of { endpoint, p256dh, auth }
 * subscriptions. Fire-and-forget-safe: never throws. Subscriptions the
 * push service reports as gone (uninstalled app, cleared browser data,
 * expired endpoint — HTTP 404/410) are deleted from the DB automatically
 * so we stop retrying dead devices.
 */
export async function sendPushToSubscriptions(subscriptions, payload) {
  if (!subscriptions?.length) return;

  if (!isConfigured) {
    console.log(
      `[push:notConfigured] Would push-notify ${subscriptions.length} subscription(s): "${payload.title}". Set VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY in .env to send real push notifications (free, no signup needed beyond generating the keys — see README).`
    );
    return;
  }

  const body = JSON.stringify(payload);

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body
      )
    )
  );

  const deadEndpoints = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      const statusCode = r.reason?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        deadEndpoints.push(subscriptions[i].endpoint);
      } else {
        console.error(
          `Failed to push-notify ${subscriptions[i].endpoint}:`,
          r.reason?.body || r.reason
        );
      }
    }
  });

  if (deadEndpoints.length) {
    await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
  }
}

/**
 * Notifies everyone `creator` has marked as "Special" that they've just
 * created a new desk. Same trigger/shape as the old email notifier it
 * replaces — desks.controller.js calls this instead of the email service.
 *
 * @param {{ name: string }} creator
 * @param {{ id: string, title: string, topic: string, description?: string }} desk
 * @param {{ endpoint: string, p256dh: string, auth: string }[]} subscriptions
 */
export async function notifySpecialUsersOfNewDesk(creator, desk, subscriptions) {
  const url = FRONTEND_URL ? FRONTEND_URL.split(",")[0].trim() : "http://localhost:3000";

  await sendPushToSubscriptions(subscriptions, {
    title: `${creator.name} just opened a new desk`,
    body: `${desk.title} · ${desk.topic}`,
    url,
    tag: `desk-${desk.id}`,
  });
}
