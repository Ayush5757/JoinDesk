import { supabaseAdmin } from "../config/supabase.js";
import { getBillingConfig } from "../config/billing.js";
import { loadPaymentSettings, savePaymentSettings } from "../services/access.js";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-10-05" -> ms of 00:00 that day in the analytics timezone (IST by default). */
function dayStartMs(dateStr, offsetMin) {
  const m = DATE_RE.exec(dateStr || "");
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  // reject things like 2026-02-31
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return Date.UTC(y, mo - 1, d) - offsetMin * 60000;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * POST /api/admin/users/:id/subscriptions
 * Body: { startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD", amountInr?, note? }
 * Access runs from the START of startDate until the END of endDate (both
 * days included), in India time. A start date in the future is fine: the
 * person simply gets access when that day arrives.
 */
export async function createManualSub(req, res) {
  try {
    const offset = getBillingConfig().tzOffsetMinutes;
    const startMs = dayStartMs(req.body?.startDate, offset);
    const endDayMs = dayStartMs(req.body?.endDate, offset);
    if (startMs === null || endDayMs === null) {
      return res.status(400).json({ error: "Pick a valid start date and end date" });
    }
    if (endDayMs < startMs) {
      return res.status(400).json({ error: "End date can't be before the start date" });
    }
    const endsMs = endDayMs + DAY_MS; // end date is included
    if ((endsMs - startMs) / DAY_MS > 3660) {
      return res.status(400).json({ error: "That's too long. Max 10 years." });
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", req.params.id)
      .maybeSingle();
    if (!user) return res.status(404).json({ error: "User not found" });

    const amount = req.body?.amountInr === "" || req.body?.amountInr == null ? null : Number(req.body.amountInr);
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 200) : "";

    const { data, error } = await supabaseAdmin
      .from("manual_subscriptions")
      .insert({
        user_id: req.params.id,
        starts_at: new Date(startMs).toISOString(),
        ends_at: new Date(endsMs).toISOString(),
        amount_inr: Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : null,
        note: note || null,
      })
      .select()
      .single();
    if (error) throw error;

    return res.status(201).json({ subscription: data });
  } catch (err) {
    console.error("admin createManualSub error:", err);
    return res.status(500).json({ error: "Failed to save the subscription" });
  }
}

/** DELETE /api/admin/subscriptions/:id  -> removes a wrongly added subscription. */
export async function deleteManualSub(req, res) {
  try {
    const { error } = await supabaseAdmin.from("manual_subscriptions").delete().eq("id", req.params.id);
    if (error) throw error;
    return res.status(200).json({ deleted: true });
  } catch (err) {
    console.error("admin deleteManualSub error:", err);
    return res.status(500).json({ error: "Failed to remove the subscription" });
  }
}

/** GET /api/admin/payment-settings */
export async function getPaymentSettings(req, res) {
  try {
    return res.status(200).json(await loadPaymentSettings());
  } catch (err) {
    console.error("admin getPaymentSettings error:", err);
    return res.status(500).json({ error: "Failed to load payment settings" });
  }
}

/** PATCH /api/admin/payment-settings  Body: { enabled, amountInr, message } */
export async function updatePaymentSettings(req, res) {
  try {
    const saved = await savePaymentSettings({
      enabled: req.body?.enabled,
      amountInr: req.body?.amountInr,
      message: req.body?.message,
    });
    return res.status(200).json(saved);
  } catch (err) {
    console.error("admin updatePaymentSettings error:", err);
    return res.status(500).json({ error: "Failed to save payment settings" });
  }
}
