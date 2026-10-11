import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Sheet } from "./Sheet";

/**
 * Create a new goal ("Finish Physics chapter 3") with a number of days, or
 * pick an unfinished goal up again (title is fixed, only days are chosen).
 */
export function GoalFormSheet({
  mode,
  maxDays,
  initialTitle,
  currentProgress,
  busy,
  onSubmit,
  onClose,
}: {
  mode: "create" | "continue";
  maxDays: number;
  initialTitle?: string | undefined;
  currentProgress?: number | undefined;
  busy: boolean;
  onSubmit: (title: string, days: number) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initialTitle ?? "");
  const [days, setDays] = useState(Math.min(4, maxDays));
  const chips = maxDays <= 10;
  const isCreate = mode === "create";

  return (
    <Sheet onClose={onClose}>
      <h2 className="text-xl font-bold tracking-tight">{isCreate ? "What will you finish?" : "Pick it back up"}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {isCreate
          ? "Name one clear goal and give yourself a deadline. A small, specific goal beats a big vague one."
          : `You're already at ${currentProgress ?? 0}%. Choose how many days you'll give it now. You continue from where you stopped.`}
      </p>

      {isCreate ? (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="e.g. Finish Physics Chapter 3"
          className="mt-5 w-full rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm outline-none transition-colors focus:border-primary/50 focus:bg-card"
        />
      ) : (
        <p className="mt-5 rounded-2xl bg-muted/50 px-4 py-3 text-sm font-semibold">{title}</p>
      )}

      <p className="mt-5 text-xs font-semibold text-muted-foreground">In how many days?</p>
      {chips ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {Array.from({ length: maxDays }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setDays(n)}
              className={
                "h-11 min-w-[2.75rem] rounded-full border px-4 text-sm font-semibold transition-colors " +
                (days === n
                  ? "border-transparent bg-foreground text-background"
                  : "border-border bg-card hover:bg-muted")
              }
            >
              {n}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <input
            type="range"
            min={1}
            max={maxDays}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="tracker-range"
            style={{ ["--fill" as string]: `${((days - 1) / Math.max(1, maxDays - 1)) * 100}%` }}
            aria-label="Number of days"
          />
          <p className="mt-2 text-center text-2xl font-bold tabular-nums">{days} days</p>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        That's about {Math.ceil(100 / days)}% a day. Up to {maxDays} days allowed.
      </p>

      <button
        onClick={() => onSubmit(title.trim(), days)}
        disabled={busy || (isCreate && !title.trim())}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-gradient px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-soft transition-opacity hover:opacity-95 disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {isCreate ? "Set this goal" : "Continue this goal"}
      </button>
      <button
        onClick={onClose}
        disabled={busy}
        className="mt-2 w-full rounded-full px-6 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Cancel
      </button>
    </Sheet>
  );
}
