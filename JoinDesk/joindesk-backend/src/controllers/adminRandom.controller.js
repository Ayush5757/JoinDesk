import { supabaseAdmin } from "../config/supabase.js";

/** GET /api/admin/random-reports?status=open|dismissed|actioned|all */
export async function listRandomReports(req, res) {
  try {
    const status = ["open", "dismissed", "actioned"].includes(req.query.status) ? req.query.status : "open";
    let q = supabaseAdmin
      .from("random_reports")
      .select("id, room_id, reporter, reported, reason, details, status, created_at, resolved_at");
    if (req.query.status !== "all") q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw error;

    const rows = (data || []).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 200);
    const ids = [...new Set(rows.flatMap((r) => [r.reporter, r.reported]))];
    const { data: users } = ids.length
      ? await supabaseAdmin.from("users").select("id, name, email, is_blocked").in("id", ids)
      : { data: [] };
    const byId = new Map((users || []).map((u) => [u.id, u]));

    const { data: open } = await supabaseAdmin.from("random_reports").select("reported, reporter").eq("status", "open");
    const openAgainst = {};
    for (const r of open || []) (openAgainst[r.reported] ||= new Set()).add(r.reporter);

    return res.status(200).json({
      reports: rows.map((r) => ({
        ...r,
        reporterUser: byId.get(r.reporter) || null,
        reportedUser: byId.get(r.reported) || null,
        openReportsAgainst: openAgainst[r.reported]?.size || 0,
      })),
    });
  } catch (err) {
    console.error("admin listRandomReports error:", err);
    return res.status(500).json({ error: "Failed to load reports" });
  }
}

/**
 * POST /api/admin/random-reports/:id/resolve   Body: { status: "dismissed" | "actioned" }
 * Dismissing stops a report from counting toward the automatic pause.
 */
export async function resolveRandomReport(req, res) {
  try {
    const status = req.body?.status;
    if (!["dismissed", "actioned"].includes(status)) return res.status(400).json({ error: "Bad status" });
    const { error } = await supabaseAdmin
      .from("random_reports")
      .update({ status, resolved_at: new Date().toISOString() })
      .eq("id", req.params.id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("admin resolveRandomReport error:", err);
    return res.status(500).json({ error: "Failed to update the report" });
  }
}

/** POST /api/admin/users/:id/random-reports/clear -> dismiss every open report against a person (lifts the automatic pause). */
export async function clearReportsAgainst(req, res) {
  try {
    await supabaseAdmin
      .from("random_reports")
      .update({ status: "dismissed", resolved_at: new Date().toISOString() })
      .eq("reported", req.params.id)
      .eq("status", "open");
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("admin clearReportsAgainst error:", err);
    return res.status(500).json({ error: "Failed to clear reports" });
  }
}
