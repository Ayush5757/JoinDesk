import { api } from "@/lib/api";

// =========================
// Types (mirror the backend /api/tracker responses)
// =========================

export type Motivation = { text: string; author: string | null; source: "admin" | "default" };

export type TrackerGoal = {
  id: string;
  title: string;
  totalDays: number;
  startDate: string;
  deadlineDate: string;
  progressBefore: number; // % when today started
  progressNow: number; // % saved for today so far (or progressBefore)
  gainToday: number;
  target: number; // +% to do today
  targetEnd: number; // % to reach by end of today
  daysLeft: number;
  overdue: boolean;
  dayNumber: number;
  remaining: number;
};

export type PendingDay = { date: string; studySec: number; minProgress: number };

export type FourDay = {
  date: string;
  studySec: number;
  breakSec: number;
  isToday: boolean;
  inGoal: boolean;
  saved: boolean;
  progress: number | null;
  gain: number | null;
  target: number | null;
};

export type SessionStatus = "idle" | "studying" | "break";

export type TrackerState = {
  today: string;
  serverNow: string;
  settings: { maxGoalDays: number };
  autoClosed: boolean; // a never-stopped session was closed automatically
  session: {
    status: SessionStatus;
    since: string | null;
    startedToday: boolean;
    resumesToday: number;
    todayStudySec: number;
    todayBreakSec: number;
  };
  goal: TrackerGoal | null;
  pending: PendingDay[];
  fourDays: FourDay[];
  fourTotalStudySec: number;
  streak: { days: number; todayDone: boolean };
  motivations: { start: Motivation; resume: Motivation; end: Motivation };
  // only present on the response to "end session"
  justEnded?: boolean;
  goalCompleted?: boolean;
};

export type HistoryDay = {
  date: string;
  studySec: number;
  breakSec: number;
  saved: boolean;
  progress: number;
  gain: number;
};

export type HistoryGoal = {
  id: string;
  title: string;
  status: "active" | "completed" | "incomplete";
  startDate: string;
  deadlineDate: string;
  totalDays: number;
  completedAt: string | null;
  progress: number;
  studySec: number;
  activeDays: number;
  daysTaken: number | null;
  days: HistoryDay[];
};

export type Report = {
  range: number;
  from: string;
  to: string;
  days: { date: string; studySec: number; breakSec: number; gain: number }[];
  totals: {
    studySec: number;
    breakSec: number;
    activeDays: number;
    avgStudyPerActiveDaySec: number;
    consistencyPct: number;
    focusPct: number;
    bestDay: { date: string; studySec: number } | null;
    previousStudySec: number;
    trendPct: number | null;
    goalsCompleted: number;
    progressGained: number;
  };
  streak: { days: number; todayDone: boolean };
  goals: { id: string; title: string; status: "active" | "completed" | "incomplete"; progress: number; gain: number }[];
};

// =========================
// Calls
// =========================
export const trackerApi = {
  state: () => api.get<TrackerState>("/api/tracker/state"),
  // "Let's go" and "Resume" are the same call; the page decides which quote to show.
  start: () => api.post<TrackerState>("/api/tracker/session/start"),
  pause: () => api.post<TrackerState>("/api/tracker/session/pause"),
  end: (progress?: number) =>
    api.post<TrackerState>("/api/tracker/session/end", progress === undefined ? {} : { progress }),
  createGoal: (title: string, days: number) => api.post<TrackerState>("/api/tracker/goals", { title, days }),
  continueGoal: (id: string, days: number) =>
    api.post<TrackerState>(`/api/tracker/goals/${id}/continue`, { days }),
  saveProgress: (goalId: string, day: string, progress: number) =>
    api.post<TrackerState>(`/api/tracker/goals/${goalId}/progress`, { day, progress }),
  history: () => api.get<{ goals: HistoryGoal[]; settings: { maxGoalDays: number } }>("/api/tracker/history"),
  report: (days: 7 | 15 | 30) => api.get<Report>(`/api/tracker/report?days=${days}`),
};

// =========================
// Formatting
// =========================

/** 4980 -> "1h 23m". Minutes only, on purpose: seconds are a distraction. */
export function fmtDur(sec: number): string {
  const m = Math.floor(Math.max(0, sec) / 60);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h > 0) return r === 0 ? `${h}h` : `${h}h ${r}m`;
  return `${m}m`;
}

const DAY_MS = 86_400_000;
const dayNo = (d: string) => Math.round(Date.parse(`${d}T00:00:00Z`) / DAY_MS);

/** "Today" / "Yesterday" / "Tue 7 Oct" */
export function dayLabel(date: string, today: string): string {
  const diff = dayNo(today) - dayNo(date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function shortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
