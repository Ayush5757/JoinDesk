import { supabaseAdmin } from "../config/supabase.js";

/**
 * POST /api/feedback
 * Body: { type: "suggestion" | "complaint", message }
 *
 * Simple text feedback — no "report this User ID" targeting. (That was
 * tried and dropped: people meeting on a Google Meet call have no way to
 * see each other's JoinDesk account/User ID, only their Meet display
 * name, so asking for a User ID here was unusable in practice. For now,
 * a disruptive person in a live call is handled directly in Google
 * Meet — the host removes them from the call — and an admin can always
 * platform-block a repeat offender manually from the Admin Panel once
 * they know who it is.)
 */
export async function createFeedback(req, res) {
  try {
    const { type, message } = req.body;

    if (type !== "suggestion" && type !== "complaint") {
      return res.status(400).json({ error: "type must be 'suggestion' or 'complaint'" });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    const { data, error } = await supabaseAdmin
      .from("feedback")
      .insert({
        user_id: req.user.id,
        type,
        message: message.trim(),
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ feedback: data });
  } catch (err) {
    console.error("createFeedback error:", err);
    return res.status(500).json({ error: "Failed to submit feedback" });
  }
}
