import "dotenv/config";
import { supabaseAdmin } from "../config/supabase.js";

const ANNOUNCEMENT_KEY = "announcement";

/**
 * GET /api/announcement
 * Public (no auth needed) — the single site-wide notice an admin can set
 * from the Admin Panel, shown as a banner at the top of the dashboard.
 * Never throws: if this table/row isn't there yet, just behave as if
 * there's no announcement rather than breaking the dashboard.
 */
export async function getAnnouncement(req, res) {
  try {
    const { data } = await supabaseAdmin
      .from("site_settings")
      .select("value, updated_at")
      .eq("key", ANNOUNCEMENT_KEY)
      .maybeSingle();

    return res.status(200).json({
      message: data?.value?.trim() || null,
      updatedAt: data?.updated_at || null,
    });
  } catch (err) {
    console.error("getAnnouncement error:", err);
    return res.status(200).json({ message: null, updatedAt: null });
  }
}
