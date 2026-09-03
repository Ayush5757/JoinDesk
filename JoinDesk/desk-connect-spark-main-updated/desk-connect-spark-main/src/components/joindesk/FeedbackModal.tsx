import { useEffect, useRef, useState } from "react";
import { Info, Maximize, Minimize, MessageSquareWarning, Send } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "./Modal";
import { submitFeedback, type FeedbackType } from "@/lib/feedback";
import { ApiError } from "@/lib/api";

// Point this at your own hosted video (mp4 URL, or swap the <video> tag
// below for a YouTube/Vimeo <iframe> if that's easier for you). Left empty
// by default so the popup still works and looks right before you add one.
const TUTORIAL_VIDEO_URL = "";

export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const videoWrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [type, setType] = useState<FeedbackType>("suggestion");
  const [message, setMessage] = useState("");
  const [reportedUserId, setReportedUserId] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setType("suggestion");
      setMessage("");
      setReportedUserId("");
      setError("");
    }
  }, [open]);

  useEffect(() => {
    const handleChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const toggleFullscreen = () => {
    if (!videoWrapperRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoWrapperRef.current.requestFullscreen?.();
    }
  };

  const field =
    "w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:bg-card focus:shadow-soft";

  const submit = async () => {
    if (!message.trim()) {
      return setError(
        type === "complaint" ? "Please describe what happened." : "Please write your suggestion."
      );
    }
    setSubmitting(true);
    setError("");
    try {
      const { autoBlocked } = await submitFeedback({
        type,
        message: message.trim(),
        reportedUserId: type === "complaint" ? reportedUserId.trim() : undefined,
      });
      toast.success(
        type === "suggestion"
          ? "Thanks! Your suggestion has been sent."
          : autoBlocked
            ? "Complaint sent — that user has been blocked."
            : "Complaint sent. Our team will look into it."
      );
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send that. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-2xl bg-brand-gradient text-primary-foreground">
          <MessageSquareWarning className="h-4.5 w-4.5" />
        </span>
        <h2 className="text-xl font-bold tracking-tight">Suggestions & Complaints</h2>
      </div>

      <div className="mt-4 flex gap-3 rounded-2xl bg-info-soft p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        <p className="text-xs leading-relaxed text-info">
          Have a suggestion for JoinDesk, or is someone spamming or troubling you in a desk? Pick
          "Complaint" below and, if it's about a specific person, paste their <b>User ID</b> —
          you'll find it in the URL when you open their profile page (e.g.{" "}
          <code className="rounded bg-info/10 px-1 py-0.5">/profile/&lt;their-id&gt;</code>). If
          enough different people report the same User ID, that account gets blocked
          automatically.
        </p>
      </div>

      <div
        ref={videoWrapperRef}
        className="relative mt-4 aspect-video w-full overflow-hidden rounded-2xl bg-black"
      >
        {TUTORIAL_VIDEO_URL ? (
          <video src={TUTORIAL_VIDEO_URL} controls className="h-full w-full object-contain" />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-white/50">
            Video coming soon
          </div>
        )}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
        >
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">What is this?</label>
          <div className="mt-1.5 inline-flex rounded-full border border-border bg-muted/50 p-1">
            {(["suggestion", "complaint"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={
                  "rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition-colors " +
                  (type === t ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground")
                }
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {type === "complaint" && (
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              User ID (optional — leave blank if it's not about a specific person)
            </label>
            <input
              value={reportedUserId}
              onChange={(e) => setReportedUserId(e.target.value)}
              placeholder="e.g. 3f2a9c11-8b4d-4e77-9a10-1d2e3f4a5b6c"
              className={"mt-1.5 " + field}
            />
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-muted-foreground">
            {type === "complaint" ? "What happened?" : "Your suggestion"}
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder={
              type === "complaint"
                ? "Describe what this user did and which desk it happened in…"
                : "Tell us what you'd like to see added or changed…"
            }
            className={"mt-1.5 resize-none " + field}
          />
        </div>
      </div>

      {error && <p className="mt-3 text-xs font-medium text-destructive">{error}</p>}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          onClick={onClose}
          className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={submitting}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Send"}
          <Send className="h-4 w-4" />
        </button>
      </div>
    </Modal>
  );
}
