import { useEffect, useState } from "react";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { fmtDur, shortDate, trackerApi, type Report } from "@/lib/tracker";

const RANGES = [
  { v: 7 as const, label: "Weekly" },
  { v: 15 as const, label: "15 days" },
  { v: 30 as const, label: "Monthly" },
];

/** A line that reads the numbers back to the student. */
function summaryLine(r: Report): string {
  const t = r.totals;
  if (t.studySec === 0) return "A blank page. Today is the best day to write the first line.";
  if (t.consistencyPct >= 80) return "You showed up almost every day. That's rare, and it compounds.";
  if (t.trendPct !== null && t.trendPct > 0) return `You studied ${t.trendPct}% more than the period before. Keep climbing.`;
  if (t.activeDays >= Math.ceil(r.range / 2)) return "Half the days or more. Add one more study day and watch the change.";
  return "Every session counts. Aim for one more study day than last time.";
}

export function ReportPanel() {
  const [range, setRange] = useState<7 | 15 | 30>(7);
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    let alive = true;
    setReport(null);
    trackerApi
      .report(range)
      .then((r) => alive && setReport(r))
      .catch(() => alive && toast.error("Couldn't load the report."));
    return () => {
      alive = false;
    };
  }, [range]);

  return (
    <div>
      <div className="inline-flex rounded-full border border-border bg-muted/50 p-1">
        {RANGES.map((r) => (
          <button
            key={r.v}
            onClick={() => setRange(r.v)}
            className={
              "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors " +
              (range === r.v ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground")
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      {!report ? (
        <p className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Building your report…
        </p>
      ) : (
        <ReportBody report={report} />
      )}
    </div>
  );
}

function ReportBody({ report }: { report: Report }) {
  const t = report.totals;
  const maxSec = Math.max(1, ...report.days.map((d) => d.studySec));
  const up = (t.trendPct ?? 0) >= 0;

  return (
    <div className="mt-4 space-y-4">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {shortDate(report.from)} – {shortDate(report.to)}
        </p>
        <p className="mt-2 text-4xl font-bold tracking-tight">{fmtDur(t.studySec)}</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          studied
          {t.trendPct !== null && (
            <span className={"inline-flex items-center gap-1 font-semibold " + (up ? "text-emerald-600" : "text-amber-600")}>
              {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {Math.abs(t.trendPct)}% vs before
            </span>
          )}
        </p>
        <p className="mt-4 text-sm leading-relaxed text-foreground/80">{summaryLine(report)}</p>

        <div className="mt-6 flex h-28 items-end gap-[3px]">
          {report.days.map((d) => (
            <div key={d.date} className="group relative flex h-full flex-1 items-end" title={`${shortDate(d.date)}: ${fmtDur(d.studySec)}`}>
              <div
                className={"w-full rounded-t-md " + (d.studySec > 0 ? "bg-brand-gradient" : "bg-muted")}
                style={{ height: `${d.studySec > 0 ? Math.max(6, (d.studySec / maxSec) * 100) : 4}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>{shortDate(report.from)}</span>
          <span>{shortDate(report.to)}</span>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Study days" value={`${t.activeDays}/${report.range}`} sub={`${t.consistencyPct}% consistency`} />
        <Stat label="Avg per study day" value={fmtDur(t.avgStudyPerActiveDaySec)} sub="when you showed up" />
        <Stat label="Best day" value={t.bestDay ? fmtDur(t.bestDay.studySec) : "—"} sub={t.bestDay ? shortDate(t.bestDay.date) : "no sessions yet"} />
        <Stat label="Focus" value={`${t.focusPct}%`} sub={`${fmtDur(t.breakSec)} on breaks`} />
        <Stat label="Progress made" value={`+${t.progressGained}%`} sub="across your goals" />
        <Stat label="Goals finished" value={String(t.goalsCompleted)} sub="in this period" />
        <Stat label="Current streak" value={`${report.streak.days}d`} sub={report.streak.todayDone ? "today counted" : "study today to extend"} />
        <Stat label="Before this" value={fmtDur(t.previousStudySec)} sub="previous period" />
      </div>

      {report.goals.length > 0 && (
        <section className="rounded-[28px] border border-border bg-card p-6 shadow-soft">
          <h3 className="text-sm font-bold tracking-tight">Goals this period</h3>
          <ul className="mt-3 space-y-3">
            {report.goals.map((g) => (
              <li key={g.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium">{g.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {g.gain > 0 ? <b className="text-foreground">+{g.gain}%</b> : "no change"} · {g.progress}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
                  <div
                    className={"h-full rounded-full " + (g.status === "completed" ? "bg-emerald-500" : "bg-brand-gradient")}
                    style={{ width: `${g.progress}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {g.status === "completed" ? "Completed" : g.status === "active" ? "In progress" : "Not finished yet"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}
