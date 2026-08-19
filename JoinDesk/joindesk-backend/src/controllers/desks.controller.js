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
 */
export async function getDesks(req, res) {
  try {
    const cutoff = new Date(Date.now() - DESK_LIFESPAN_HOURS * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from("desks")
      .select("*")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json({ desks: data });
  } catch (err) {
    console.error("getDesks error:", err);
    return res.status(500).json({ error: "Failed to fetch desks" });
  }
}
