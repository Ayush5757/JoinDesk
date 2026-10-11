import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BlockedScreen } from "@/components/joindesk/BlockedScreen";
import { GoogleIcon } from "@/components/joindesk/GoogleIcon";
import { StudyHero } from "@/components/tracker/StudyHero";
import { GoalCard } from "@/components/tracker/GoalCard";
import { FourDayTracker } from "@/components/tracker/FourDayTracker";
import { HistoryPanel } from "@/components/tracker/HistoryPanel";
import { ReportPanel } from "@/components/tracker/ReportPanel";
import { ProgressSheet } from "@/components/tracker/ProgressSheet";
import { GoalFormSheet } from "@/components/tracker/GoalFormSheet";
import { MomentOverlay } from "@/components/tracker/MomentOverlay";
import { ApiError } from "@/lib/api";
import { loginWithGoogle, restoreSession, BlockedError, type AppUser } from "@/lib/auth";
import {
  dayLabel,
  fmtDur,
  trackerApi,
  type HistoryGoal,
  type Motivation,
  type TrackerState,
} from "@/lib/tracker";
import { endSummary, pendingCopy } from "@/lib/trackerCopy";

export const Route = createFileRoute("/tracker")({
  head: () => ({ meta: [{ title: "Study Tracker — JoinDesk" }] }),
  component: TrackerPage,
});

type Tab = "today" | "history" | "reports";
type Moment = { kind: "resume" | "end"; motivation: Motivation; title?: string; line?: string };

const HIDE_CLOCK_KEY = "tracker_hide_clock";

function TrackerPage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [blocked, setBlocked] = useState(false);

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
  const [deskTitle, setDeskTitle] = useState("");

  // ---------- session ----------
  useEffect(() => {
    restoreSession()
      .then(setUser)
      .catch((err) => {
        if (err instanceof BlockedError) setBlocked(true);
      })
      .finally(() => setChecking(false));
    setHideClock(localStorage.getItem(HIDE_CLOCK_KEY) === "1");
    setDeskTitle(new URLSearchParams(window.location.search).get("d") ?? "");
  }, []);

  const apply = useCallback((s: TrackerState) => {
    fetchedAt.current = Date.now();
    setState(s);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const s = await trackerApi.state();
      apply(s);
      setLoadFailed(false);
      if (s.autoClosed) {
        toast("Your last session wasn't ended, so it was closed automatically. Hit Let's go to start again.");
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setBlocked(true);
      else setLoadFailed(true);
    }
  }, [apply]);

  useEffect(() => {
    if (user) void refresh();
  }, [user, refresh]);

  // No pings: time is worked out from the date/time of each button click.
  const status = state?.session.status;

  // coming back to the tab -> one refresh (an event, not a timer)
  useEffect(() => {
    if (!user) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [user, refresh]);

  // the little clock only needs to move once in a while
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // tab title shows the state, never the time
  useEffect(() => {
    document.title =
      status === "studying"
        ? "Studying · JoinDesk"
        : status === "break"
          ? "On a break · JoinDesk"
          : "Study Tracker — JoinDesk";
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

  const handleLogin = async () => {
    try {
      setUser(await loginWithGoogle());
    } catch (err) {
      if (err instanceof BlockedError) setBlocked(true);
      else toast.error(err instanceof Error ? err.message : "Couldn't sign in with Google.");
    }
  };

  // ---------- render ----------
  if (checking) return <div className="min-h-screen bg-background" />;
  if (blocked) return <BlockedScreen />;

  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
        <div className="w-full max-w-sm rounded-[28px] border border-border bg-card p-8 text-center shadow-soft">
          <h1 className="text-xl font-bold tracking-tight">Study Tracker</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to track your study time and goals.</p>
          <button
            onClick={handleLogin}
            className="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted"
          >
            <GoogleIcon /> Continue with Google
          </button>
        </div>
      </div>
    );
  }

  const goal = state?.goal ?? null;
  const pending = state?.pending[0];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link
            to="/special"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Desks
          </Link>

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
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        <div className="flex justify-center">
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
                <StudyHero state={state} busy={busy} onMain={onMain} onEnd={onEnd} />
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
      </main>

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
