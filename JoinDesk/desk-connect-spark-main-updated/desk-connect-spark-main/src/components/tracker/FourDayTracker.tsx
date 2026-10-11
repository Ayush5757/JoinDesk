import type { TrackerState } from "@/lib/tracker";
import { dayLabel, fmtDur } from "@/lib/tracker";
import { fourDayNudge } from "@/lib/trackerCopy";

/** Today + the 3 days before it: time studied, % moved, and the total. */
export function FourDayTracker({ state, liveTodaySec }: { state: TrackerState; liveTodaySec: number }) {
  const goal = state.goal;
  const total = state.fourTotalStudySec - (state.fourDays.find((d) => d.isToday)?.studySec ?? 0) + liveTodaySec;

  return (
    <section className="rounded-[28px] border border-border bg-card p-5 shadow-soft sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold tracking-tight">Last 4 days</h2>
        <p className="text-xs text-muted-foreground">
          Total study <b className="text-foreground">{fmtDur(total)}</b>
          {goal ? (
            <>
              {" "}
              · Goal <b className="text-foreground">{goal.progressNow}%</b>
            </>
          ) : null}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {state.fourDays.map((d) => {
          const sec = d.isToday ? liveTodaySec : d.studySec;
          const hit = d.target !== null && d.gain !== null && d.target > 0 && d.gain >= d.target;
          return (
            <div
              key={d.date}
              className={
                "rounded-2xl border p-3.5 " + (d.isToday ? "border-primary/40 bg-primary/5" : "border-border bg-muted/30")
              }
            >
              <p className={"text-[11px] font-semibold " + (d.isToday ? "text-primary" : "text-muted-foreground")}>
                {dayLabel(d.date, state.today)}
              </p>
              <p className="mt-1.5 text-xl font-bold tabular-nums tracking-tight">{sec >= 60 ? fmtDur(sec) : "—"}</p>
              <p className="text-[11px] text-muted-foreground">studied</p>

              {d.inGoal && d.progress !== null ? (
                <div className="mt-3">
                  <div className="h-1.5 w-full rounded-full bg-muted">
                    <div
                      className={"h-full rounded-full " + (hit ? "bg-emerald-500" : "bg-brand-gradient")}
                      style={{ width: `${d.progress}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {d.saved || d.isToday ? (
                      <>
                        <b className={hit ? "text-emerald-600" : "text-foreground"}>+{d.gain ?? 0}%</b>
                        {d.target ? ` of ${d.target}%` : ""} · total {d.progress}%
                      </>
                    ) : (
                      <>{d.studySec > 0 ? "Progress not saved" : `Total ${d.progress}%`}</>
                    )}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-muted-foreground">{d.studySec > 0 ? "No goal set" : "Rest day"}</p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">{fourDayNudge(state)}</p>
    </section>
  );
}
