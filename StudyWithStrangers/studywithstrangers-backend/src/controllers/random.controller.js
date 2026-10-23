import { supabaseAdmin } from "../config/supabase.js";
import { getRandomConfig } from "../config/random.js";
import { loadAccessContext, evaluateRandomAccess, isFeaturePaid, paymentInfo } from "../services/access.js";

// A waiting person polls every ~5s. If we haven't heard from them for this
// long they left, so nobody should be matched with them.
const WAITING_FRESH_MS = 20_000;
const MAX_SDP = 30_000;
const REASONS = ["nudity", "harassment", "underage", "spam", "other"];

const fail = (res, code, error, extra = {}) => res.status(code).json({ error, ...extra });
const serverError = (res, label, err) => {
  console.error(`random ${label} error:`, err);
  return res.status(500).json({ error: "Something went wrong. Try again." });
};

const view = (room, userId) => {
  const caller = room.user_b === userId; // the person who joined last makes the call
  return {
    roomId: room.id,
    status: room.status,
    role: caller ? "caller" : "callee",
    offer: !caller && room.status === "matched" ? room.offer : null,
    answer: caller && room.status === "matched" ? room.answer : null,
    endedByMe: room.status === "ended" ? room.ended_by === userId : false,
  };
};

const iso = (ms) => new Date(ms).toISOString();

/** Everyone I blocked or who blocked me (never matched together). */
async function blockedWith(userId) {
  const [a, b] = await Promise.all([
    supabaseAdmin.from("random_blocks").select("blocked").eq("blocker", userId),
    supabaseAdmin.from("random_blocks").select("blocker").eq("blocked", userId),
  ]);
  return new Set([...(a.data || []).map((r) => r.blocked), ...(b.data || []).map((r) => r.blocker)]);
}

/** Ends every unfinished room of this user. */
async function endMyRooms(userId, now) {
  for (const col of ["user_a", "user_b"]) {
    await supabaseAdmin
      .from("random_rooms")
      .update({ status: "ended", ended_at: iso(now), ended_by: userId, offer: null, answer: null })
      .eq(col, userId)
      .in("status", ["waiting", "matched"]);
  }
}

/**
 * Tries to take a waiting room. The conditional UPDATE (only while it is still
 * "waiting") is atomic, so two people can never grab the same room.
 * `olderThan` is only used by someone who is waiting themselves: they may only
 * join rooms that were created before theirs, so two waiting people can't
 * both give up their room for each other.
 */
async function claimRoom(userId, now, { olderThan = null, blocked }) {
  const { data } = await supabaseAdmin
    .from("random_rooms")
    .select("id, user_a, created_at")
    .eq("status", "waiting")
    .gte("last_poll_at", iso(now - WAITING_FRESH_MS));

  const candidates = (data || [])
    .filter((r) => r.user_a !== userId && !blocked.has(r.user_a))
    .filter((r) => {
      if (!olderThan) return true;
      const a = Date.parse(r.created_at);
      const b = Date.parse(olderThan.created_at);
      return a < b || (a === b && r.id < olderThan.id);
    })
    .sort((x, y) => Date.parse(x.created_at) - Date.parse(y.created_at) || (x.id < y.id ? -1 : 1));

  for (const c of candidates) {
    const { data: won } = await supabaseAdmin
      .from("random_rooms")
      .update({ status: "matched", user_b: userId, matched_at: iso(now), last_poll_at: iso(now) })
      .eq("id", c.id)
      .eq("status", "waiting")
      .select();
    if (won && won.length === 1) return won[0];
  }
  return null;
}

/** Occasionally tidy up so the table never grows without limit. */
async function cleanup(now) {
  if (Math.random() > 0.05) return;
  await supabaseAdmin.from("random_rooms").delete().eq("status", "ended").lt("ended_at", iso(now - 24 * 3600_000));
  await supabaseAdmin
    .from("random_rooms")
    .update({ status: "ended", ended_at: iso(now) })
    .eq("status", "waiting")
    .lt("last_poll_at", iso(now - 60_000));
}

// ---------------------------------------------------------------
// GET /api/random/config
// ---------------------------------------------------------------
export async function getConfig(req, res) {
  try {
    const random = getRandomConfig();
    const ctx = await loadAccessContext(req.user.id);
    const access = evaluateRandomAccess(ctx);
    return res.status(200).json({
      enabled: random.enabled,
      paid: isFeaturePaid(ctx?.payment, "randomChat"),
      allowed: access.allowed,
      iceServers: random.iceServers,
      payment: access.allowed ? null : paymentInfo(undefined, ctx?.payment, access),
    });
  } catch (err) {
    return serverError(res, "getConfig", err);
  }
}

// ---------------------------------------------------------------
// POST /api/random/join   (Start, and also "Next")
// ---------------------------------------------------------------
export async function join(req, res) {
  try {
    const now = Date.now();
    const userId = req.user.id;
    const random = getRandomConfig();
    if (!random.enabled) return fail(res, 503, "Random chat is switched off right now.");

    const ctx = await loadAccessContext(userId);
    const access = evaluateRandomAccess(ctx, now);
    if (!access.allowed) {
      return fail(res, 402, "Random chat needs an active subscription.", paymentInfo(undefined, ctx?.payment, access));
    }

    // paused after several different people reported them
    const { data: reports } = await supabaseAdmin
      .from("random_reports")
      .select("reporter")
      .eq("reported", userId)
      .eq("status", "open")
      .gte("created_at", iso(now - 7 * 24 * 3600_000));
    if (new Set((reports || []).map((r) => r.reporter)).size >= random.autoRestrictReports) {
      return fail(res, 403, "Your Random chat is paused after reports from other people. Our team will review it.", {
        restricted: true,
      });
    }

    await cleanup(now);
    await endMyRooms(userId, now);

    const blocked = await blockedWith(userId);
    const won = await claimRoom(userId, now, { blocked });
    if (won) return res.status(200).json(view(won, userId));

    const { data: mine, error } = await supabaseAdmin
      .from("random_rooms")
      .insert({ user_a: userId, status: "waiting", last_poll_at: iso(now), created_at: iso(now) })
      .select()
      .single();
    if (error) throw error;
    return res.status(200).json(view(mine, userId));
  } catch (err) {
    return serverError(res, "join", err);
  }
}

async function getMyRoom(req) {
  const { data: room } = await supabaseAdmin.from("random_rooms").select("*").eq("id", req.params.id).maybeSingle();
  if (!room) return null;
  if (room.user_a !== req.user.id && room.user_b !== req.user.id) return null;
  return room;
}

// ---------------------------------------------------------------
// GET /api/random/room/:id   (poll: waiting -> matched -> offer/answer)
// ---------------------------------------------------------------
export async function pollRoom(req, res) {
  try {
    const now = Date.now();
    const userId = req.user.id;
    const room = await getMyRoom(req);
    if (!room) return fail(res, 404, "Room not found.");

    if (room.status === "waiting") {
      await supabaseAdmin.from("random_rooms").update({ last_poll_at: iso(now) }).eq("id", room.id).eq("status", "waiting");
      // two people may have started at the same moment: the newer one joins the older room
      const blocked = await blockedWith(userId);
      const won = await claimRoom(userId, now, { olderThan: room, blocked });
      if (won) {
        await supabaseAdmin
          .from("random_rooms")
          .update({ status: "ended", ended_at: iso(now), ended_by: userId })
          .eq("id", room.id)
          .eq("status", "waiting");
        return res.status(200).json(view(won, userId));
      }
    }
    return res.status(200).json(view(room, userId));
  } catch (err) {
    return serverError(res, "pollRoom", err);
  }
}

// ---------------------------------------------------------------
// POST /api/random/room/:id/offer | /answer     Body: { sdp }
// ---------------------------------------------------------------
const postSdp = (field, who) => async (req, res) => {
  try {
    const room = await getMyRoom(req);
    if (!room) return fail(res, 404, "Room not found.");
    const sdp = req.body?.sdp;
    if (typeof sdp !== "string" || !sdp || sdp.length > MAX_SDP) return fail(res, 400, "Bad connection data.");
    if (room.status !== "matched") return fail(res, 409, "This chat already ended.");
    if (room[who] !== req.user.id) return fail(res, 403, "Not your turn.");

    const { error } = await supabaseAdmin.from("random_rooms").update({ [field]: sdp }).eq("id", room.id).eq("status", "matched");
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (err) {
    return serverError(res, field, err);
  }
};
export const postOffer = postSdp("offer", "user_b"); // the joiner calls
export const postAnswer = postSdp("answer", "user_a"); // the waiter answers

// ---------------------------------------------------------------
// POST /api/random/room/:id/leave
// ---------------------------------------------------------------
export async function leave(req, res) {
  try {
    const room = await getMyRoom(req);
    if (room && room.status !== "ended") {
      await supabaseAdmin
        .from("random_rooms")
        .update({ status: "ended", ended_at: iso(Date.now()), ended_by: req.user.id, offer: null, answer: null })
        .eq("id", room.id)
        .in("status", ["waiting", "matched"]);
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    return serverError(res, "leave", err);
  }
}

/** The other person in a room I was in (matched rooms only). */
function partnerOf(room, userId) {
  if (!room.user_b) return null;
  return room.user_a === userId ? room.user_b : room.user_a;
}

// ---------------------------------------------------------------
// POST /api/random/room/:id/report     Body: { reason, details? }
// Also blocks that person for the reporter (never matched again).
// ---------------------------------------------------------------
export async function report(req, res) {
  try {
    const userId = req.user.id;
    const room = await getMyRoom(req);
    if (!room) return fail(res, 404, "Room not found.");
    const reported = partnerOf(room, userId);
    if (!reported) return fail(res, 400, "There's nobody to report.");

    const reason = String(req.body?.reason || "");
    if (!REASONS.includes(reason)) return fail(res, 400, "Pick a reason.");
    const details = typeof req.body?.details === "string" ? req.body.details.trim().slice(0, 300) : "";

    const { data: existing } = await supabaseAdmin
      .from("random_reports")
      .select("id")
      .eq("room_id", room.id)
      .eq("reporter", userId)
      .maybeSingle();
    if (!existing) {
      const { error } = await supabaseAdmin
        .from("random_reports")
        .insert({ room_id: room.id, reporter: userId, reported, reason, details: details || null });
      if (error) throw error;
    }
    await supabaseAdmin.from("random_blocks").upsert({ blocker: userId, blocked: reported }, { onConflict: "blocker,blocked" });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return serverError(res, "report", err);
  }
}

// ---------------------------------------------------------------
// POST /api/random/room/:id/block
// ---------------------------------------------------------------
export async function block(req, res) {
  try {
    const room = await getMyRoom(req);
    if (!room) return fail(res, 404, "Room not found.");
    const other = partnerOf(room, req.user.id);
    if (!other) return fail(res, 400, "There's nobody to block.");
    await supabaseAdmin.from("random_blocks").upsert({ blocker: req.user.id, blocked: other }, { onConflict: "blocker,blocked" });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return serverError(res, "block", err);
  }
}
