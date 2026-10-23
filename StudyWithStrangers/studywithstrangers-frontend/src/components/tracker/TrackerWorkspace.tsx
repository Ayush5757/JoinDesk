import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { StudyHero } from "@/components/tracker/StudyHero";
import { GoalCard } from "@/components/tracker/GoalCard";
import { FourDayTracker } from "@/components/tracker/FourDayTracker";
import { HistoryPanel } from "@/components/tracker/HistoryPanel";
import { ReportPanel } from "@/components/tracker/ReportPanel";
import { ProgressSheet } from "@/components/tracker/ProgressSheet";
import { GoalFormSheet } from "@/components/tracker/GoalFormSheet";
import { MomentOverlay } from "@/components/tracker/MomentOverlay";
import { ModeChooser } from "@/components/tracker/ModeChooser";
import { ApiError } from "@/lib/api";
import {
  dayLabel,
  fmtDur,
  trackerApi,
  type HistoryGoal,
  type Motivation,
  type TrackerState,
} from "@/lib/tracker";
import { endSummary, pendingCopy } from "@/lib/trackerCopy";

type Tab = "today" | "history" | "reports";
type Moment = { kind: "resume" | "end"; motivation: Motivation; title?: string; line?: string };

const HIDE_CLOCK_KEY = "tracker_hide_clock";

/**
 * Everything about goals and study time in one place: Let's go / Stop / Resume, the goal and its progress,
 * the last 4 days, history and reports. It is used by the Study Tracker page AND the Focus Timer popup, and
 * both read and write the very same data, so a goal made in one place continues in the other.
 * The person must be signed in before this is shown.
 */
export function TrackerWorkspace({
  deskTitle = "",
  onBlocked,
  onState,
  inFocusTimer = false,
}: {
  deskTitle?: string | undefined;
  onBlocked?: (() => void) | undefined;
  // told whenever fresh data arrives (the Focus Timer uses it to know how time is being counted)
  onState?: ((s: TrackerState) => void) | undefined;
  inFocusTimer?: boolean | undefined;
}) {
  const [state, setState] = useState<TrackerState | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const fetchedAt = useRef(Date.now());
  const [, setTick] = useState(0);

  const [tab, setTab] = useState<Tab>("today");
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<null | "end" | "update" | "goal">(null);
  const [continuing, setContinuing] = useState<HistoryGoal | null>(null);
  const [moment, setMoment] = useState<Moment | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [hideClock, setHideClock] = useState(false);
  const [changingMode, setChangingMode] = useState(false);

  const apply = useCallback(
    (s: TrackerState) => {
      fetchedAt.current = Date.now();
      setState(s);
      onState?.(s);
    },
    [onState],
  );

  const refresh = useCallback(async () => {
    try {
      const s = await trackerApi.state();
      apply(s);
      setLoadFailed(false);
      if (s.autoClosed) {
        toast("Your last session wasn't ended, so it was closed automatically. Hit Let's go to start again.");
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) onBlocked?.();
      else setLoadFailed(true);
    }
  }, [apply, onBlocked]);

  useEffect(() => {
    setHideClock(localStorage.getItem(HIDE_CLOCK_KEY) === "1");
    void refresh();
  }, [refresh]);

  // No pings: time is worked out from the date/time of each button click.
  const status = state?.session.status;

  // coming back to the tab -> one refresh (an event, not a timer)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [refresh]);

  // the little clock only needs to move once in a while
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // tab title shows the state, never the time (and goes back to normal when this closes)
  useEffect(() => {
    const before = document.title;
    return () => {
      document.title = before;
    };
  }, []);
  useEffect(() => {
    if (status === "studying") document.title = "Studying · StudyWithStrangers";
    else if (status === "break") document.title = "On a break · StudyWithStrangers";
  }, [status]);

  const liveTodaySec = state
    ? state.session.todayStudySec +
      (state.session.status === "studying" ? Math.floor((Date.now() - fetchedAt.current) / 1000) : 0)
    : 0;

  // ---------- actions ----------
  const run = async (fn: () => Promise<TrackerState>, after?: (s: TrackerState) => void) => {
    if (busy) return;
    setBusy(true);
    try {
      const s = await fn();
      apply(s);
      after?.(s);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        await refresh(); // an earlier day still needs its progress: the sheet will open
      } else {
        toast.error(err instanceof Error ? err.message : "Something went wrong. Try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const showEnd = (s: TrackerState) => {
    const sum = endSummary(s);
    setMoment({ kind: "end", motivation: s.motivations.end, title: sum.title, line: sum.line });
    setHistoryKey((k) => k + 1);
  };

  const closeMoment = useCallback(() => setMoment(null), []);

  const onMain = () => {
    if (!state) return;
    if (state.session.status === "studying") {
      void run(trackerApi.pause);
    } else if (state.session.status === "break" || state.session.startedToday) {
      const quote = state.motivations.resume; // the line for THIS resume
      void run(trackerApi.start, () => setMoment({ kind: "resume", motivation: quote }));
    } else {
      void run(trackerApi.start);
    }
  };

  const onEnd = () => {
    if (!state) return;
    if (state.goal) setSheet("end");
    else void run(() => trackerApi.end(), showEnd);
  };

  const goal = state?.goal ?? null;
  const pending = state?.pending[0];

  return (
    <div>
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-border bg-muted/50 p-1">
            {(
              [
                ["today", "Today"],
                ["history", "History"],
                ["reports", "Reports"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={
                  "rounded-full px-5 py-2 text-sm font-semibold transition-colors " +
                  (tab === k ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground")
                }
              >
                {label}
              </button>
            ))}
          </div>
          {/* tiny, quiet, and optional: it only moves once in a while */}
          <button
            onClick={() => {
              const next = !hideClock;
              setHideClock(next);
              localStorage.setItem(HIDE_CLOCK_KEY, next ? "1" : "0");
            }}
            title={hideClock ? "Show today's total" : "Hide today's total"}
            className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Clock className="h-3 w-3" />
            {hideClock ? "Today" : state ? `Today ${fmtDur(liveTodaySec)}` : "Today"}
          </button>
        </div>

        {tab === "today" && (
          <div className="mt-6 space-y-4">
            {deskTitle && (
              <p className="text-center text-xs text-muted-foreground">
                Studying with <b className="text-foreground">{deskTitle}</b>
              </p>
            )}
            {!state ? (
              <div className="grid place-items-center py-24 text-sm text-muted-foreground">
                {loadFailed ? (
                  <button onClick={refresh} className="rounded-full border border-border px-5 py-2.5 font-semibold hover:bg-muted">
                    Couldn't load. Tap to retry
                  </button>
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin" />
                )}
              </div>
            ) : (
              <>
                {state.mode === null || changingMode ? (
                  <ModeChooser
                    current={state.mode}
                    busy={busy}
                    onChoose={(mode) =>
                      void run(
                        () => trackerApi.setMode(mode),
                        () => setChangingMode(false),
                      )
                    }
                    onCancel={state.mode !== null ? () => setChangingMode(false) : undefined}
                  />
                ) : (
                  <StudyHero
                    state={state}
                    busy={busy}
                    onMain={onMain}
                    onEnd={onEnd}
                    inFocusTimer={inFocusTimer}
                    onChangeMode={() => setChangingMode(true)}
                  />
                )}
                <GoalCard goal={goal} onUpdate={() => setSheet("update")} onNew={() => setSheet("goal")} />
                <FourDayTracker state={state} liveTodaySec={liveTodaySec} />
              </>
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="mt-6">
            <HistoryPanel reloadKey={historyKey} onContinue={setContinuing} />
          </div>
        )}
        {tab === "reports" && (
          <div className="mt-6">
            <ReportPanel />
          </div>
        )}

      {/* ---- must-do: an earlier day was studied but its progress never saved ---- */}
      {state && goal && pending && (
        <ProgressSheet
          key={pending.date}
          title={`Where did you stop on ${dayLabel(pending.date, state.today)}?`}
          subtitle={pendingCopy(fmtDur(pending.studySec))}
          goalTitle={goal.title}
          min={pending.minProgress}
          initial={pending.minProgress}
          confirmLabel="Save and continue"
          busy={busy}
          onConfirm={(p) => void run(() => trackerApi.saveProgress(goal.id, pending.date, p))}
        />
      )}

      {/* ---- end of day: mandatory progress ---- */}
      {state && goal && !pending && sheet === "end" && (
        <ProgressSheet
          title="How far did you get today?"
          subtitle={`Move the bar to where "${goal.title}" stands now. Be honest, tomorrow starts from here.`}
          goalTitle={goal.title}
          min={goal.progressBefore}
          initial={goal.progressNow}
          target={goal.targetEnd}
          confirmLabel="Save and end session"
          busy={busy}
          onClose={() => setSheet(null)}
          onConfirm={(p) =>
            void run(
              () => trackerApi.end(p),
              (s) => {
                setSheet(null);
                showEnd(s);
              },
            )
          }
        />
      )}

      {/* ---- nudge today's progress without ending ---- */}
      {state && goal && !pending && sheet === "update" && (
        <ProgressSheet
          title="Update today's progress"
          subtitle="Moved further than you thought? Set it here. It's saved for today."
          goalTitle={goal.title}
          min={goal.progressBefore}
          initial={goal.progressNow}
          target={goal.targetEnd}
          confirmLabel="Save progress"
          busy={busy}
          onClose={() => setSheet(null)}
          onConfirm={(p) =>
            void run(
              () => trackerApi.saveProgress(goal.id, state.today, p),
              (s) => {
                setSheet(null);
                if (s.goalCompleted) showEnd(s);
              },
            )
          }
        />
      )}

      {state && sheet === "goal" && (
        <GoalFormSheet
          mode="create"
          maxDays={state.settings.maxGoalDays}
          busy={busy}
          onClose={() => setSheet(null)}
          onSubmit={(title, days) => void run(() => trackerApi.createGoal(title, days), () => setSheet(null))}
        />
      )}

      {state && continuing && (
        <GoalFormSheet
          mode="continue"
          maxDays={state.settings.maxGoalDays}
          initialTitle={continuing.title}
          currentProgress={continuing.progress}
          busy={busy}
          onClose={() => setContinuing(null)}
          onSubmit={(_title, days) =>
            void run(
              () => trackerApi.continueGoal(continuing.id, days),
              () => {
                setContinuing(null);
                setTab("today");
                setHistoryKey((k) => k + 1);
              },
            )
          }
        />
      )}

      {moment && (
        <MomentOverlay
          kind={moment.kind}
          motivation={moment.motivation}
          title={moment.title}
          line={moment.line}
          onDone={closeMoment}
        />
      )}
    </div>
  );
}
