import jwt from "jsonwebtoken";
import "dotenv/config";
import { supabaseAdmin } from "../config/supabase.js";

const { JWT_SECRET, ADMIN_PASSWORD } = process.env;
// Falls back to the password chosen when this feature was built, so the
// Admin Panel works out of the box. Override with your own ADMIN_PASSWORD
// in .env for a production deployment.
const EFFECTIVE_ADMIN_PASSWORD = ADMIN_PASSWORD || "Asha@0507$$19992003";

const MEETING_LINK_REGEX = /^https?:\/\/.+\..+/i; // any platform: Google Meet, Zoom, Teams, etc.

/**
 * POST /api/admin/unlock
 * Body: { password }
 * Requires a normal login first (requireAuth) — the password is a second
 * factor on top of "you're a signed-in user", not a replacement for
 * signing in. Any signed-in Google account that knows the password gets
 * admin rights for that session (this is intentional — see the project
 * brief: you may sometimes be logged in with a different email and still
 * want to open the Admin Panel).
 *
 * On success, returns a short-lived admin token (12h) carrying an
 * `isAdmin: true` claim. The frontend stores this SEPARATELY from the
 * normal session token and sends it only on /api/admin/* requests.
 */
export function unlockAdmin(req, res) {
  const { password } = req.body || {};
  if (!password || password !== EFFECTIVE_ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Incorrect admin password" });
  }

  const adminToken = jwt.sign(
    { id: req.user.id, email: req.user.email, isAdmin: true },
    JWT_SECRET,
    { expiresIn: "12h" }
  );

  return res.status(200).json({ adminToken });
}

/**
 * GET /api/admin/desks
 * Every desk on the platform — Special and normal, active and expired —
 * so the admin can see and manage everything in one place.
 * Query: search, special ("true" | "false" | omit for all), limit, offset.
 *
 * Ordering: when filtered to Special desks only, sorted by `position`
 * (the admin's own manual order — see moveSpecialDesk/setSpecialDeskPosition
 * below) so this list matches what the up/down arrows are actually doing.
 * Otherwise (All / Normal), unchanged: newest first.
 */
export async function listDesks(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const search =
      typeof req.query.search === "string" ? req.query.search.trim().replace(/[%,()]/g, "") : "";
    const special = req.query.special; // "true" | "false" | undefined

    let query = supabaseAdmin.from("desks").select("*", { count: "exact" });

    if (special === "true") {
      query = query
        .eq("is_special", true)
        .order("position", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }
    query = query.range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }
    // "true" is already filtered above (needed before the .order() calls);
    // only "false" still needs applying here.
    if (special === "false") query = query.eq("is_special", false);

    const { data, error, count } = await query;
    if (error) throw error;

    const total = count ?? 0;
    const hasMore = offset + data.length < total;

    return res.status(200).json({ desks: data, hasMore, total });
  } catch (err) {
    console.error("admin listDesks error:", err);
    return res.status(500).json({ error: "Failed to fetch desks" });
  }
}

/**
 * POST /api/admin/desks
 * Body: { title, description?, google_meet_link, topic?, is_special? }
 *
 * When is_special is true: the desk never expires (no 15-day cutoff
 * applies to it — see getSpecialDesks) and the creator identity shown in
 * the UI is a generic "JoinDesk" badge, never the admin's real name or
 * avatar. When is_special is false, this behaves exactly like a normal
 * user creating a desk (shows the admin's real name/avatar, subject to
 * the normal 15-day lifespan) — useful for the admin's own everyday
 * desks alongside their Special ones.
 *
 * A new Special desk is appended to the END of the Special order (last
 * position + 1) instead of jumping to the front — the admin can then use
 * PATCH /api/admin/desks/:id/move or /position to place it wherever they
 * actually want it.
 */
export async function createDesk(req, res) {
  try {
    const { title, description, google_meet_link, topic, is_special } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "title is required" });
    }
    if (!google_meet_link || !MEETING_LINK_REGEX.test(google_meet_link.trim())) {
      return res.status(400).json({ error: "A valid meeting link is required" });
    }

    const special = Boolean(is_special);
    let creator_name = "JoinDesk";
    let creator_avatar = null;
    let position = null;

    if (!special) {
      const { data: profile } = await supabaseAdmin
        .from("users")
        .select("name, avatar_url")
        .eq("id", req.user.id)
        .single();
      creator_name = profile?.name || "JoinDesk";
      creator_avatar = profile?.avatar_url || null;
    } else {
      const { data: lastRow } = await supabaseAdmin
        .from("desks")
        .select("position")
        .eq("is_special", true)
        .order("position", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      position = (lastRow?.position || 0) + 1;
    }

    const { data, error } = await supabaseAdmin
      .from("desks")
      .insert({
        title: title.trim(),
        description: description?.trim() || "",
        tags: [],
        google_meet_link: google_meet_link.trim(),
        topic: topic?.trim() || "Research",
        creator_id: req.user.id,
        creator_name,
        creator_avatar,
        is_special: special,
        position,
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ desk: data });
  } catch (err) {
    console.error("admin createDesk error:", err);
    return res.status(500).json({ error: "Failed to create desk" });
  }
}

/**
 * Shared helpers for the Special-desk manual ordering feature
 * (moveSpecialDesk / setSpecialDeskPosition below).
 */
async function getOrderedSpecialDeskIds() {
  const { data, error } = await supabaseAdmin
    .from("desks")
    .select("id")
    .eq("is_special", true)
    .order("position", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((d) => d.id);
}

// Sequential updates — the Special list is admin-curated and small, so this
// stays simple and safe rather than reaching for a Postgres function/RPC.
async function renumberSpecialDesks(orderedIds) {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabaseAdmin
      .from("desks")
      .update({ position: i + 1 })
      .eq("id", orderedIds[i]);
    if (error) throw error;
  }
}

/**
 * PATCH /api/admin/desks/:id/move
 * Body: { direction: "up" | "down" }
 * Swaps this Special desk with its immediate neighbor in the current
 * order. A no-op (not an error) if it's already at the top/bottom.
 */
export async function moveSpecialDesk(req, res) {
  try {
    const { id } = req.params;
    const { direction } = req.body || {};
    if (direction !== "up" && direction !== "down") {
      return res.status(400).json({ error: "direction must be 'up' or 'down'" });
    }

    const ids = await getOrderedSpecialDeskIds();
    const idx = ids.indexOf(id);
    if (idx === -1) {
      return res.status(404).json({ error: "Special desk not found" });
    }

    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= ids.length) {
      return res.status(200).json({ moved: false }); // already at the edge
    }

    [ids[idx], ids[swapWith]] = [ids[swapWith], ids[idx]];
    await renumberSpecialDesks(ids);

    return res.status(200).json({ moved: true });
  } catch (err) {
    console.error("admin moveSpecialDesk error:", err);
    return res.status(500).json({ error: "Failed to reorder desk" });
  }
}

/**
 * PATCH /api/admin/desks/:id/position
 * Body: { position: number } (1-based — "2" means second in the Special
 * row, and anything at or past the list length means "move to last").
 * Pulls the desk out of its current spot and reinserts it at the target
 * spot, then renumbers everyone 1..N so the order stays contiguous.
 */
export async function setSpecialDeskPosition(req, res) {
  try {
    const { id } = req.params;
    const position = parseInt(req.body?.position, 10);
    if (!Number.isFinite(position) || position < 1) {
      return res.status(400).json({ error: "position must be a positive whole number" });
    }

    const ids = await getOrderedSpecialDeskIds();
    const idx = ids.indexOf(id);
    if (idx === -1) {
      return res.status(404).json({ error: "Special desk not found" });
    }

    ids.splice(idx, 1);
    const target = Math.min(Math.max(position - 1, 0), ids.length);
    ids.splice(target, 0, id);

    await renumberSpecialDesks(ids);

    return res.status(200).json({ moved: true, position: target + 1 });
  } catch (err) {
    console.error("admin setSpecialDeskPosition error:", err);
    return res.status(500).json({ error: "Failed to reorder desk" });
  }
}

/**
 * GET /api/admin/feedback
 * All suggestions and complaints, newest first, with the reporter's name/
 * email, the (optional) name of the person a complaint is about, and the
 * (optional) desk that person was in attached — so an admin can review
 * what came in, spot a pattern (several different reporters naming the
 * same person/desk), and manually block from the Users tab.
 * Query: type ("suggestion" | "complaint" | omit for all),
 *        status ("pending" | "resolved" | "problem" | omit for all),
 *        limit, offset.
 */
export async function listFeedback(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const type = req.query.type; // "suggestion" | "complaint" | undefined
    const status = req.query.status; // "pending" | "resolved" | "problem" | undefined

    let query = supabaseAdmin
      .from("feedback")
      .select(
        "id, type, message, status, created_at, reported_name, reporter:user_id (id, name, email), reported_desk:reported_desk_id (id, title)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (type === "suggestion" || type === "complaint") {
      query = query.eq("type", type);
    }
    if (status === "pending" || status === "resolved" || status === "problem") {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const total = count ?? 0;
    const hasMore = offset + data.length < total;

    return res.status(200).json({ feedback: data, hasMore, total });
  } catch (err) {
    console.error("admin listFeedback error:", err);
    return res.status(500).json({ error: "Failed to fetch feedback" });
  }
}

/**
 * PATCH /api/admin/feedback/:id/status
 * Body: { status: "pending" | "resolved" | "problem" }
 *
 * Drives the three-way workflow in the Admin Panel's Feedback tab:
 * "pending" (Incomplete, the default for anything just submitted),
 * "resolved" (Complete — admin looked into it and it's done), and
 * "problem" (admin looked into it but hit a snag — stays out of Complete
 * until it's fixed, at which point the admin flips it back to resolved).
 */
export async function updateFeedbackStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!["pending", "resolved", "problem"].includes(status)) {
      return res
        .status(400)
        .json({ error: "status must be 'pending', 'resolved', or 'problem'" });
    }

    const { data, error } = await supabaseAdmin
      .from("feedback")
      .update({ status })
      .eq("id", id)
      .select(
        "id, type, message, status, created_at, reported_name, reporter:user_id (id, name, email), reported_desk:reported_desk_id (id, title)"
      )
      .single();

    if (error) throw error;

    return res.status(200).json({ feedback: data });
  } catch (err) {
    console.error("admin updateFeedbackStatus error:", err);
    return res.status(500).json({ error: "Failed to update feedback status" });
  }
}

/**
 * GET /api/admin/users
 * Search/list users for the Block/Unblock screen.
 * Query: search (name/email), limit, offset.
 */
export async function listUsers(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const search =
      typeof req.query.search === "string" ? req.query.search.trim().replace(/[%,()]/g, "") : "";

    let query = supabaseAdmin
      .from("users")
      .select("id, name, email, avatar_url, is_blocked, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const total = count ?? 0;
    const hasMore = offset + data.length < total;

    return res.status(200).json({ users: data, hasMore, total });
  } catch (err) {
    console.error("admin listUsers error:", err);
    return res.status(500).json({ error: "Failed to fetch users" });
  }
}

/**
 * POST /api/admin/users/:id/block
 * Platform-wide ban. The user is signed out of every future request
 * (requireAuth re-checks is_blocked) and can't log back in
 * (googleLogin also checks it) — they only ever see the "blocked" screen.
 */
export async function blockUserAdmin(req, res) {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from("users")
      .update({ is_blocked: true, blocked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return res.status(200).json({ blocked: true });
  } catch (err) {
    console.error("admin blockUser error:", err);
    return res.status(500).json({ error: "Failed to block user" });
  }
}

/**
 * POST /api/admin/users/:id/unblock
 */
export async function unblockUserAdmin(req, res) {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from("users")
      .update({ is_blocked: false, blocked_at: null })
      .eq("id", id);
    if (error) throw error;
    return res.status(200).json({ blocked: false });
  } catch (err) {
    console.error("admin unblockUser error:", err);
    return res.status(500).json({ error: "Failed to unblock user" });
  }
}

/**
 * PATCH /api/admin/announcement
 * Body: { message: string }
 * Sets (or clears, with an empty/whitespace-only string) the site-wide
 * notice banner every logged-in user sees at the top of the dashboard.
 */
export async function setAnnouncement(req, res) {
  try {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const { error } = await supabaseAdmin.from("site_settings").upsert({
      key: "announcement",
      value: message || null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return res.status(200).json({ message: message || null });
  } catch (err) {
    console.error("admin setAnnouncement error:", err);
    return res.status(500).json({ error: "Failed to save the announcement" });
  }
}

