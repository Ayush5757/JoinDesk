import { supabaseAdmin } from "../config/supabase.js";
import { addDays, isDateStr, loadTrackerSettings, saveTrackerSettings } from "../services/tracker.js";

const KINDS = ["start", "resume", "end"];

/** GET /api/admin/motivations -> every admin-written line */
export async function listMotivations(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from("study_motivations")
      .select("id, kind, text, author, show_date, created_at");
    if (error) throw error;
    const rows = (data || []).sort((a, b) => {
      // dated ones first (soonest first), then the general pool (newest first)
      if (a.show_date && b.show_date) return a.show_date.localeCompare(b.show_date);
      if (a.show_date) return -1;
      if (b.show_date) return 1;
      return String(b.created_at).localeCompare(String(a.created_at));
    });
    return res.status(200).json({ motivations: rows });
  } catch (err) {
    console.error("admin listMotivations error:", err);
    return res.status(500).json({ error: "Failed to load motivations" });
  }
}

/**
 * POST /api/admin/motivations
 * Body: { kind: "start"|"resume"|"end", lines: string[], startDate?: "YYYY-MM-DD", author?: string }
 *  - with startDate: line 1 is shown to EVERYONE on that day, line 2 the next day, ...
 *    (add 5 lines before a trip and the next 5 days are covered)
 *  - without startDate: the lines join the daily rotation
 */
export async function addMotivations(req, res) {
  try {
    const { kind, startDate } = req.body || {};
    const author = typeof req.body?.author === "string" ? req.body.author.trim().slice(0, 80) : "";
    const lines = (Array.isArray(req.body?.lines) ? req.body.lines : [])
      .map((l) => (typeof l === "string" ? l.trim() : ""))
      .filter(Boolean);

    if (!KINDS.includes(kind)) return res.status(400).json({ error: "Pick start, resume or end." });
    if (!lines.length) return res.status(400).json({ error: "Write at least one line." });
    if (lines.length > 60) return res.status(400).json({ error: "Add at most 60 lines at a time." });
    if (lines.some((l) => l.length > 300)) return res.status(400).json({ error: "Each line can be 300 characters at most." });
    if (startDate && !isDateStr(startDate)) return res.status(400).json({ error: "Pick a valid start date." });

    // Scheduled days are exclusive per kind: a new line for a day replaces the old one.
    if (startDate) {
      const dates = lines.map((_, i) => addDays(startDate, i));
      await supabaseAdmin.from("study_motivations").delete().eq("kind", kind).in("show_date", dates);
    }

    const rows = lines.map((text, i) => ({
      kind,
      text,
      author: author || null,
      show_date: startDate ? addDays(startDate, i) : null,
    }));
    const { data, error } = await supabaseAdmin.from("study_motivations").insert(rows).select();
    if (error) throw error;
    return res.status(201).json({ added: (data || rows).length });
  } catch (err) {
    console.error("admin addMotivations error:", err);
    return res.status(500).json({ error: "Failed to save motivations" });
  }
}

/** DELETE /api/admin/motivations/:id */
export async function deleteMotivation(req, res) {
  try {
    const { error } = await supabaseAdmin.from("study_motivations").delete().eq("id", req.params.id);
    if (error) throw error;
    return res.status(200).json({ deleted: true });
  } catch (err) {
    console.error("admin deleteMotivation error:", err);
    return res.status(500).json({ error: "Failed to delete" });
  }
}

/** GET /api/admin/tracker-settings */
export async function getTrackerSettings(req, res) {
  try {
    return res.status(200).json(await loadTrackerSettings());
  } catch (err) {
    console.error("admin getTrackerSettings error:", err);
    return res.status(500).json({ error: "Failed to load settings" });
  }
}

/** PATCH /api/admin/tracker-settings  Body: { maxGoalDays } */
export async function updateTrackerSettings(req, res) {
  try {
    return res.status(200).json(await saveTrackerSettings({ maxGoalDays: req.body?.maxGoalDays }));
  } catch (err) {
    if (err instanceof Error && /between 1 and 365/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    console.error("admin updateTrackerSettings error:", err);
    return res.status(500).json({ error: "Failed to save settings" });
  }
}
