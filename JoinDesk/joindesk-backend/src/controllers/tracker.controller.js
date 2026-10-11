import { supabaseAdmin } from "../config/supabase.js";
import {
  addDays,
  buildState,
  closeOverlong,
  computeStreak,
  diffDays,
  goalGuidance,
  isDateStr,
  istDate,
  loadActiveGoal,
  loadGoalDays,
  loadSegments,
  loadTrackerSettings,
  pendingDays,
  perDay,
  progressAtEnd,
  progressBefore,
} from "../services/tracker.js";

const fail = (res, code, error, extra = {}) => res.status(code).json({ error, ...extra });
const serverError = (res, label, err) => {
  console.error(`tracker ${label} error:`, err);
  return res.status(500).json({ error: "Something went wrong. Try again." });
};

/** Pending (unsaved) past days of the active goal, or [] when there is none. */
async function pendingFor(userId, goal, now) {
  if (!goal) return [];
  const today = istDate(now);
  const segments = await loadSegments(userId, goal.start_date);
  const mine = segments.filter((s) => s.goal_id === goal.id);
  const rows = await loadGoalDays([goal.id]);
  return pendingDays(goal, rows, perDay(mine, now), today);
}

/**
 * Saves "how far along is the goal at the end of this day".
 * Progress can only move forward: it can't be lower than the previous day
 * and can't be higher than a later day that is already saved.
 */
async function saveDayProgress(userId, goal, day, progress, now) {
  const today = istDate(now);
  if (!isDateStr(day) || day > today || day < goal.start_date) return { error: "That day isn't part of this goal." };
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) return { error: "Progress must be between 0 and 100." };

  const rows = await loadGoalDays([goal.id]);
  const min = progressBefore(rows, day);
  const later = rows.filter((r) => r.day > day).map((r) => r.progress);
  const max = later.length ? Math.min(...later) : 100;
  if (progress < min) return { error: `Progress can't be lower than ${min}% (where the previous day ended).` };
  if (progress > max) return { error: `Progress can't be higher than ${max}% (a later day is already saved).` };

  const { error } = await supabaseAdmin
    .from("study_goal_days")
    .upsert({ goal_id: goal.id, user_id: userId, day, progress, saved_at: new Date(now).toISOString() }, { onConflict: "goal_id,day" });
  if (error) throw error;

  let completed = false;
  if (progress >= 100 && goal.status === "active") {
    await supabaseAdmin
      .from("study_goals")
      .update({ status: "completed", completed_at: new Date(now).toISOString() })
      .eq("id", goal.id);
    completed = true;
  }
  return { ok: true, completed };
}

// ---------------------------------------------------------------
// GET /api/tracker/state
// ---------------------------------------------------------------
export async function getState(req, res) {
  try {
    const now = Date.now();
    const autoClosed = await closeOverlong(req.user.id, now);
    return res.status(200).json(await buildState(req.user.id, now, { autoClosed }));
  } catch (err) {
    return serverError(res, "getState", err);
  }
}

// ---------------------------------------------------------------
// POST /api/tracker/session/start   (also used for "resume" and "let's go")
// ---------------------------------------------------------------
export async function startSession(req, res) {
  try {
    const now = Date.now();
    const userId = req.user.id;
    await closeOverlong(userId, now);

    const goal = await loadActiveGoal(userId);
    const pending = await pendingFor(userId, goal, now);
    if (pending.length) {
      return fail(res, 409, "Set your progress for the earlier day(s) first.", { pending });
    }

    const { data: open } = await supabaseAdmin
      .from("study_segments")
      .select("id, kind")
      .eq("user_id", userId)
      .is("ended_at", null)
      .maybeSingle();

    const iso = new Date(now).toISOString();
    if (open?.kind === "break") {
      await supabaseAdmin.from("study_segments").update({ ended_at: iso }).eq("id", open.id);
    }
    if (!open || open.kind === "break") {
      const { error } = await supabaseAdmin.from("study_segments").insert({
        user_id: userId,
        goal_id: goal ? goal.id : null,
        kind: "study",
        started_at: iso,
      });
      if (error) throw error;
    }
    return res.status(200).json(await buildState(userId, now));
  } catch (err) {
    return serverError(res, "startSession", err);
  }
}

// ---------------------------------------------------------------
// POST /api/tracker/session/pause   (study -> break)
// ---------------------------------------------------------------
export async function pauseSession(req, res) {
  try {
    const now = Date.now();
    const userId = req.user.id;
    await closeOverlong(userId, now);

    const { data: open } = await supabaseAdmin
      .from("study_segments")
      .select("id, kind, goal_id")
      .eq("user_id", userId)
      .is("ended_at", null)
      .maybeSingle();
    if (!open) return fail(res, 400, "You're not studying right now.");

    if (open.kind === "study") {
      const iso = new Date(now).toISOString();
      await supabaseAdmin.from("study_segments").update({ ended_at: iso }).eq("id", open.id);
      const { error } = await supabaseAdmin
        .from("study_segments")
        .insert({ user_id: userId, goal_id: open.goal_id, kind: "break", started_at: iso });
      if (error) throw error;
    }
    return res.status(200).json(await buildState(userId, now));
  } catch (err) {
    return serverError(res, "pauseSession", err);
  }
}

// ---------------------------------------------------------------
// POST /api/tracker/session/end   Body: { progress }  (needed when a goal is active)
// ---------------------------------------------------------------
export async function endSession(req, res) {
  try {
    const now = Date.now();
    const userId = req.user.id;
    await closeOverlong(userId, now);

    const goal = await loadActiveGoal(userId);
    let completed = false;

    if (goal) {
      const progress = Number(req.body?.progress);
      if (req.body?.progress === undefined || req.body?.progress === null || !Number.isFinite(progress)) {
        return fail(res, 400, "Set today's progress to end your session.", { needsProgress: true });
      }
      // validate + save BEFORE closing, so a rejected value loses nothing
      const saved = await saveDayProgress(userId, goal, istDate(now), Math.round(progress), now);
      if (saved.error) return fail(res, 400, saved.error);
      completed = saved.completed;
    }

    const iso = new Date(now).toISOString();
    await supabaseAdmin
      .from("study_segments")
      .update({ ended_at: iso })
      .eq("user_id", userId)
      .is("ended_at", null);

    return res.status(200).json({ ...(await buildState(userId, now)), justEnded: true, goalCompleted: completed });
  } catch (err) {
    return serverError(res, "endSession", err);
  }
}

// ---------------------------------------------------------------
// POST /api/tracker/goals          Body: { title, days }
// ---------------------------------------------------------------
export async function createGoal(req, res) {
  try {
    const now = Date.now();
    const userId = req.user.id;
    const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 120) : "";
    const days = Math.round(Number(req.body?.days));
    const { maxGoalDays } = await loadTrackerSettings();

    if (!title) return fail(res, 400, "Give your goal a name.");
    if (!Number.isFinite(days) || days < 1 || days > maxGoalDays) {
      return fail(res, 400, `Choose between 1 and ${maxGoalDays} days.`);
    }

    const today = istDate(now);
    await supabaseAdmin.from("study_goals").update({ status: "shelved" }).eq("user_id", userId).eq("status", "active");
    const { error } = await supabaseAdmin.from("study_goals").insert({
      user_id: userId,
      title,
      total_days: days,
      start_date: today,
      deadline_date: addDays(today, days - 1),
      status: "active",
    });
    if (error) throw error;

    // a running session now belongs to the new goal
    return res.status(201).json(await buildState(userId, now));
  } catch (err) {
    return serverError(res, "createGoal", err);
  }
}

// ---------------------------------------------------------------
// POST /api/tracker/goals/:id/continue     Body: { days }
// Picks an unfinished goal up again, from where its progress stopped.
// ---------------------------------------------------------------
export async function continueGoal(req, res) {
  try {
    const now = Date.now();
    const userId = req.user.id;
    const days = Math.round(Number(req.body?.days));
    const { maxGoalDays } = await loadTrackerSettings();
    if (!Number.isFinite(days) || days < 1 || days > maxGoalDays) {
      return fail(res, 400, `Choose between 1 and ${maxGoalDays} days.`);
    }

    const { data: goal } = await supabaseAdmin
      .from("study_goals")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!goal) return fail(res, 404, "Goal not found.");
    if (goal.status === "completed") return fail(res, 400, "That goal is already complete.");

    const today = istDate(now);
    await supabaseAdmin.from("study_goals").update({ status: "shelved" }).eq("user_id", userId).eq("status", "active");
    const deadline = addDays(today, days - 1);
    const { error } = await supabaseAdmin
      .from("study_goals")
      .update({ status: "active", deadline_date: deadline, total_days: diffDays(deadline, goal.start_date) + 1 })
      .eq("id", goal.id);
    if (error) throw error;

    return res.status(200).json(await buildState(userId, now));
  } catch (err) {
    return serverError(res, "continueGoal", err);
  }
}

// ---------------------------------------------------------------
// POST /api/tracker/goals/:id/progress     Body: { day, progress }
// Used to set an earlier day that was never saved, or to nudge today's value.
// ---------------------------------------------------------------
export async function saveGoalProgress(req, res) {
  try {
    const now = Date.now();
    const userId = req.user.id;
    const { data: goal } = await supabaseAdmin
      .from("study_goals")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!goal) return fail(res, 404, "Goal not found.");

    const day = typeof req.body?.day === "string" ? req.body.day : istDate(now);
    const saved = await saveDayProgress(userId, goal, day, Math.round(Number(req.body?.progress)), now);
    if (saved.error) return fail(res, 400, saved.error);

    return res.status(200).json({ ...(await buildState(userId, now)), goalCompleted: saved.completed });
  } catch (err) {
    return serverError(res, "saveGoalProgress", err);
  }
}

// ---------------------------------------------------------------
// GET /api/tracker/history  -> every goal with its day-by-day record
// ---------------------------------------------------------------
export async function getHistory(req, res) {
  try {
    const now = Date.now();
    const userId = req.user.id;
    const today = istDate(now);
    await closeOverlong(userId, now);

    const { data: goals, error } = await supabaseAdmin
      .from("study_goals")
      .select("*")
      .eq("user_id", userId);
    if (error) throw error;

    const sorted = (goals || []).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 60);
    const rowsAll = await loadGoalDays(sorted.map((g) => g.id));
    const segments = await loadSegments(userId, addDays(today, -365));

    const out = sorted.map((g) => {
      const rows = rowsAll.filter((r) => r.goal_id === g.id);
      const byDay = perDay(segments.filter((s) => s.goal_id === g.id), now);
      const dates = [...new Set([...Object.keys(byDay), ...rows.map((r) => r.day)])].sort();
      const days = dates.map((date) => ({
        date,
        studySec: byDay[date]?.study || 0,
        breakSec: byDay[date]?.break || 0,
        saved: rows.some((r) => r.day === date),
        progress: progressAtEnd(rows, date),
        gain: Math.max(0, progressAtEnd(rows, date) - progressBefore(rows, date)),
      }));
      const progress = rows.length ? Math.max(...rows.map((r) => r.progress)) : 0;
      return {
        id: g.id,
        title: g.title,
        status: g.status === "completed" ? "completed" : g.status === "active" ? "active" : "incomplete",
        startDate: g.start_date,
        deadlineDate: g.deadline_date,
        totalDays: g.total_days,
        completedAt: g.completed_at,
        progress,
        studySec: days.reduce((n, d) => n + d.studySec, 0),
        activeDays: days.filter((d) => d.studySec > 0).length,
        daysTaken: g.completed_at ? diffDays(istDate(Date.parse(g.completed_at)), g.start_date) + 1 : null,
        days,
      };
    });

    return res.status(200).json({ goals: out, settings: await loadTrackerSettings() });
  } catch (err) {
    return serverError(res, "getHistory", err);
  }
}

// ---------------------------------------------------------------
// GET /api/tracker/report?days=7|15|30
// ---------------------------------------------------------------
export async function getReport(req, res) {
  try {
    const now = Date.now();
    const userId = req.user.id;
    const today = istDate(now);
    const range = [7, 15, 30].includes(Number(req.query.days)) ? Number(req.query.days) : 7;
    await closeOverlong(userId, now);

    const from = addDays(today, -(range - 1));
    const prevFrom = addDays(from, -range);
    const segments = await loadSegments(userId, prevFrom);
    const byDay = perDay(segments, now);

    const { data: goals, error } = await supabaseAdmin.from("study_goals").select("*").eq("user_id", userId);
    if (error) throw error;
    const rowsAll = await loadGoalDays((goals || []).map((g) => g.id));

    // progress gained per day, across all goals
    const gainByDay = {};
    const gainByGoal = {};
    for (const g of goals || []) {
      const rows = rowsAll.filter((r) => r.goal_id === g.id);
      for (const r of rows) {
        const gain = Math.max(0, r.progress - progressBefore(rows, r.day));
        gainByDay[r.day] = (gainByDay[r.day] || 0) + gain;
        if (r.day >= from && r.day <= today) gainByGoal[g.id] = (gainByGoal[g.id] || 0) + gain;
      }
    }

    const days = [];
    for (let i = 0; i < range; i += 1) {
      const date = addDays(from, i);
      days.push({
        date,
        studySec: byDay[date]?.study || 0,
        breakSec: byDay[date]?.break || 0,
        gain: gainByDay[date] || 0,
      });
    }
    const sum = (arr, k) => arr.reduce((n, d) => n + d[k], 0);
    const studySec = sum(days, "studySec");
    const breakSec = sum(days, "breakSec");
    let prevStudy = 0;
    for (let i = 1; i <= range; i += 1) prevStudy += byDay[addDays(from, -i)]?.study || 0;
    const activeDays = days.filter((d) => d.studySec > 0).length;
    const best = days.reduce((b, d) => (d.studySec > (b?.studySec || 0) ? d : b), null);

    const touched = (goals || [])
      .filter((g) => gainByGoal[g.id] || g.status === "active")
      .map((g) => {
        const rows = rowsAll.filter((r) => r.goal_id === g.id);
        return {
          id: g.id,
          title: g.title,
          status: g.status === "completed" ? "completed" : g.status === "active" ? "active" : "incomplete",
          progress: rows.length ? Math.max(...rows.map((r) => r.progress)) : 0,
          gain: gainByGoal[g.id] || 0,
        };
      });

    return res.status(200).json({
      range,
      from,
      to: today,
      days,
      totals: {
        studySec,
        breakSec,
        activeDays,
        avgStudyPerActiveDaySec: activeDays ? Math.round(studySec / activeDays) : 0,
        consistencyPct: Math.round((activeDays / range) * 100),
        focusPct: studySec + breakSec ? Math.round((studySec / (studySec + breakSec)) * 100) : 0,
        bestDay: best && best.studySec > 0 ? { date: best.date, studySec: best.studySec } : null,
        previousStudySec: prevStudy,
        trendPct: prevStudy > 0 ? Math.round(((studySec - prevStudy) / prevStudy) * 100) : null,
        goalsCompleted: (goals || []).filter(
          (g) => g.completed_at && istDate(Date.parse(g.completed_at)) >= from && istDate(Date.parse(g.completed_at)) <= today,
        ).length,
        progressGained: sum(days, "gain"),
      },
      streak: computeStreak(byDay, today),
      goals: touched,
    });
  } catch (err) {
    return serverError(res, "getReport", err);
  }
}
