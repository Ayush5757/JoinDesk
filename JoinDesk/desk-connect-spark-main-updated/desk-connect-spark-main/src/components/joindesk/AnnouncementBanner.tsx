import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";

const DISMISSED_KEY = "joindesk_announcement_dismissed";

/**
 * A clear, flexible notice box for the one message an admin sets for
 * everyone (see lib/settings.ts + Admin Panel "Notice" tab). Built to read
 * cleanly on a small phone screen (short line-height, wraps nicely, icon
 * doesn't shrink) and on a wide desktop screen (stays a comfortable
 * max-width instead of stretching edge-to-edge) alike.
 *
 * Dismissing is remembered per exact message — so closing today's notice
 * doesn't also hide tomorrow's different one.
 */
export function AnnouncementBanner({ message }: { message: string | null }) {
  const [dismissedText, setDismissedText] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDismissedText(localStorage.getItem(DISMISSED_KEY));
    } catch {
      // localStorage can fail in private/incognito modes — just show the banner.
    }
  }, []);

  if (!message || message === dismissedText) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, message);
    } catch {
      // Not fatal — it'll just reappear on next visit, which is fine.
    }
    setDismissedText(message);
  };

  return (
    <div className="mx-auto mb-6 flex w-full max-w-3xl items-start gap-3 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3.5 shadow-soft sm:items-center sm:px-5">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-gradient sm:mt-0">
        <Megaphone className="h-4 w-4 text-primary-foreground" />
      </span>
      <p className="min-w-0 flex-1 text-sm leading-snug text-foreground">{message}</p>
      {/* <button
        onClick={handleDismiss}
        title="Dismiss"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary/15 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button> */}
    </div>
  );
}
