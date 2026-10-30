import { supabaseAdmin } from "../config/supabase.js";

/**
 * "Most popular study times" shown to people who are about to join a SPECIAL desk.
 *
 * Stored as one JSON text value in site_settings (key: special_timings):
 *   { all:    [ { start: "06:00", end: "09:00" }, ... ],          // shown on every special desk
 *     byDesk: { "<desk id>": [ { start, end }, ... ] } }          // optional: replaces `all` for that one desk
 *
 * Times are 24-hour "HH:MM" in India time (IST); the website converts them to each visitor's own local time.
 */
const KEY = "special_timings";
const MAX_PER_LIST = 12;
const MAX_DESKS = 100;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ID_RE = /^[0-9a-fA-F-]{36}$/;

const EMPTY = { all: [], byDesk: {} };

/** Returns a clean list, or null if any entry is invalid (so the admin gets a clear error instead of silent loss). */
function cleanList(list) {
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list) || list.length > MAX_PER_LIST) return null;
  const seen = new Set();
  const out = [];
  for (const r of list) {
    const start = typeof r?.start === "string" ? r.start.trim() : "";
    const end = typeof r?.end === "string" ? r.end.trim() : "";
    if (!TIME_RE.test(start) || !TIME_RE.test(end) || start === end) return null;
    const k = `${start}-${end}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push({ start, end });
    }
  }
  return out;
}

export function cleanTimings(input) {
  const all = cleanList(input?.all);
  if (all === null) return null;

  const byDesk = {};
  const entries = Object.entries(input?.byDesk && typeof input.byDesk === "object" ? input.byDesk : {});
  if (entries.length > MAX_DESKS) return null;
  for (const [id, list] of entries) {
    if (!ID_RE.test(id)) return null;
    const clean = cleanList(list);
    if (clean === null) return null;
    if (clean.length) byDesk[id] = clean; // an empty list means "use the common timings", so don't store it
  }
  return { all, byDesk };
}

export async function getTimings() {
  const { data, error } = await supabaseAdmin.from("site_settings").select("value").eq("key", KEY).maybeSingle();
  if (error) throw error;
  if (!data?.value) return EMPTY;
  try {
    return cleanTimings(JSON.parse(data.value)) || EMPTY;
  } catch {
    return EMPTY;
  }
}

export async function saveTimings(input) {
  const clean = cleanTimings(input);
  if (!clean) return null;
  const { error } = await supabaseAdmin.from("site_settings").upsert({
    key: KEY,
    value: JSON.stringify(clean),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return clean;
}
