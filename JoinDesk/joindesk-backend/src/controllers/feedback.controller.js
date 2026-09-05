import { supabaseAdmin } from "../config/supabase.js";

/**
 * POST /api/feedback
 * Body: { type: "suggestion" | "complaint", message, reported_name?, reported_desk_id? }
 *
 * `reported_name` / `reported_desk_id` replace the old "report this User
 * ID" targeting, which was tried and dropped: people meeting on a Google
 * Meet call have no way to see each other's JoinDesk account/User ID, only
 * a name and which desk they were in. Both are optional and go through no
 * extra validation beyond "is it the right shape" — a complaint still
 * sends fine with neither filled in, this just gives the admin something
 * to go on when they are.
 */
export async function createFeedback(req, res) {
  try {
    const { type, message, reported_name, reported_desk_id } = req.body;

    if (type !== "suggestion" && type !== "complaint") {
      return res.status(400).json({ error: "type must be 'suggestion' or 'complaint'" });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    const insertRow = {
      user_id: req.user.id,
      type,
      message: message.trim(),
      status: "pending",
    };

    if (type === "complaint") {
      if (typeof reported_name === "string" && reported_name.trim()) {
        insertRow.reported_name = reported_name.trim();
      }
      if (typeof reported_desk_id === "string" && reported_desk_id.trim()) {
        insertRow.reported_desk_id = reported_desk_id.trim();
      }
    }

    const { data, error } = await supabaseAdmin
      .from("feedback")
      .insert(insertRow)
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ feedback: data });
  } catch (err) {
    console.error("createFeedback error:", err);
    return res.status(500).json({ error: "Failed to submit feedback" });
  }
}
