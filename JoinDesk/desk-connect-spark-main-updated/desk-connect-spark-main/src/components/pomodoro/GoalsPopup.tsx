import { useEffect } from "react";
import { X } from "lucide-react";
import { TrackerWorkspace } from "@/components/tracker/TrackerWorkspace";
import { GoogleIcon } from "@/components/joindesk/GoogleIcon";
import type { AppUser } from "@/lib/auth";

/**
 * Goals, study time, history and reports inside the Focus Timer, in a popup so the picture stays clean.
 * It is the very same workspace as the Study Tracker page and uses the same data: a goal started in a
 * desk can be continued here the next day, and the other way round.
 */
export function GoalsPopup({
  user,
  onClose,
  onLogin,
  onBlocked,
}: {
  user: AppUser | null;
  onClose: () => void;
  onLogin: () => void;
  onBlocked: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-black/55 p-3 backdrop-blur-sm duration-200 animate-in fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-border bg-background text-foreground shadow-glow">
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 py-3">
          <h2 className="text-sm font-bold tracking-tight">Goals &amp; progress</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-6">
          {user ? (
            <TrackerWorkspace onBlocked={onBlocked} />
          ) : (
            <div className="mx-auto max-w-sm py-14 text-center">
              <h3 className="text-lg font-bold tracking-tight">Sign in to use your goals</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Your goals and study time are saved to your account, so they follow you into every desk.
              </p>
              <button
                onClick={onLogin}
                className="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted"
              >
                <GoogleIcon /> Continue with Google
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
