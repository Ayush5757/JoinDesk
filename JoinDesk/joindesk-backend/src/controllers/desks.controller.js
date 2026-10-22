import { supabaseAdmin } from "../config/supabase.js";
import { notifySpecialUsersOfNewDesk } from "../services/push.js";
import { loadAccessContext, evaluateAccess, paymentInfo } from "../services/access.js";
import { deskCutoffIso, getDeskConfig } from "../config/desks.js";
import { remember } from "../utils/cache.js";

const MEETING_LINK_REGEX = /^https?:\/\/.+\..+/i; // any platform: Google Meet, Zoom, Teams, etc.
const MAX_SUBJECT = 60;
const REUSE_NOTIFY_GAP_MS = 60 * 60 * 1000; // don't buzz followers again within an hour

/**
 * The meeting link is the thing the paywall protects, so desk LISTS never
 * include it any more — it's only handed out by POST /api/desks/:id/join
 * after the access check passes. (Owners and admins still get it back on
 * their own desks so they can edit it.)
 */
function withoutLink(row) {
  if (!row) return row;
  const { google_meet_link, ...rest } = row;
  return rest;
}

/**
 * Adds `expires_at` (when a normal desk stops being listed unless its creator reuses it).
 * null for Special desks, which never expire. Lets the frontend show "ends in 5h"
 * without knowing the lifespan setting.
 */
function withExpiry(row) {
  if (!row) return row;
  if (row.is_special || !row.active_at) return { ...row, expires_at: null };
  return {
    ...row,
    expires_at: new Date(Date.parse(row.active_at) + getDeskConfig().lifespanHours * 3_600_000).toISOString(),
  };
}

/** Public shape of a desk in lists: no meeting link, with its expiry. */
const publicDesk = (row) => withExpiry(withoutLink(row));

/**
 * Returns the list of user ids whose desks should be hidden from `userId`
 * — i.e. everyone who has blocked `userId`. Desks are filtered by creator,
 * so once User 1 blocks User 2, every desk User 1 creates afterwards
 * disappears from User 2's dashboard and search.
 */
async function getCreatorIdsBlockingUser(userId) {
  if (!userId) return [];
  // remembered for a few seconds (the block/unblock handlers forget it at once)
  return remember(`blocking:${userId}`, 10_000, async () => {
    const { data, error } = await supabaseAdmin
      .from("user_blocks")
      .select("blocker_id")
      .eq("blocked_id", userId);
    if (error) throw error;
    return (data || []).map((r) => r.blocker_id);
  });
}

/**
 * Ids of every user an admin has platform-blocked. Their desks are hidden
 * from everyone's dashboard/search, same as expired desks would be.
 */
async function getAdminBlockedCreatorIds() {
  return remember("adminBlockedIds", 10_000, async () => {
    const { data, error } = await supabaseAdmin.from("users").select("id").eq("is_blocked", true);
    if (error) throw error;
    return (data || []).map((r) => r.id);
  });
}

/**
 * POST /api/desks
 * Creates a new desk. Requires auth (requireAuth middleware).
 * Body: { title, subject, description?, tags?, google_meet_link, topic? }
 * `subject` is the field the desk is about (Biology, Physics, ...) and is required.
 */
export async function createDesk(req, res) {
  try {
    const { title, subject, description, tags, google_meet_link, topic } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "title is required" });
    }
    const cleanSubject = typeof subject === "string" ? subject.trim().slice(0, MAX_SUBJECT) : "";
    if (!cleanSubject) {
      return res.status(400).json({ error: "Tell us the subject or field (e.g. Biology, Physics, Computer Science)" });
    }
    if (!google_meet_link || !MEETING_LINK_REGEX.test(google_meet_link.trim())) {
      return res.status(400).json({ error: "A valid meeting link is required" });
    }

    // Look up the creator's profile so the desk carries a display name/avatar
    // without the frontend needing to send it (and without trusting client input).
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("users")
      .select("name, avatar_url")
      .eq("id", req.user.id)
      .single();

    if (profileError || !profile) {
      return res
        .status(400)
        .json({ error: "User profile not found. Call POST /api/auth/sync after login first." });
    }

    const { data, error } = await supabaseAdmin
      .from("desks")
      .insert({
        title: title.trim(),
        subject: cleanSubject,
        description: description?.trim() || "",
        tags: Array.isArray(tags) ? tags : [],
        google_meet_link: google_meet_link.trim(),
        topic: topic?.trim() || "Research",
        creator_id: req.user.id,
        creator_name: profile.name,
        creator_avatar: profile.avatar_url,
      })
      .select()
      .single();

    if (error) throw error;

    // Tell everyone who follows this creator (best effort, never delays creating the desk).
    await notifyFollowers_bestEffort(req.user.id, profile.name, data, { reused: false });

    return res.status(201).json({ desk: withExpiry(data) });
  } catch (err) {
    console.error("createDesk error:", err);
    return res.status(500).json({ error: "Failed to create desk" });
  }
}

/**
 * Followers are the rows in `special_users` for this creator: anyone can follow a
 * creator themselves (POST /api/users/:id/follow), and they get a push notification
 * whenever that creator opens or reopens a desk.
 */
async function notifyFollowers_bestEffort(ownerId, ownerName, desk, opts) {
  try {
    // 1. Who has this creator marked "Special"?
    const { data: specialRows, error: specialError } = await supabaseAdmin
      .from("special_users")
      .select("special_user_id")
      .eq("owner_id", ownerId);

    if (specialError) throw specialError;

    const specialUserIds = (specialRows || []).map((r) => r.special_user_id);
    if (!specialUserIds.length) return;

    // 2. Which of those people have push notifications enabled on some
    // device? (A user only has a row here once they've granted browser/
    // phone notification permission on the frontend — see lib/push.ts.)
    const { data: subscriptions, error: subsError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .in("user_id", specialUserIds);

    if (subsError) throw subsError;
    if (!subscriptions?.length) return;

    await notifySpecialUsersOfNewDesk(
      { name: ownerName },
      { id: desk.id, title: desk.title, topic: desk.topic, subject: desk.subject, description: desk.description },
      subscriptions,
      opts
    );
  } catch (err) {
    console.error("notifyFollowers error (non-fatal):", err);
  }
}

/**
 * GET /api/desks
 * Returns active desks (opened or reused within the last DESK_LIFESPAN_HOURS, 24 by default),
 * most recently opened first.
 * If the requester is logged in, desks created by anyone who has blocked
 * them are excluded — from both the plain listing and search.
 *
 * Query params (all optional):
 *   limit   - how many desks to return per page (default 15, max 50)
 *   offset  - how many desks to skip (used for "load 15 more on scroll")
 *   search  - matched against title, subject and description on the DATABASE, not the client
 *   topic   - filter to a single topic (ignored if "All Desks")
 */
export async function getDesks(req, res) {
  try {
    const cutoff = deskCutoffIso();

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 50);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const topic = typeof req.query.topic === "string" ? req.query.topic.trim() : "";
    // Strip characters that would break the Postgres `.or()` filter syntax below.
    const search =
      typeof req.query.search === "string" ? req.query.search.trim().replace(/[%,()]/g, "") : "";

    const [blockingCreatorIds, adminBlockedIds] = await Promise.all([
      getCreatorIdsBlockingUser(req.user?.id),
      getAdminBlockedCreatorIds(),
    ]);
    const excludedCreatorIds = [...new Set([...blockingCreatorIds, ...adminBlockedIds])];

    let query = supabaseAdmin
      .from("desks")
      .select("*", { count: "exact" })
      .eq("is_special", false) // Special desks live in their own row/page, not the main grid.
      .eq("is_hidden", false) // Creator paused/hid it from the public dashboard.
      .gte("active_at", cutoff)
      .order("active_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,subject.ilike.%${search}%`);
    }
    if (topic && topic !== "All Desks") {
      query = query.eq("topic", topic);
    }
    if (excludedCreatorIds.length) {
      query = query.not("creator_id", "in", `(${excludedCreatorIds.join(",")})`);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    const total = count ?? 0;
    const hasMore = offset + data.length < total;

    return res.status(200).json({ desks: data.map(publicDesk), hasMore, total });
  } catch (err) {
    console.error("getDesks error:", err);
    return res.status(500).json({ error: "Failed to fetch desks" });
  }
}

/**
 * GET /api/desks/special
 * "Special" desks: created only from the Admin Panel, never auto-expire
 * (no 15-day cutoff), and always show a generic "JoinDesk" identity
 * instead of the admin's real name/avatar (enforced by the admin
 * controller at creation time, not here). Powers both the horizontal
 * preview row on the dashboard and the full `/special` page.
 *
 * Ordering: by `position` ascending — the exact order an admin arranged
 * them in from the Admin Panel (see admin.controller.js's move/position
 * endpoints) — falling back to newest-first for any desk that somehow has
 * no position yet, so nothing ever silently disappears from the list.
 *
 * Query params: limit, offset, search (title/description).
 */
export async function getSpecialDesks(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 50);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const search =
      typeof req.query.search === "string" ? req.query.search.trim().replace(/[%,()]/g, "") : "";

    let query = supabaseAdmin
      .from("desks")
      .select("*", { count: "exact" })
      .eq("is_special", true)
      .eq("is_hidden", false)
      .order("position", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,subject.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const total = count ?? 0;
    const hasMore = offset + data.length < total;

    return res.status(200).json({ desks: data.map(publicDesk), hasMore, total });
  } catch (err) {
    console.error("getSpecialDesks error:", err);
    return res.status(500).json({ error: "Failed to fetch special desks" });
  }
}

/**
 * PATCH /api/desks/:id
 * Lets a desk's own creator edit it (title/description/topic/meet link) —
 * this is the "edit from your profile" feature for normal users. An admin
 * (isAdmin claim on the token, see requireAdmin) may also edit ANY desk
 * here, which the Admin Panel uses to fix up Special desks. Normal users
 * can never change `is_special` themselves — that field is stripped
 * unless the requester is an admin.
 */
export async function updateDesk(req, res) {
  try {
    const { id } = req.params;
    const { title, subject, description, google_meet_link, topic, is_special, is_hidden } = req.body;

    const { data: desk, error: fetchError } = await supabaseAdmin
      .from("desks")
      .select("id, creator_id")
      .eq("id", id)
      .single();

    if (fetchError || !desk) {
      return res.status(404).json({ error: "Desk not found" });
    }

    const isAdmin = Boolean(req.user.isAdmin);
    const isOwner = desk.creator_id === req.user.id;
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "You can only edit your own desks" });
    }

    const updates = {};
    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ error: "title is required" });
      updates.title = title.trim();
    }
    if (subject !== undefined) {
      const cleanSubject = typeof subject === "string" ? subject.trim().slice(0, MAX_SUBJECT) : "";
      if (!cleanSubject) return res.status(400).json({ error: "Subject can't be empty" });
      updates.subject = cleanSubject;
    }
    if (description !== undefined) updates.description = description?.trim() || "";
    if (topic !== undefined && topic?.trim()) updates.topic = topic.trim();
    if (google_meet_link !== undefined) {
      if (!MEETING_LINK_REGEX.test(google_meet_link.trim())) {
        return res.status(400).json({ error: "A valid meeting link is required" });
      }
      updates.google_meet_link = google_meet_link.trim();
    }
    if (isAdmin && typeof is_special === "boolean") {
      updates.is_special = is_special;
    }
    // Owner (or admin) can hide/unhide a desk from the public dashboard
    // without deleting it — e.g. "I already have enough people, pause it
    // for now."
    if (typeof is_hidden === "boolean") {
      updates.is_hidden = is_hidden;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    const { data, error } = await supabaseAdmin
      .from("desks")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ desk: withExpiry(data) });
  } catch (err) {
    console.error("updateDesk error:", err);
    return res.status(500).json({ error: "Failed to update desk" });
  }
}

/**
 * DELETE /api/desks/:id
 * The creator can delete their own desk; an admin can delete any desk
 * (used by the Admin Panel to retire a Special desk — nothing else
 * deletes a Special desk, since they otherwise never expire).
 */
export async function deleteDesk(req, res) {
  try {
    const { id } = req.params;

    const { data: desk, error: fetchError } = await supabaseAdmin
      .from("desks")
      .select("id, creator_id")
      .eq("id", id)
      .single();

    if (fetchError || !desk) {
      return res.status(404).json({ error: "Desk not found" });
    }

    const isAdmin = Boolean(req.user.isAdmin);
    const isOwner = desk.creator_id === req.user.id;
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "You can only delete your own desks" });
    }

    const { error } = await supabaseAdmin.from("desks").delete().eq("id", id);
    if (error) throw error;

    return res.status(200).json({ deleted: true });
  } catch (err) {
    console.error("deleteDesk error:", err);
    return res.status(500).json({ error: "Failed to delete desk" });
  }
}

/**
 * GET /api/desks/mine
 * Same shape/pagination as GET /api/desks, but scoped to desks the current
 * user created — including expired ones, so their profile page shows a
 * complete history, not just what's currently "active".
 */
export async function getMyDesks(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 50);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const { data, error, count } = await supabaseAdmin
      .from("desks")
      .select("*", { count: "exact" })
      .eq("creator_id", req.user.id)
      .order("active_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const total = count ?? 0;
    const hasMore = offset + data.length < total;

    return res.status(200).json({ desks: data.map(withExpiry), hasMore, total });
  } catch (err) {
    console.error("getMyDesks error:", err);
    return res.status(500).json({ error: "Failed to fetch your desks" });
  }
}

/**
 * GET /api/users/:id/desks
 * Powers the desk list on a profile page. Behaves differently depending on
 * who's asking:
 *   - The profile owner viewing their own profile sees ALL desks they've
 *     ever created, including expired ones (a real history).
 *   - Anyone else sees only that user's currently-active desks — and sees
 *     none at all if that user has blocked them, matching dashboard rules.
 */
export async function getUserDesks(req, res) {
  try {
    const { id } = req.params;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 50);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const isOwner = req.user?.id === id;

    if (!isOwner) {
      const { data: blockRow } = await supabaseAdmin
        .from("user_blocks")
        .select("id")
        .eq("blocker_id", id)
        .eq("blocked_id", req.user?.id || "")
        .maybeSingle();

      if (blockRow) {
        return res.status(200).json({ desks: [], hasMore: false, total: 0 });
      }
    }

    let query = supabaseAdmin
      .from("desks")
      .select("*", { count: "exact" })
      .eq("creator_id", id)
      .order("active_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (!isOwner) {
      // other people only see this person's live desks: Special desks never expire
      query = query.or(`is_special.eq.true,active_at.gte.${deskCutoffIso()}`).eq("is_hidden", false);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const total = count ?? 0;
    const hasMore = offset + data.length < total;

    return res.status(200).json({
      desks: isOwner ? data.map(withExpiry) : data.map(publicDesk),
      hasMore,
      total,
    });
  } catch (err) {
    console.error("getUserDesks error:", err);
    return res.status(500).json({ error: "Failed to fetch user's desks" });
  }
}

/**
 * POST /api/desks/:id/join
 * Called when someone clicks "Join Meeting". In order:
 *   1. Access check (free grant / paid month / free trial). If they have
 *      none of those -> 402 and the frontend shows the payment screen.
 *   2. Logs the visit: one row in desk_join_events EVERY time (this feeds
 *      the admin analytics), plus the old unique desk_joins row used by the
 *      "People who joined" list, plus the user's activity counters.
 *   3. Returns the meeting link (it is not included in desk lists).
 * A desk's own creator is let straight in free (and their visit is logged too).
 */
export async function joinDesk(req, res) {
  try {
    const { id } = req.params;

    const { data: desk, error: deskError } = await supabaseAdmin
      .from("desks")
      .select("id, creator_id, google_meet_link, is_special, active_at")
      .eq("id", id)
      .single();

    if (deskError || !desk) {
      return res.status(404).json({ error: "Desk not found" });
    }

    if (desk.creator_id !== req.user.id && !req.user.isAdmin) {
      // an expired normal desk can't be joined (not even from an old link)
      if (!desk.is_special && desk.active_at < deskCutoffIso()) {
        return res.status(404).json({ error: "This desk has ended" });
      }
      // the creator blocked this person: it's as if the desk doesn't exist for them
      if (desk.creator_id) {
        const { data: blocked } = await supabaseAdmin
          .from("user_blocks")
          .select("id")
          .eq("blocker_id", desk.creator_id)
          .eq("blocked_id", req.user.id)
          .maybeSingle();
        if (blocked) return res.status(404).json({ error: "Desk not found" });
      }
    }

    // The desk's own creator is never charged, but their visit is still
    // logged so the admin's numbers match what really happened.
    const isOwner = desk.creator_id === req.user.id;
    let accessType = "owner";

    if (!isOwner) {
      const ctx = await loadAccessContext(req.user.id);
      const access = evaluateAccess(ctx, desk);

      if (!access.allowed) {
        return res.status(402).json({
          error: "payment_required",
          code: "PAYMENT_REQUIRED",
          ...paymentInfo(undefined, ctx?.payment, access),
        });
      }
      accessType = access.type;

      // desk_joins (one row per person) feeds the public "People who joined" list.
      const { error: joinError } = await supabaseAdmin
        .from("desk_joins")
        .upsert(
          { desk_id: id, user_id: req.user.id },
          { onConflict: "desk_id,user_id", ignoreDuplicates: true }
        );
      if (joinError) throw joinError;
    }

    const nowIso = new Date().toISOString();

    // desk_join_events = every single visit (feeds the admin analytics).
    const { error: eventError } = await supabaseAdmin.from("desk_join_events").insert({
      desk_id: id,
      user_id: req.user.id,
      joined_at: nowIso,
      access_type: accessType,
    });
    if (eventError) throw eventError;

    // Activity counters (best-effort: never block someone from joining just
    // because a counter update failed).
    try {
      const { data: row } = await supabaseAdmin
        .from("users")
        .select("total_joins")
        .eq("id", req.user.id)
        .single();
      await supabaseAdmin
        .from("users")
        .update({ total_joins: (row?.total_joins || 0) + 1, last_join_at: nowIso })
        .eq("id", req.user.id);
    } catch (counterErr) {
      console.error("join counter update failed (non-fatal):", counterErr);
    }

    return res
      .status(200)
      .json({ joined: true, meetLink: desk.google_meet_link, access: accessType });
  } catch (err) {
    console.error("joinDesk error:", err);
    return res.status(500).json({ error: "Failed to record join" });
  }
}

/**
 * GET /api/desks/:id/joiners
 * The desk's own creator can always see this. An admin (isAdmin claim on
 * the token) can also view the joiners of ANY desk — used by the Admin
 * Panel's "View joiners" action so an admin can moderate any group, not
 * just their own. Everyone else gets a 403, unchanged.
 */
export async function getDeskJoiners(req, res) {
  try {
    const { id } = req.params;
    const search =
      typeof req.query.search === "string" ? req.query.search.trim().replace(/[%,()]/g, "") : "";

    const { data: desk, error: deskError } = await supabaseAdmin
      .from("desks")
      .select("id, creator_id, title")
      .eq("id", id)
      .single();

    if (deskError || !desk) {
      return res.status(404).json({ error: "Desk not found" });
    }
    const isAdmin = Boolean(req.user.isAdmin);
    const isCreator = desk.creator_id === req.user.id;
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: "Only the desk creator can view joiners" });
    }

    let query = supabaseAdmin
      .from("desk_joins")
      .select("joined_at, users:user_id (id, name, email, avatar_url, is_blocked)")
      .eq("desk_id", id)
      .order("joined_at", { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    // "Special"/"blocked" here are relative to the desk's OWNER (their own
    // personal special_users/user_blocks lists) — meaningful when the
    // creator is viewing their own desk. When an admin views someone
    // else's desk, these are naturally empty/false; `isPlatformBlocked`
    // (from users.is_blocked) is the one that matters for admin moderation.
    const [{ data: specialRows }, { data: blockRows }] = await Promise.all([
      supabaseAdmin.from("special_users").select("special_user_id").eq("owner_id", desk.creator_id),
      supabaseAdmin.from("user_blocks").select("blocked_id").eq("blocker_id", desk.creator_id),
    ]);
    const specialIds = new Set((specialRows || []).map((r) => r.special_user_id));
    const blockedIds = new Set((blockRows || []).map((r) => r.blocked_id));

    let joiners = (data || [])
      .filter((r) => r.users)
      .map((r) => ({
        id: r.users.id,
        name: r.users.name,
        email: r.users.email,
        avatar_url: r.users.avatar_url,
        joined_at: r.joined_at,
        isSpecial: specialIds.has(r.users.id),
        isBlocked: blockedIds.has(r.users.id),
        isPlatformBlocked: Boolean(r.users.is_blocked),
      }));

    if (search) {
      const needle = search.toLowerCase();
      joiners = joiners.filter(
        (u) => u.name?.toLowerCase().includes(needle) || u.email?.toLowerCase().includes(needle)
      );
    }

    return res.status(200).json({ deskTitle: desk.title, joiners });
  } catch (err) {
    console.error("getDeskJoiners error:", err);
    return res.status(500).json({ error: "Failed to fetch joiners" });
  }
}

/**
 * POST /api/desks/:id/reuse
 * The creator reopens one of their normal desks (usually an expired one, from their
 * profile). It becomes active again for another DESK_LIFESPAN_HOURS, goes back to the
 * top of the list, is unhidden, and the people who follow the creator get a
 * notification (not more than once an hour per desk).
 */
export async function reuseDesk(req, res) {
  try {
    const { id } = req.params;
    const { data: desk, error: fetchError } = await supabaseAdmin
      .from("desks")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchError || !desk) return res.status(404).json({ error: "Desk not found" });
    if (desk.creator_id !== req.user.id) {
      return res.status(403).json({ error: "You can only reuse your own desks" });
    }
    if (desk.is_special) return res.status(400).json({ error: "Special desks never expire" });

    const previous = Date.parse(desk.active_at);
    const now = Date.now();
    const { data, error } = await supabaseAdmin
      .from("desks")
      .update({ active_at: new Date(now).toISOString(), is_hidden: false })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    if (!Number.isFinite(previous) || now - previous >= REUSE_NOTIFY_GAP_MS) {
      await notifyFollowers_bestEffort(req.user.id, data.creator_name, data, { reused: true });
    }
    return res.status(200).json({ desk: withExpiry(data) });
  } catch (err) {
    console.error("reuseDesk error:", err);
    return res.status(500).json({ error: "Failed to reuse the desk" });
  }
}
