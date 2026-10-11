import { Flame, Loader2, Pause, Play, Square } from "lucide-react";
import type { TrackerState } from "@/lib/tracker";
import { effortNudge, greeting } from "@/lib/trackerCopy";

/**
 * The calm centre of the page: today's line, ONE big button that changes
 * text, colour and job (Let's go -> Stop -> Resume), and the end-of-day button.
 * There is deliberately no running clock here. Time is tracked in the
 * background so it never becomes a distraction.
 */
export function StudyHero({
  state,
  busy,
  onMain,
  onEnd,
}: {
  state: TrackerState;
  busy: boolean;
  onMain: () => void;
  onEnd: () => void;
}) {
  const { status, startedToday } = state.session;
  const studying = status === "studying";
  const onBreak = status === "break";
  const fresh = status === "idle" && !startedToday;

  const button = studying
    ? { label: "Stop", cls: "bg-amber-500 text-white hover:bg-amber-500/90", icon: <Pause className="h-5 w-5" /> }
    : fresh
      ? {
          label: "Let's go",
          cls: "bg-brand-gradient text-primary-foreground hover:opacity-95",
          icon: <Play className="h-5 w-5" />,
        }
      : { label: "Resume", cls: "bg-emerald-500 text-white hover:bg-emerald-500/90", icon: <Play className="h-5 w-5" /> };

  const statusText = studying
    ? "Focus mode · tracking quietly"
    : onBreak
      ? "On a break · this is tracked too"
      : startedToday
        ? "Session paused · ready when you are"
        : `${greeting(new Date().getHours())}`;

  const quote = state.motivations.start;
  const nudge = effortNudge(state);

  return (
    <section className="rounded-[32px] border border-border bg-card px-6 py-10 text-center shadow-soft sm:px-12 sm:py-14">
      <div className="inline-flex items-center gap-2 rounded-full bg-muted/70 px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
        <span
          className={
            "h-1.5 w-1.5 rounded-full " +
            (studying ? "animate-pulse bg-emerald-500" : onBreak ? "bg-amber-500" : "bg-muted-foreground/50")
          }
        />
        {statusText}
      </div>

      {onBreak ? (
        <p className="mx-auto mt-7 max-w-lg text-balance text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
          Breathe. Drink some water. Come back when you're ready.
        </p>
      ) : (
        <p
          className={
            "mx-auto mt-7 max-w-lg text-balance font-semibold leading-snug tracking-tight " +
            (studying ? "text-xl text-foreground/80 sm:text-2xl" : "text-2xl sm:text-3xl")
          }
        >
          {quote.text}
        </p>
      )}
      {!onBreak && quote.author && <p className="mt-2 text-sm text-muted-foreground">{quote.author}</p>}

      {nudge && <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">{nudge}</p>}

      <button
        onClick={onMain}
        disabled={busy}
        className={
          "mx-auto mt-9 inline-flex h-14 w-full max-w-xs items-center justify-center gap-2.5 rounded-full text-base font-semibold shadow-soft transition-all active:scale-[0.98] disabled:opacity-60 " +
          button.cls
        }
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : button.icon}
        {button.label}
      </button>

      {startedToday && (
        <button
          onClick={onEnd}
          disabled={busy}
          className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
        >
          <Square className="h-3.5 w-3.5" /> End today's session
        </button>
      )}

      {state.streak.days >= 2 && (
        <p className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600">
          <Flame className="h-3.5 w-3.5" />
          {state.streak.days}-day streak{state.streak.todayDone ? "" : " · study today to keep it"}
        </p>
      )}
    </section>
  );
}
