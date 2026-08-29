import { supabaseAdmin } from "../config/supabase.js";
import { uploadAvatar } from "../services/storage.js";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/**
 * GET /api/users/:id
 * Public profile — view-only fields collected at signup. Also tells the
 * viewer (if logged in) whether they've blocked this user, or vice versa,
 * so the frontend can render the right Block/Unblock button state.
 */
export async function getPublicProfile(req, res) {
  try {
    const { id } = req.params;

    const { data: profile, error } = await supabaseAdmin
      .from("users")
      .select("id, name, email, avatar_url, created_at")
      .eq("id", id)
      .single();

    if (error || !profile) {
      return res.status(404).json({ error: "User not found" });
    }

    const isOwner = req.user?.id === id;
    let iBlockedThem = false;
    let theyBlockedMe = false;

    if (req.user && !isOwner) {
      const [{ data: a }, { data: b }] = await Promise.all([
        supabaseAdmin
          .from("user_blocks")
          .select("id")
          .eq("blocker_id", req.user.id)
          .eq("blocked_id", id)
          .maybeSingle(),
        supabaseAdmin
          .from("user_blocks")
          .select("id")
          .eq("blocker_id", id)
          .eq("blocked_id", req.user.id)
          .maybeSingle(),
      ]);
      iBlockedThem = Boolean(a);
      theyBlockedMe = Boolean(b);
    }

    return res.status(200).json({
      user: {
        id: profile.id,
        name: profile.name,
        // Email is only shown to the profile owner — everyone else just
        // sees name/avatar/join date, matching "view-only" without
        // exposing contact info platform-wide.
        email: isOwner ? profile.email : undefined,
        avatar_url: profile.avatar_url,
        created_at: profile.created_at,
      },
      isOwner,
      iBlockedThem,
      theyBlockedMe,
    });
  } catch (err) {
    console.error("getPublicProfile error:", err);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
}

/**
 * PATCH /api/users/me/avatar
 * Multipart upload (field name "avatar"). The only editable profile field.
 */
export async function updateAvatar(req, res) {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No image file provided (field name: avatar)" });
    }
    if (!ALLOWED_AVATAR_TYPES.has(file.mimetype)) {
      return res.status(400).json({ error: "Unsupported image type" });
    }
    if (file.size > MAX_AVATAR_BYTES) {
      return res.status(400).json({ error: "Image must be under 5MB" });
    }

    const publicUrl = await uploadAvatar(req.user.id, file.buffer, file.mimetype);

    const { data: user, error } = await supabaseAdmin
      .from("users")
      .update({ avatar_url: publicUrl })
      .eq("id", req.user.id)
      .select("id, name, email, avatar_url, created_at")
      .single();

    if (error) throw error;

    return res.status(200).json({ user });
  } catch (err) {
    console.error("updateAvatar error:", err);
    return res.status(500).json({ error: "Failed to update profile picture" });
  }
}

/**
 * POST /api/users/:id/block
 * Blocks the target user. Any desks that user creates from now on are
 * hidden from the blocker's dashboard/search (see desks.controller.js).
 */
export async function blockUser(req, res) {
  try {
    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ error: "You can't block yourself" });
    }

    const { error } = await supabaseAdmin
      .from("user_blocks")
      .upsert({ blocker_id: req.user.id, blocked_id: id }, { onConflict: "blocker_id,blocked_id" });

    if (error) throw error;

    return res.status(200).json({ blocked: true });
  } catch (err) {
    console.error("blockUser error:", err);
    return res.status(500).json({ error: "Failed to block user" });
  }
}

/**
 * POST /api/users/:id/unblock
 */
export async function unblockUser(req, res) {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from("user_blocks")
      .delete()
      .eq("blocker_id", req.user.id)
      .eq("blocked_id", id);

    if (error) throw error;

    return res.status(200).json({ blocked: false });
  } catch (err) {
    console.error("unblockUser error:", err);
    return res.status(500).json({ error: "Failed to unblock user" });
  }
}

/**
 * GET /api/users/me/blocks
 * List of users the current user has blocked (for a "Blocked users"
 * management view, and so the joiners popup can show correct button state).
 */
export async function getMyBlocks(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from("user_blocks")
      .select("blocked_id, users:blocked_id (id, name, avatar_url)")
      .eq("blocker_id", req.user.id);

    if (error) throw error;

    return res.status(200).json({ blocked: (data || []).map((r) => r.users).filter(Boolean) });
  } catch (err) {
    console.error("getMyBlocks error:", err);
    return res.status(500).json({ error: "Failed to fetch blocked users" });
  }
}

/**
 * POST /api/users/:id/special
 * Marks a user as "Special". Only allowed if they've actually joined one of
 * the current user's desks (keeps this scoped to real interactions).
 */
export async function markSpecial(req, res) {
  try {
    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ error: "You can't mark yourself as special" });
    }

    const { data: hasJoined, error: joinError } = await supabaseAdmin
      .from("desk_joins")
      .select("id, desks!inner(creator_id)")
      .eq("user_id", id)
      .eq("desks.creator_id", req.user.id)
      .limit(1)
      .maybeSingle();

    if (joinError) throw joinError;
    if (!hasJoined) {
      return res
        .status(400)
        .json({ error: "You can only mark people who've joined one of your desks" });
    }

    const { error } = await supabaseAdmin
      .from("special_users")
      .upsert(
        { owner_id: req.user.id, special_user_id: id },
        { onConflict: "owner_id,special_user_id" }
      );

    if (error) throw error;

    return res.status(200).json({ special: true });
  } catch (err) {
    console.error("markSpecial error:", err);
    return res.status(500).json({ error: "Failed to mark user as special" });
  }
}

/**
 * DELETE /api/users/:id/special
 */
export async function unmarkSpecial(req, res) {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from("special_users")
      .delete()
      .eq("owner_id", req.user.id)
      .eq("special_user_id", id);

    if (error) throw error;

    return res.status(200).json({ special: false });
  } catch (err) {
    console.error("unmarkSpecial error:", err);
    return res.status(500).json({ error: "Failed to unmark user" });
  }
}

/**
 * GET /api/users/me/special
 */
export async function getMySpecial(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from("special_users")
      .select("special_user_id, users:special_user_id (id, name, avatar_url)")
      .eq("owner_id", req.user.id);

    if (error) throw error;

    return res.status(200).json({ special: (data || []).map((r) => r.users).filter(Boolean) });
  } catch (err) {
    console.error("getMySpecial error:", err);
    return res.status(500).json({ error: "Failed to fetch special users" });
  }
}
