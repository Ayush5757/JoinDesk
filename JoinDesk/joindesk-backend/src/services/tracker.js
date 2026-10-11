import { supabaseAdmin } from "../config/supabase.js";
import { getBillingConfig } from "../config/billing.js";
import { BUILT_IN } from "./motivationBank.js";

const DAY_MS = 24 * 60 * 60 * 1000;
// Time is measured ONLY from button clicks (Let's go / Stop / Resume / End):
// study time = the gap between those timestamps. There are no pings.
// Safety net for someone who closes the tab without pressing Stop/End: a
// running stretch is never counted past the end of the day it started on,
// and never longer than this.
export const MAX_RUN_MS = 6 * 60 * 60 * 1000;
const SETTINGS_KEY = "tracker_settings";
const DEFAULT_MAX_GOAL_DAYS = 4;
const STREAK_MIN_SEC = 10 * 60; // 10 minutes of study keeps a streak alive

// =========================
// Date helpers (India time by default, same as analytics)
// =========================
const offsetMin = () => getBillingConfig().tzOffsetMinutes;

/** "YYYY-MM-DD" of an instant in the app's timezone. */
export const istDate = (ms) => new Date(ms + offsetMin() * 60000).toISOString().slice(0, 10);

/** ms of 00:00 of a "YYYY-MM-DD" day in the app's timezone. */
export const dayStartMs = (date) => Date.parse(`${date}T00:00:00Z`) - offsetMin() * 60000;

export const addDays = (date, n) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const diffDays = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY_MS);

export const isDateStr = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "") && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

// =========================
// Time maths (pure)
// =========================

/** Seconds of [startMs, endMs) that fall on each day -> { "2026-10-07": 1800, ... } */
export function splitByDay(startMs, endMs) {
  const out = {};
  if (!(endMs > startMs)) return out;
  let cursor = startMs;
  while (cursor < endMs) {
    const date = istDate(cursor);
    const nextMidnight = dayStartMs(addDays(date, 1));
    const stop = Math.min(endMs, nextMidnight);
    out[date] = (out[date] || 0) + (stop - cursor) / 1000;
    cursor = stop;
  }
  return out;
}

/** segments -> { date: { study, break } } in whole seconds. Running segments count up to `now`. */
export function perDay(segments, now = Date.now()) {
  const map = {};
  for (const s of segments) {
    const start = Date.parse(s.started_at);
    const end = s.ended_at ? Date.parse(s.ended_at) : now;
    const parts = splitByDay(start, end);
    for (const [date, sec] of Object.entries(parts)) {
      if (!map[date]) map[date] = { study: 0, break: 0 };
      map[date][s.kind === "break" ? "break" : "study"] += sec;
    }
  }
  for (const v of Object.values(map)) {
    v.study = Math.round(v.study);
    v.break = Math.round(v.break);
  }
  return map;
}

/** Consecutive days (ending today, or yesterday if today isn't done yet) with >= 10 min of study. */
export function computeStreak(byDay, today) {
  const ok = (d) => (byDay[d]?.study || 0) >= STREAK_MIN_SEC;
  let day = ok(today) ? today : addDays(today, -1);
  let n = 0;
  while (ok(day)) {
    n += 1;
    day = addDays(day, -1);
  }
  return { days: n, todayDone: ok(today) };
}

/** Cumulative progress at the end of `date` (rows with day <= date), 0 if none. */
export function progressAtEnd(rows, date) {
  let best = null;
  for (const r of rows) if (r.day <= date && (!best || r.day > best.day)) best = r;
  return best ? best.progress : 0;
}

/** Cumulative progress BEFORE `date` started (rows with day < date). */
export const progressBefore = (rows, date) => progressAtEnd(rows, addDays(date, -1));

/**
 * What should today look like for this goal?
 *   remaining = 100 - progress before today
 *   daysLeft  = days from today to the deadline (today included, minimum 1)
 *   target    = remaining / daysLeft, rounded up
 * Because it is recomputed from what was REALLY achieved, a slow day
 * automatically spreads the missing % over the remaining days.
 */
export function goalGuidance(goal, rows, today) {
  const before = progressBefore(rows, today);
  const todayRow = rows.find((r) => r.day === today);
  const progressNow = todayRow ? todayRow.progress : before;
  const overdue = today > goal.deadline_date;
  const daysLeft = overdue ? 1 : diffDays(goal.deadline_date, today) + 1;
  const remaining = Math.max(0, 100 - before);
  const target = remaining === 0 ? 0 : Math.min(remaining, Math.ceil(remaining / Math.max(1, daysLeft)));
  return {
    progressBefore: before,
    progressNow,
    gainToday: Math.max(0, progressNow - before),
    target,
    targetEnd: Math.min(100, before + target),
    daysLeft,
    overdue,
    dayNumber: diffDays(today, goal.start_date) + 1,
    totalDays: goal.total_days,
    remaining: Math.max(0, 100 - progressNow),
  };
}

/** Past days with studying but no saved progress yet (oldest first). */
export function pendingDays(goal, rows, byDay, today) {
  const out = [];
  let d = goal.start_date;
  while (d < today && out.length < 14) {
    if ((byDay[d]?.study || 0) > 0 && !rows.some((r) => r.day === d)) {
      out.push({ date: d, studySec: byDay[d].study, minProgress: progressBefore(rows, d) });
    }
    d = addDays(d, 1);
  }
  return out;
}

// =========================
// Motivation (same line for everybody on the same day)
// =========================
const KIND_OFFSET = { start: 0, resume: 7, end: 13 };

/**
 * adminRows: [{ kind, text, author, show_date, created_at }]
 * 1) a line the admin scheduled for exactly this date wins (first visit of the day)
 * 2) else the daily rotation over [admin general lines..., built-in lines...]
 * `n` is how many times they already used this kind today, so a second
 * "resume" in the same day gets a fresh line instead of repeating.
 */
export function pickMotivation(kind, date, adminRows = [], n = 0) {
  const mine = adminRows
    .filter((r) => r.kind === kind)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

  if (n === 0) {
    const scheduled = mine.find((r) => r.show_date === date);
    if (scheduled) return { text: scheduled.text, author: scheduled.author || null, source: "admin" };
  }

  const pool = [
    ...mine.filter((r) => !r.show_date).map((r) => ({ text: r.text, author: r.author || null, source: "admin" })),
    ...BUILT_IN[kind].map((text) => ({ text, author: null, source: "default" })),
  ];
  const dayNo = Math.floor(dayStartMs(date) / DAY_MS);
  return pool[(dayNo + KIND_OFFSET[kind] + n) % pool.length];
}

// =========================
// Database helpers
// =========================
export async function loadTrackerSettings() {
  const { data } = await supabaseAdmin.from("site_settings").select("value").eq("key", SETTINGS_KEY).maybeSingle();
  let obj = {};
  try {
    obj = data?.value ? JSON.parse(data.value) : {};
  } catch {
    obj = {};
  }
  const n = Math.round(Number(obj.maxGoalDays));
  return { maxGoalDays: Number.isFinite(n) && n >= 1 && n <= 365 ? n : DEFAULT_MAX_GOAL_DAYS };
}

export async function saveTrackerSettings({ maxGoalDays }) {
  const n = Math.round(Number(maxGoalDays));
  if (!Number.isFinite(n) || n < 1 || n > 365) throw new Error("Max goal days must be between 1 and 365");
  const { error } = await supabaseAdmin.from("site_settings").upsert({
    key: SETTINGS_KEY,
    value: JSON.stringify({ maxGoalDays: n }),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return { maxGoalDays: n };
}

export async function loadMotivations() {
  const { data, error } = await supabaseAdmin
    .from("study_motivations")
    .select("id, kind, text, author, show_date, created_at");
  if (error) throw error;
  return data || [];
}

/**
 * Closes a stretch that was never stopped (tab closed, forgot to press End).
 * It ends at the earlier of: end of its own day, or MAX_RUN_MS after it began.
 * Returns true if something was closed.
 */
export async function closeOverlong(userId, now = Date.now()) {
  const { data: open } = await supabaseAdmin
    .from("study_segments")
    .select("id, started_at")
    .eq("user_id", userId)
    .is("ended_at", null);
  let closed = false;
  for (const s of open || []) {
    const start = Date.parse(s.started_at);
    const endOfDay = dayStartMs(addDays(istDate(start), 1));
    const limit = Math.min(endOfDay, start + MAX_RUN_MS);
    if (now >= limit) {
      await supabaseAdmin.from("study_segments").update({ ended_at: new Date(limit).toISOString() }).eq("id", s.id);
      closed = true;
    }
  }
  return closed;
}

export async function loadSegments(userId, sinceDate) {
  const { data, error } = await supabaseAdmin
    .from("study_segments")
    .select("id, goal_id, kind, started_at, ended_at")
    .eq("user_id", userId)
    .gte("started_at", new Date(dayStartMs(sinceDate)).toISOString());
  if (error) throw error;
  return data || [];
}

export async function loadActiveGoal(userId) {
  const { data, error } = await supabaseAdmin
    .from("study_goals")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function loadGoalDays(goalIds) {
  if (!goalIds.length) return [];
  const { data, error } = await supabaseAdmin
    .from("study_goal_days")
    .select("goal_id, day, progress, saved_at")
    .in("goal_id", goalIds);
  if (error) throw error;
  return data || [];
}

const FOUR_DAYS = 4;

/** Everything the tracker page needs in one go. */
export async function buildState(userId, now = Date.now(), { autoClosed = false } = {}) {
  const today = istDate(now);
  const [settings, adminMot, goal] = await Promise.all([loadTrackerSettings(), loadMotivations(), loadActiveGoal(userId)]);
  const segments = await loadSegments(userId, addDays(today, -45));
  const byDay = perDay(segments, now);

  const open = segments.find((s) => !s.ended_at) || null;
  const todayStudySegs = segments
    .filter((s) => s.kind === "study" && istDate(Date.parse(s.started_at)) === today)
    .sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at));
  const startedToday = segments.some((s) => istDate(Date.parse(s.started_at)) === today);
  const resumesToday = Math.max(0, todayStudySegs.length - 1);

  const rows = goal ? (await loadGoalDays([goal.id])).filter((r) => r.goal_id === goal.id) : [];
  const guidance = goal ? goalGuidance(goal, rows, today) : null;
  const goalByDay = goal ? perDay(segments.filter((s) => s.goal_id === goal.id), now) : {};
  const pending = goal ? pendingDays(goal, rows, goalByDay, today) : [];

  // current day + previous 3
  const fourDays = [];
  for (let i = FOUR_DAYS - 1; i >= 0; i -= 1) {
    const date = addDays(today, -i);
    const entry = {
      date,
      studySec: byDay[date]?.study || 0,
      breakSec: byDay[date]?.break || 0,
      isToday: i === 0,
      inGoal: false,
      saved: false,
      progress: null,
      gain: null,
      target: null,
    };
    if (goal && date >= goal.start_date) {
      const before = progressBefore(rows, date);
      const row = rows.find((r) => r.day === date);
      const end = row ? row.progress : date === today ? before : before;
      const daysLeft = date > goal.deadline_date ? 1 : diffDays(goal.deadline_date, date) + 1;
      const remaining = 100 - before;
      entry.inGoal = true;
      entry.saved = Boolean(row);
      entry.progress = end;
      entry.gain = row ? Math.max(0, row.progress - before) : 0;
      entry.target = remaining <= 0 ? 0 : Math.min(remaining, Math.ceil(remaining / Math.max(1, daysLeft)));
    }
    fourDays.push(entry);
  }
  const fourTotalStudy = fourDays.reduce((n, d) => n + d.studySec, 0);

  return {
    today,
    serverNow: new Date(now).toISOString(),
    settings,
    autoClosed,
    session: {
      status: open ? (open.kind === "break" ? "break" : "studying") : "idle",
      since: open ? open.started_at : null,
      startedToday,
      resumesToday,
      todayStudySec: byDay[today]?.study || 0,
      todayBreakSec: byDay[today]?.break || 0,
    },
    goal: goal
      ? {
          id: goal.id,
          title: goal.title,
          totalDays: goal.total_days,
          startDate: goal.start_date,
          deadlineDate: goal.deadline_date,
          ...guidance,
        }
      : null,
    pending,
    fourDays,
    fourTotalStudySec: fourTotalStudy,
    streak: computeStreak(byDay, today),
    motivations: {
      start: pickMotivation("start", today, adminMot, 0),
      resume: pickMotivation("resume", today, adminMot, resumesToday),
      end: pickMotivation("end", today, adminMot, 0),
    },
  };
}
