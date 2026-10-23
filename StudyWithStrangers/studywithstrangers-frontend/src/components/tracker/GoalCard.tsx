import { Flag, Plus } from "lucide-react";
import type { TrackerGoal } from "@/lib/tracker";
import { goalNudge } from "@/lib/trackerCopy";

/** Done (dark) + today's move (colour) + a tick where today should end. */
export function GoalBar({ before, now, targetEnd }: { before: number; now: number; targetEnd?: number }) {
  return (
    <div className="relative h-2.5 w-full rounded-full bg-muted">
      <div className="absolute inset-y-0 left-0 rounded-full bg-foreground/80" style={{ width: `${before}%` }} />
      <div
        className="absolute inset-y-0 rounded-full bg-brand-gradient transition-all duration-500"
        style={{ left: `${before}%`, width: `${Math.max(0, now - before)}%` }}
      />
      {targetEnd !== undefined && targetEnd > now && targetEnd <= 100 && (
        <span className="absolute -top-1 h-[18px] w-0.5 rounded bg-foreground/35" style={{ left: `${targetEnd}%` }} />
      )}
    </div>
  );
}

export function GoalCard({
  goal,
  onUpdate,
  onNew,
}: {
  goal: TrackerGoal | null;
  onUpdate: () => void;
  onNew: () => void;
}) {
  if (!goal) {
    return (
      <section className="rounded-[28px] border border-dashed border-border bg-card/60 p-6 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <Flag className="h-5 w-5" />
        </span>
        <h2 className="mt-3 text-base font-bold tracking-tight">Give today a purpose</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          A goal turns hours into progress. Name one thing you'll finish and we'll tell you exactly how much to do each day.
        </p>
        <button
          onClick={onNew}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Set a goal
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-[28px] border border-border bg-card p-6 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {goal.overdue ? "Overdue" : `Day ${Math.min(goal.dayNumber, goal.totalDays)} of ${goal.totalDays}`}
          </p>
          <h2 className="mt-1 text-lg font-bold leading-snug tracking-tight">{goal.title}</h2>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-3xl font-bold tabular-nums tracking-tight">{goal.progressNow}%</p>
          <p className="text-[11px] text-muted-foreground">complete</p>
        </div>
      </div>

      <div className="mt-5">
        <GoalBar before={goal.progressBefore} now={goal.progressNow} targetEnd={goal.targetEnd} />
        <div className="mt-2 flex flex-wrap justify-between gap-x-4 text-[11px] text-muted-foreground">
          <span>Started today at {goal.progressBefore}%</span>
          <span>
            Today: <b className="text-foreground">+{goal.target}%</b> → {goal.targetEnd}%
          </span>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-foreground/80">{goalNudge(goal)}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={onUpdate}
          className="rounded-full bg-muted px-4 py-2 text-xs font-semibold transition-colors hover:bg-muted/70"
        >
          Update progress
        </button>
        <button
          onClick={onNew}
          className="rounded-full px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          New goal
        </button>
      </div>
    </section>
  );
}
