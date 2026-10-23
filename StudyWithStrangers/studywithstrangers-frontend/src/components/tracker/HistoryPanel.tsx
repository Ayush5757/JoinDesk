import { useEffect, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fmtDur, shortDate, trackerApi, type HistoryGoal } from "@/lib/tracker";

type Filter = "all" | "incomplete" | "completed";

/**
 * Every goal ever set: how long it took, how much was studied each day,
 * and the unfinished ones with a button to pick them back up.
 */
export function HistoryPanel({
  reloadKey,
  onContinue,
}: {
  reloadKey: number;
  onContinue: (goal: HistoryGoal) => void;
}) {
  const [goals, setGoals] = useState<HistoryGoal[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    trackerApi
      .history()
      .then((r) => alive && setGoals(r.goals))
      .catch(() => alive && toast.error("Couldn't load your history."));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  if (!goals) {
    return (
      <p className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your history…
      </p>
    );
  }

  const shown = goals.filter((g) =>
    filter === "all" ? true : filter === "completed" ? g.status === "completed" : g.status !== "completed",
  );
  const incompleteCount = goals.filter((g) => g.status === "incomplete").length;

  return (
    <div>
      <div className="inline-flex rounded-full border border-border bg-muted/50 p-1">
        {(["all", "incomplete", "completed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              "rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition-colors " +
              (filter === f ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground")
            }
          >
            {f}
          </button>
        ))}
      </div>

      {incompleteCount > 0 && filter === "all" && (
        <p className="mt-3 text-xs text-muted-foreground">
          {incompleteCount} unfinished goal{incompleteCount === 1 ? "" : "s"}. Pick one up and finish what you started.
        </p>
      )}

      {shown.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          {goals.length === 0 ? "Your goals will appear here. Set your first one today." : "Nothing here."}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((g) => {
            const isOpen = open === g.id;
            return (
              <li key={g.id} className="rounded-[24px] border border-border bg-card p-5 shadow-soft">
                <button onClick={() => setOpen(isOpen ? null : g.id)} className="flex w-full items-start gap-3 text-left">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold leading-snug">{g.title}</h3>
                      <StatusBadge goal={g} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {shortDate(g.startDate)}
                      {g.completedAt ? "" : ` → ${shortDate(g.deadlineDate)}`} · {fmtDur(g.studySec)} studied ·{" "}
                      {g.activeDays} study day{g.activeDays === 1 ? "" : "s"}
                      {g.daysTaken ? ` · finished in ${g.daysTaken} day${g.daysTaken === 1 ? "" : "s"}` : ""}
                    </p>
                    <div className="mt-3 h-1.5 w-full rounded-full bg-muted">
                      <div
                        className={"h-full rounded-full " + (g.status === "completed" ? "bg-emerald-500" : "bg-brand-gradient")}
                        style={{ width: `${g.progress}%` }}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xl font-bold tabular-nums">{g.progress}%</p>
                    <ChevronDown
                      className={"ml-auto mt-1 h-4 w-4 text-muted-foreground transition-transform " + (isOpen ? "rotate-180" : "")}
                    />
                  </div>
                </button>

                {isOpen && (
                  <div className="mt-4 border-t border-border pt-3">
                    {g.days.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No study recorded for this goal yet.</p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-muted-foreground">
                            <th className="pb-2 font-semibold">Day</th>
                            <th className="pb-2 font-semibold">Studied</th>
                            <th className="pb-2 font-semibold">Moved</th>
                            <th className="pb-2 text-right font-semibold">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.days.map((d) => (
                            <tr key={d.date} className="border-t border-border/60">
                              <td className="py-2">{shortDate(d.date)}</td>
                              <td className="py-2 tabular-nums">{d.studySec >= 60 ? fmtDur(d.studySec) : "—"}</td>
                              <td className="py-2 tabular-nums">
                                {d.saved ? `+${d.gain}%` : <span className="text-muted-foreground">not saved</span>}
                              </td>
                              <td className="py-2 text-right font-semibold tabular-nums">{d.progress}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {g.status === "incomplete" && (
                      <button
                        onClick={() => onContinue(g)}
                        className="mt-4 rounded-full bg-foreground px-5 py-2.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
                      >
                        Continue from {g.progress}%
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ goal }: { goal: HistoryGoal }) {
  if (goal.status === "completed") {
    return <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">Completed</span>;
  }
  if (goal.status === "active") {
    return <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">In progress</span>;
  }
  return <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600">Not finished</span>;
}
