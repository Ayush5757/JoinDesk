import { Hand, Loader2, Timer } from "lucide-react";
import type { TrackMode } from "@/lib/tracker";

/**
 * "How do you want to count your study time?" Two clear options, each explained in plain words:
 * what it is, why you'd pick it, and exactly what to do. Goals, progress and reports work the same either way.
 */
export function ModeChooser({
  current,
  busy,
  onChoose,
  onCancel,
}: {
  current: TrackMode;
  busy: boolean;
  onChoose: (mode: "focus" | "manual") => void;
  onCancel?: (() => void) | undefined;
}) {
  const options = [
    {
      key: "focus" as const,
      icon: <Timer className="h-5 w-5" />,
      title: "Focus Timer",
      tagline: "The timer counts for you",
      what: "Study in rounds, for example 25 minutes of focus and then a 5-minute break. Your study time is counted automatically while the timer runs, and breaks are counted as breaks.",
      why: "Pick this if you lose track of time or like a steady rhythm.",
      how: "Open the Focus Timer and press Start.",
    },
    {
      key: "manual" as const,
      icon: <Hand className="h-5 w-5" />,
      title: "By myself",
      tagline: "You decide when you study",
      what: "Press Let's go when you sit down to study and Stop when you take a break. No rounds and no countdown.",
      why: "Pick this if you read from a book, study in long stretches, or work away from this screen.",
      how: "Use the Let's go and Stop button here in Today.",
    },
  ];

  return (
    <section className="rounded-[32px] border border-border bg-card p-6 shadow-soft sm:p-8">
      <h2 className="text-xl font-bold tracking-tight">How do you want to count your study time?</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Choose one. Your goals, progress and reports work the same either way, and you can switch any time.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {options.map((o) => (
          <button
            key={o.key}
            disabled={busy}
            onClick={() => onChoose(o.key)}
            className={
              "flex flex-col rounded-3xl border p-5 text-left transition-all hover:shadow-soft active:scale-[0.99] disabled:opacity-60 " +
              (current === o.key ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40")
            }
          >
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-gradient text-primary-foreground">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : o.icon}
            </span>
            <span className="mt-3 text-base font-bold tracking-tight">{o.title}</span>
            <span className="text-xs font-semibold text-primary">{o.tagline}</span>
            <span className="mt-3 text-xs leading-relaxed text-foreground/80">{o.what}</span>
            <span className="mt-3 text-xs leading-relaxed text-muted-foreground">{o.why}</span>
            <span className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-xs font-medium">{o.how}</span>
            {current === o.key && <span className="mt-3 text-[11px] font-semibold text-primary">Your current choice</span>}
          </button>
        ))}
      </div>

      {onCancel && (
        <button onClick={onCancel} className="mt-4 text-xs font-semibold text-muted-foreground hover:text-foreground">
          Keep what I have
        </button>
      )}
    </section>
  );
}
