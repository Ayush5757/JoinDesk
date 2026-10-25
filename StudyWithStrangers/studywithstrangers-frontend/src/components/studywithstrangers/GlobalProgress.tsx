import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getPending, subscribePending } from "@/lib/netActivity";

// Only show for something that is genuinely slow, show it briefly, then get out of the way.
const SHOW_AFTER_MS = 500; // quicker than this: no bar at all
const MAX_VISIBLE_MS = 1800; // longest the bar may stay, even if the server is still busy
const COOLDOWN_MS = 8000; // after one bar, stay quiet for a while so a chain of requests can't make it loop

/**
 * A thin bar at the top of the screen. It fills once, finishes, and disappears. It never runs forever, so
 * a slow server (or lots of small requests in a row) can't make the site feel like it is stuck loading.
 */
export function GlobalProgress() {
  const pending = useSyncExternalStore(subscribePending, getPending, () => 0);
  const [phase, setPhase] = useState<"idle" | "running" | "finishing">("idle");
  const armed = useRef(true); // true while no request is in flight: the next one may start a bar
  const lastShown = useRef(0);
  const startT = useRef<number | undefined>(undefined);
  const capT = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (pending > 0) {
      if (!armed.current) return; // a bar was already decided for this burst of requests
      armed.current = false;
      startT.current = window.setTimeout(() => {
        if (Date.now() - lastShown.current < COOLDOWN_MS) return;
        lastShown.current = Date.now();
        setPhase("running");
        capT.current = window.setTimeout(() => setPhase("finishing"), MAX_VISIBLE_MS);
      }, SHOW_AFTER_MS);
      return;
    }
    // Everything finished.
    armed.current = true;
    window.clearTimeout(startT.current); // finished before the delay: the bar never appears
    window.clearTimeout(capT.current);
    setPhase((p) => (p === "running" ? "finishing" : p));
  }, [pending]);

  useEffect(() => {
    if (phase !== "finishing") return;
    const t = window.setTimeout(() => setPhase("idle"), 500);
    return () => window.clearTimeout(t);
  }, [phase]);

  return (
    <div
      aria-hidden="true"
      className={
        "pointer-events-none fixed inset-x-0 top-0 z-[110] h-0.5 overflow-hidden transition-opacity duration-300 " +
        (phase === "idle" ? "opacity-0" : "opacity-100")
      }
    >
      <div
        className={
          "h-full origin-left rounded-full bg-brand-gradient " +
          (phase === "running" ? "animate-[progress-run_1.8s_ease-out_forwards]" : "") +
          (phase === "finishing" ? "scale-x-100 transition-transform duration-300" : "")
        }
        style={phase === "idle" ? { transform: "scaleX(0)" } : undefined}
      />
    </div>
  );
}
