import { supabaseAdmin } from "../config/supabase.js";

const MEET_LINK_REGEX = /^https?:\/\/(meet\.google\.com|.+)\/.+/i;
const DESK_LIFESPAN_HOURS = 3;

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

    return res.status(201).json({ desk: data });
  } catch (err) {
    console.error("createDesk error:", err);
    return res.status(500).json({ error: "Failed to create desk" });
  }
}

/**
 * GET /api/desks
 * Public. Returns active desks (created within the last 3 hours), newest first.
 * Desks are not tracked for membership — the frontend simply reads
 * google_meet_link from the returned rows and opens it directly.
 *
 * Query params (all optional):
 *   limit   - how many desks to return per page (default 15, max 50)
 *   offset  - how many desks to skip (used for "load 15 more on scroll")
 *   search  - matched against title/description on the DATABASE, not the client
 *   topic   - filter to a single topic (ignored if "All Desks")
 */
export async function getDesks(req, res) {
  try {
    const cutoff = new Date(Date.now() - DESK_LIFESPAN_HOURS * 60 * 60 * 1000).toISOString();

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 50);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const topic = typeof req.query.topic === "string" ? req.query.topic.trim() : "";
    // Strip characters that would break the Postgres `.or()` filter syntax below.
    const search =
      typeof req.query.search === "string" ? req.query.search.trim().replace(/[%,()]/g, "") : "";

    let query = supabaseAdmin
      .from("desks")
      .select("*", { count: "exact" })
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }
    if (topic && topic !== "All Desks") {
      query = query.eq("topic", topic);
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
