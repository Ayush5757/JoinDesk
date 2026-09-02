import { supabaseAdmin } from "../config/supabase.js";
import { notifySpecialUsersOfNewDesk } from "../services/push.js";

const MEET_LINK_REGEX = /^https?:\/\/(meet\.google\.com|.+)\/.+/i;
const DESK_LIFESPAN_DAYS = 15;

/**
 * Returns the list of user ids whose desks should be hidden from `userId`
 * — i.e. everyone who has blocked `userId`. Desks are filtered by creator,
 * so once User 1 blocks User 2, every desk User 1 creates afterwards
 * disappears from User 2's dashboard and search.
 */
async function getCreatorIdsBlockingUser(userId) {
  if (!userId) return [];
  const { data, error } = await supabaseAdmin
    .from("user_blocks")
    .select("blocker_id")
    .eq("blocked_id", userId);
  if (error) throw error;
  return (data || []).map((r) => r.blocker_id);
}

/**
 * Ids of every user an admin has platform-blocked. Their desks are hidden
 * from everyone's dashboard/search, same as expired desks would be.
 */
async function getAdminBlockedCreatorIds() {
  const { data, error } = await supabaseAdmin.from("users").select("id").eq("is_blocked", true);
  if (error) throw error;
  return (data || []).map((r) => r.id);
}

/**
 * POST /api/desks
 * Creates a new desk. Requires auth (requireAuth middleware).
 * Body: { title, description?, tags?, google_meet_link, topic? }
 */
export async function createDesk(req, res) {
  try {
    const { title, description, tags, google_meet_link, topic } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "title is required" });
    }
    if (!google_meet_link || !MEET_LINK_REGEX.test(google_meet_link.trim())) {
      return res.status(400).json({ error: "A valid google_meet_link is required" });
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

    // Notify anyone this creator has marked "Special" — fire-and-forget so a
    // slow/broken mail server never delays or breaks desk creation.
    notifySpecialUsersOfNewDesk_bestEffort(req.user.id, profile.name, data);

    return res.status(201).json({ desk: data });
  } catch (err) {
    console.error("createDesk error:", err);
    return res.status(500).json({ error: "Failed to create desk" });
  }
}

async function notifySpecialUsersOfNewDesk_bestEffort(ownerId, ownerName, desk) {
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
      { id: desk.id, title: desk.title, topic: desk.topic, description: desk.description },
      subscriptions
    );
  } catch (err) {
    console.error("notifySpecialUsersOfNewDesk error (non-fatal):", err);
  }
}

/**
 * GET /api/desks
 * Returns active desks (created within the last 15 days), newest first.
 * If the requester is logged in, desks created by anyone who has blocked
 * them are excluded — from both the plain listing and search.
 *
 * Query params (all optional):
 *   limit   - how many desks to return per page (default 15, max 50)
 *   offset  - how many desks to skip (used for "load 15 more on scroll")
 *   search  - matched against title/description on the DATABASE, not the client
 *   topic   - filter to a single topic (ignored if "All Desks")
 */
export async function getDesks(req, res) {
  try {
    const cutoff = new Date(
      Date.now() - DESK_LIFESPAN_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

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
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
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

    return res.status(200).json({ desks: data, hasMore, total });
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
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const total = count ?? 0;
    const hasMore = offset + data.length < total;

    return res.status(200).json({ desks: data, hasMore, total });
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
    const { title, description, google_meet_link, topic, is_special } = req.body;

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
    if (description !== undefined) updates.description = description?.trim() || "";
    if (topic !== undefined && topic?.trim()) updates.topic = topic.trim();
    if (google_meet_link !== undefined) {
      if (!MEET_LINK_REGEX.test(google_meet_link.trim())) {
        return res.status(400).json({ error: "A valid google_meet_link is required" });
      }
      updates.google_meet_link = google_meet_link.trim();
    }
    if (isAdmin && typeof is_special === "boolean") {
      updates.is_special = is_special;
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

    return res.status(200).json({ desk: data });
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
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const total = count ?? 0;
    const hasMore = offset + data.length < total;

    return res.status(200).json({ desks: data, hasMore, total });
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
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (!isOwner) {
      const cutoff = new Date(
        Date.now() - DESK_LIFESPAN_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();
      query = query.gte("created_at", cutoff);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const total = count ?? 0;
    const hasMore = offset + data.length < total;

    return res.status(200).json({ desks: data, hasMore, total });
  } catch (err) {
    console.error("getUserDesks error:", err);
    return res.status(500).json({ error: "Failed to fetch user's desks" });
  }
}

/**
 * POST /api/desks/:id/join
 * Records that the current user joined this desk (clicked "Join via Google
 * Meet"). Idempotent — joining the same desk twice is a no-op.
 */
export async function joinDesk(req, res) {
  try {
    const { id } = req.params;

    const { data: desk, error: deskError } = await supabaseAdmin
      .from("desks")
      .select("id")
      .eq("id", id)
      .single();

    if (deskError || !desk) {
      return res.status(404).json({ error: "Desk not found" });
    }

    const { error } = await supabaseAdmin
      .from("desk_joins")
      .upsert(
        { desk_id: id, user_id: req.user.id },
        { onConflict: "desk_id,user_id", ignoreDuplicates: true }
      );

    if (error) throw error;

    return res.status(200).json({ joined: true });
  } catch (err) {
    console.error("joinDesk error:", err);
    return res.status(500).json({ error: "Failed to record join" });
  }
}

/**
 * GET /api/desks/:id/joiners
 * Only the desk's creator can see this. Returns everyone who has joined,
 * newest first, with an `isSpecial` flag and optional `search` by name/email.
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
    if (desk.creator_id !== req.user.id) {
      return res.status(403).json({ error: "Only the desk creator can view joiners" });
    }

    let query = supabaseAdmin
      .from("desk_joins")
      .select("joined_at, users:user_id (id, name, email, avatar_url)")
      .eq("desk_id", id)
      .order("joined_at", { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    const [{ data: specialRows }, { data: blockRows }] = await Promise.all([
      supabaseAdmin.from("special_users").select("special_user_id").eq("owner_id", req.user.id),
      supabaseAdmin.from("user_blocks").select("blocked_id").eq("blocker_id", req.user.id),
    ]);
    const specialIds = new Set((specialRows || []).map((r) => r.special_user_id));
    const blockedIds = new Set((blockRows || []).map((r) => r.blocked_id));

    let joiners = (data || [])
      .filter((r) => r.users)
      .map((r) => ({
        ...r.users,
        joined_at: r.joined_at,
        isSpecial: specialIds.has(r.users.id),
        isBlocked: blockedIds.has(r.users.id),
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
