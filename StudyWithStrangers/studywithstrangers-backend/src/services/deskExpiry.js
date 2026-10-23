import "dotenv/config";
import { supabaseAdmin } from "../config/supabase.js";
import { getDeskConfig } from "../config/desks.js";
import { sendPushToSubscriptions } from "./push.js";

const { FRONTEND_URL } = process.env;

// Only desks that ended recently are announced. This keeps a server that was offline for a while
// (or a freshly deployed one) from sending notices about desks that ended days ago.
const MAX_AGE_AFTER_EXPIRY_MS = 12 * 3_600_000;
const BATCH_LIMIT = 200;

const siteUrl = () => (FRONTEND_URL ? FRONTEND_URL.split(",")[0].trim() : "http://localhost:3000").replace(/\/$/, "");

const hoursLabel = (h) => `${h} ${h === 1 ? "hour" : "hours"}`;

function buildPayload(creatorId, desks, hours) {
  const profileUrl = `${siteUrl()}/profile/${creatorId}`;

  if (desks.length === 1) {
    return {
      title: "Your desk has disappeared",
      body:
        `"${desks[0].title}" was removed from the list after ${hoursLabel(hours)}. ` +
        `Still studying? Open your profile and tap "Reuse" to bring it back.`,
      url: profileUrl,
      tag: `desk-expired-${desks[0].id}`,
    };
  }

  return {
    title: `${desks.length} of your desks have disappeared`,
    body:
      `They were removed from the list after ${hoursLabel(hours)}. ` +
      `Open your profile and tap "Reuse" to bring back the ones you're still using.`,
    url: profileUrl,
    tag: `desk-expired-${creatorId}`,
  };
}

/**
 * Finds normal desks whose time is up and tells their creators, once per desk.
 *
 * A desk is "claimed" first (expiry_notified_at is set only if it is still empty), so even if
 * two server instances run this at the same moment, each desk is announced exactly once.
 * Reusing a desk clears expiry_notified_at, so the next expiry is announced again.
 *
 * Never throws. Returns how many desks were announced.
 */
export async function notifyExpiredDesks(now = Date.now()) {
  try {
    const { lifespanHours } = getDeskConfig();
    const expiredBefore = new Date(now - lifespanHours * 3_600_000).toISOString();
    const notTooOld = new Date(now - lifespanHours * 3_600_000 - MAX_AGE_AFTER_EXPIRY_MS).toISOString();

    const { data: candidates, error } = await supabaseAdmin
      .from("desks")
      .select("id")
      .eq("is_special", false)
      .eq("is_hidden", false)
      .not("creator_id", "is", null)
      .is("expiry_notified_at", null)
      .lt("active_at", expiredBefore)
      .gte("active_at", notTooOld)
      .limit(BATCH_LIMIT);
    if (error) throw error;
    if (!candidates?.length) return 0;

    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("desks")
      .update({ expiry_notified_at: new Date(now).toISOString() })
      .in(
        "id",
        candidates.map((c) => c.id)
      )
      .is("expiry_notified_at", null)
      .select("id, title, creator_id");
    if (claimError) throw claimError;
    if (!claimed?.length) return 0;

    // One notification per creator, even if several of their desks ended together.
    const byCreator = new Map();
    for (const d of claimed) {
      if (!byCreator.has(d.creator_id)) byCreator.set(d.creator_id, []);
      byCreator.get(d.creator_id).push(d);
    }

    const { data: subs, error: subsError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth")
      .in("user_id", [...byCreator.keys()]);
    if (subsError) throw subsError;

    const subsByUser = new Map();
    for (const s of subs || []) {
      if (!subsByUser.has(s.user_id)) subsByUser.set(s.user_id, []);
      subsByUser.get(s.user_id).push(s);
    }

    await Promise.allSettled(
      [...byCreator.entries()].map(([creatorId, desks]) => {
        const userSubs = subsByUser.get(creatorId);
        if (!userSubs?.length) return Promise.resolve(); // never enabled notifications: nothing to send
        return sendPushToSubscriptions(userSubs, buildPayload(creatorId, desks, lifespanHours));
      })
    );

    return claimed.length;
  } catch (err) {
    console.error("notifyExpiredDesks error (non-fatal):", err);
    return 0;
  }
}

/**
 * Runs notifyExpiredDesks every couple of minutes inside this server process. This is enough on a
 * normal always-on host. On a serverless host the process sleeps, so ALSO point a free external
 * scheduler at GET /api/cron/desk-expiry (see README).
 */
export function startDeskExpiryNotifier(everyMs = 2 * 60_000) {
  const timer = setInterval(() => void notifyExpiredDesks(), everyMs);
  timer.unref?.();
  setTimeout(() => void notifyExpiredDesks(), 15_000).unref?.();
  return timer;
}
