import { useEffect, useState, useSyncExternalStore } from "react";
import { getPending, subscribePending } from "@/lib/netActivity";

/**
 * A thin bar at the very top of the screen that appears whenever the app is waiting for the server.
 * It only shows up if a request takes more than a moment, so quick actions don't flicker.
 */
export function GlobalProgress() {
  const pending = useSyncExternalStore(subscribePending, getPending, () => 0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (pending > 0) {
      const t = setTimeout(() => setVisible(true), 250);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setVisible(false), 200);
    return () => clearTimeout(t);
  }, [pending]);

  return (
    <div
      aria-hidden="true"
      className={
        "pointer-events-none fixed inset-x-0 top-0 z-[110] h-0.5 overflow-hidden transition-opacity duration-300 " +
        (visible ? "opacity-100" : "opacity-0")
      }
    >
      <div className="h-full w-1/3 animate-[progress-slide_1.1s_ease-in-out_infinite] rounded-full bg-brand-gradient" />
    </div>
  );
}
