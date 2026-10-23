import type { TrackerGoal, TrackerState } from "@/lib/tracker";
import { fmtDur } from "@/lib/tracker";

/**
 * Small, calm lines that sit next to the numbers. Each one leans on a real
 * motivation trigger (momentum, identity, loss of a streak, small wins,
 * future-self) so the screen keeps nudging without shouting.
 */

/** The line right under the goal title. */
export function goalNudge(g: TrackerGoal): string {
  if (g.remaining === 0) return "Goal complete. That's the kind of person you are.";
  if (g.overdue) {
    return `Overdue, not over. ${g.remaining}% left. Finish it today.`;
  }
  const left = Math.max(0, g.target - g.gainToday);
  if (g.gainToday >= g.target && g.target > 0) {
    return `Today's target done. Anything more is a bonus for tomorrow-you.`;
  }
  if (g.gainToday > 0) return `${left}% more reaches today's target. You're already moving.`;
  if (g.dayNumber === 1) return `Day 1 sets the tone. Just ${g.target}% today.`;
  if (g.daysLeft === 1) return `Last day. ${g.target}% to finish what you started.`;
  return `${g.target}% today keeps you on track. ${g.daysLeft} days left.`;
}

/** One line about today's effort vs the recent past. */
export function effortNudge(s: TrackerState): string | null {
  const today = s.fourDays.find((d) => d.isToday);
  const yesterday = s.fourDays.at(-2);
  if (!today) return null;
  if (today.studySec < 60) {
    if (s.streak.days >= 2 && !s.streak.todayDone) {
      return `${s.streak.days}-day streak is on the line. Even 10 minutes keeps it alive.`;
    }
    return null;
  }
  if (yesterday && yesterday.studySec > 0) {
    const diff = today.studySec - yesterday.studySec;
    if (diff > 0) return `${fmtDur(diff)} ahead of yesterday. Keep stacking.`;
    return `${fmtDur(Math.abs(diff))} to match yesterday. You can beat it.`;
  }
  return "That's a real session. Every minute here counts.";
}

/** Strip under the 4-day tracker. */
export function fourDayNudge(s: TrackerState): string {
  if (s.fourTotalStudySec === 0) return "Nothing yet. The first session is always the hardest. Start it.";
  const active = s.fourDays.filter((d) => d.studySec > 0).length;
  if (active === 4) return "Four days in a row. This is what consistency looks like.";
  if (active >= 2) return `${active} of the last 4 days. One more makes it a habit.`;
  return "Show up again tomorrow. Two days in a row is where it starts.";
}

/** Shown on the "pick up where you left off" sheet. */
export function pendingCopy(studyText: string): string {
  return `You studied ${studyText} that day. How far along was your goal when you stopped? Be honest, it only helps you.`;
}

/** The big summary after "End today's session". */
export function endSummary(s: TrackerState): { title: string; line: string } {
  const g = s.goal;
  const study = fmtDur(s.session.todayStudySec);
  if (s.goalCompleted) {
    return { title: "Goal complete", line: `You finished it after ${study} today. Take a proud breath.` };
  }
  if (g && g.gainToday >= g.target && g.target > 0) {
    return { title: "Target hit", line: `${study} studied and ${g.gainToday}% done. Exactly what today asked for.` };
  }
  if (g) {
    return {
      title: "Day saved",
      line: `${study} studied, ${g.gainToday}% moved. Tomorrow starts from ${g.progressNow}%.`,
    };
  }
  return { title: "Day saved", line: `${study} of focus today. That's real progress.` };
}

/** Header greeting that changes through the day. */
export function greeting(hour: number): string {
  if (hour < 5) return "Burning the midnight oil";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Late session";
}
