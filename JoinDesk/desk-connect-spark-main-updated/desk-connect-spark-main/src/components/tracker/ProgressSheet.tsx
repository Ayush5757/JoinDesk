import { useState } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { Sheet } from "./Sheet";

/**
 * The moveable progress bar: "how far along is the goal right now?".
 * It can never go below `min` (where the previous day ended).
 */
export function ProgressSheet({
  title,
  subtitle,
  goalTitle,
  min,
  initial,
  target,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  subtitle: string;
  goalTitle: string;
  min: number;
  initial: number;
  target?: number | undefined;
  confirmLabel: string;
  busy: boolean;
  onConfirm: (progress: number) => void;
  onClose?: (() => void) | undefined;
}) {
  const [value, setValue] = useState(Math.min(100, Math.max(min, initial)));
  const set = (n: number) => setValue(Math.min(100, Math.max(min, Math.round(n))));

  return (
    <Sheet onClose={onClose}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{goalTitle}</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>

      <div className="mt-7 flex items-center justify-center gap-5">
        <button
          onClick={() => set(value - 5)}
          disabled={value <= min}
          aria-label="Less"
          className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card transition-colors hover:bg-muted disabled:opacity-30"
        >
          <Minus className="h-4 w-4" />
        </button>
        <p className="min-w-[5.5rem] text-center text-5xl font-bold tracking-tight tabular-nums">{value}%</p>
        <button
          onClick={() => set(value + 5)}
          disabled={value >= 100}
          aria-label="More"
          className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card transition-colors hover:bg-muted disabled:opacity-30"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="relative mt-6 px-1">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(e) => set(Number(e.target.value))}
          className="tracker-range"
          style={{ ["--fill" as string]: `${value}%` }}
          aria-label="Goal progress"
        />
        {target !== undefined && target > min && target <= 100 && (
          <span
            className="pointer-events-none absolute -top-2.5 -translate-x-1/2 text-[10px] font-semibold text-muted-foreground"
            style={{ left: `${target}%` }}
          >
            ▾ target
          </span>
        )}
        <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
          <span>{min > 0 ? `Locked at ${min}% (where you left off)` : "0%"}</span>
          <span>100%</span>
        </div>
      </div>

      <button
        onClick={() => onConfirm(value)}
        disabled={busy}
        className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-gradient px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-soft transition-opacity hover:opacity-95 disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {confirmLabel}
      </button>
      {onClose && (
        <button
          onClick={onClose}
          disabled={busy}
          className="mt-2 w-full rounded-full px-6 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Not now
        </button>
      )}
    </Sheet>
  );
}
