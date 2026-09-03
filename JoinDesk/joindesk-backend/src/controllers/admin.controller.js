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
 */
export async function listDesks(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const search =
      typeof req.query.search === "string" ? req.query.search.trim().replace(/[%,()]/g, "") : "";
    const special = req.query.special; // "true" | "false" | undefined

    let query = supabaseAdmin
      .from("desks")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }
    if (special === "true") query = query.eq("is_special", true);
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

    if (!special) {
      const { data: profile } = await supabaseAdmin
        .from("users")
        .select("name, avatar_url")
        .eq("id", req.user.id)
        .single();
      creator_name = profile?.name || "JoinDesk";
      creator_avatar = profile?.avatar_url || null;
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
 * GET /api/admin/feedback
 * All suggestions and complaints, newest first, with the reporter's and
 * (for complaints) reported user's name/email attached — so an admin can
 * review what came in, double-check auto-blocks, or manually block/unblock
 * from the Users tab based on a pattern of complaints.
 * Query: type ("suggestion" | "complaint" | omit for all), limit, offset.
 */
export async function listFeedback(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const type = req.query.type; // "suggestion" | "complaint" | undefined

    let query = supabaseAdmin
      .from("feedback")
      .select(
        "id, type, message, created_at, reporter:user_id (id, name, email), reported:reported_user_id (id, name, email, is_blocked)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (type === "suggestion" || type === "complaint") {
      query = query.eq("type", type);
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
