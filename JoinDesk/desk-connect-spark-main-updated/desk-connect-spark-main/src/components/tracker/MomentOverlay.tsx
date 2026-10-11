import { useEffect } from "react";
import { Check, Sparkles } from "lucide-react";
import type { Motivation } from "@/lib/tracker";

/**
 * A full-screen pause for one good line.
 *  - "resume": appears for a few seconds, then fades into the session
 *  - "end": stays until the person taps Done, with a short summary
 */
export function MomentOverlay({
  kind,
  motivation,
  title,
  line,
  onDone,
}: {
  kind: "resume" | "end";
  motivation: Motivation;
  title?: string | undefined;
  line?: string | undefined;
  onDone: () => void;
}) {
  useEffect(() => {
    if (kind !== "resume") return;
    const t = setTimeout(onDone, 4200);
    return () => clearTimeout(t);
  }, [kind, onDone]);

  return (
    <div
      onClick={kind === "resume" ? onDone : undefined}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/95 p-6 backdrop-blur-xl duration-500 animate-in fade-in"
    >
      <div className="w-full max-w-xl text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-gradient text-primary-foreground shadow-glow">
          {kind === "end" ? <Check className="h-7 w-7" /> : <Sparkles className="h-6 w-6" />}
        </span>

        {title && <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>}
        <p className="mt-4 text-balance text-2xl font-semibold leading-snug tracking-tight sm:text-4xl">
          {motivation.text}
        </p>
        {motivation.author && <p className="mt-3 text-sm text-muted-foreground">{motivation.author}</p>}
        {line && <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">{line}</p>}

        {kind === "end" ? (
          <button
            onClick={onDone}
            className="mt-9 rounded-full bg-foreground px-9 py-3.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Done for today
          </button>
        ) : (
          <p className="mt-8 text-xs text-muted-foreground">Tap anywhere to continue</p>
        )}
      </div>
    </div>
  );
}
