import { useEffect, useRef, useState } from "react";
import {
  Info,
  Maximize,
  Minimize,
  MessageSquareWarning,
  MessageCircle,
  Send,
  X,
  LayoutGrid,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "./Modal";
import { submitFeedback, buildWhatsAppLink, type FeedbackType } from "@/lib/feedback";
import { searchDesksForPicker } from "@/lib/desks";
import { ApiError } from "@/lib/api";

// Point this at your own hosted video (mp4 URL, or swap the <video> tag
// below for a YouTube/Vimeo <iframe> if that's easier for you). Left empty
// by default so the popup still works and looks right before you add one.
const TUTORIAL_VIDEO_URL = "";

type DeskOption = { id: string; title: string };

export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const videoWrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [type, setType] = useState<FeedbackType>("suggestion");
  const [message, setMessage] = useState("");
  const [reportedName, setReportedName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Desk picker — search-as-you-type against real desks, never free text.
  const [deskQuery, setDeskQuery] = useState("");
  const [deskResults, setDeskResults] = useState<DeskOption[]>([]);
  const [deskLoading, setDeskLoading] = useState(false);
  const [deskOpen, setDeskOpen] = useState(false);
  const [selectedDesk, setSelectedDesk] = useState<DeskOption | null>(null);
  const deskBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setType("suggestion");
      setMessage("");
      setReportedName("");
      setError("");
      setDeskQuery("");
      setDeskResults([]);
      setSelectedDesk(null);
      setDeskOpen(false);
    }
  }, [open]);

  useEffect(() => {
    const handleChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  // Debounced desk search, only while the picker is open and nothing is
  // selected yet.
  useEffect(() => {
    if (!deskOpen || selectedDesk) return;
    let cancelled = false;
    setDeskLoading(true);
    const handle = setTimeout(async () => {
      try {
        const results = await searchDesksForPicker(deskQuery);
        if (!cancelled) setDeskResults(results);
      } catch {
        if (!cancelled) setDeskResults([]);
      } finally {
        if (!cancelled) setDeskLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [deskQuery, deskOpen, selectedDesk]);

  // Close the desk dropdown on outside click.
  useEffect(() => {
    if (!deskOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (deskBoxRef.current && !deskBoxRef.current.contains(e.target as Node)) {
        setDeskOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [deskOpen]);

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

  const openWhatsApp = () => {
    const url = buildWhatsAppLink({
      type,
      message,
      reportedName: type === "complaint" ? reportedName : undefined,
      reportedDeskTitle: type === "complaint" ? selectedDesk?.title : undefined,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const submit = async () => {
    if (!message.trim()) {
      return setError(
        type === "complaint" ? "Please describe what happened." : "Please write your suggestion.",
      );
    }
    setSubmitting(true);
    setError("");
    try {
      const { autoBlocked } = await submitFeedback({
        type,
        message: message.trim(),
        reportedName: type === "complaint" ? reportedName.trim() : undefined,
        reportedDeskId: type === "complaint" ? selectedDesk?.id : undefined,
      });
      toast.success(
        type === "suggestion"
          ? "Thanks! Your suggestion has been sent."
          : autoBlocked
            ? "Complaint sent — that user has been blocked."
            : "Complaint sent. Our team will look into it.",
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

      {/* Type toggle up top so the WhatsApp message below matches what the
          person actually wants to send. */}
      <div className="mt-4">
        <div className="inline-flex rounded-full border border-border bg-muted/50 p-1">
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

      {/* WhatsApp-first CTA — the fastest way to reach us, especially for a
          complaint that needs an urgent response. */}
      <div className="mt-4 rounded-2xl border border-[#25D366]/30 bg-[#25D366]/10 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#25D366] text-white">
            <MessageCircle className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-bold text-[#128C4A]">
              <Zap className="h-3.5 w-3.5" /> How We Help You:
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-[#128C4A]/90">
              If you experience any misbehavior or harassment during desk calls, please message us
              immediately on WhatsApp for a swift resolution. Alternatively, if you don't mind
              waiting a bit for a response, you can fill out the form with your details.
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-[#128C4A]/90">
              1) WhatsApp: Best for instant support.
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-[#128C4A]/90">
              2) Form Submission: Best if you can wait for a standard reply.
            </p>
          </div>
        </div>
        <button
          onClick={openWhatsApp}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
        >
          <MessageCircle className="h-4 w-4" /> Message us on WhatsApp
        </button>
      </div>

      {/* <div className="mt-4 flex gap-3 rounded-2xl bg-info-soft p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        <p className="text-xs leading-relaxed text-info">
          {type === "complaint"
            ? "Is someone spamming or troubling you in a desk? Tell us their name and which desk it happened in below — none of this is required, but it helps us act fast. If enough different people report the same name and desk, that account gets blocked."
            : "Have a suggestion for JoinDesk? Tell us what you'd like to see added or changed."}
        </p>
      </div> */}

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

      <p className="mt-4 text-xs font-semibold text-muted-foreground">
        Or log it here on the dashboard instead:
      </p>

      <div className="mt-2 space-y-4">
        {type === "complaint" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Their name (optional)
              </label>
              <input
                value={reportedName}
                onChange={(e) => setReportedName(e.target.value)}
                placeholder="e.g. Rohan"
                className={"mt-1.5 " + field}
              />
            </div>

            <div ref={deskBoxRef} className="relative">
              <label className="text-xs font-semibold text-muted-foreground">
                Which desk? (optional)
              </label>
              {selectedDesk ? (
                <div className={"mt-1.5 flex items-center justify-between gap-2 " + field}>
                  <span className="flex min-w-0 items-center gap-1.5 truncate">
                    <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{selectedDesk.title}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDesk(null);
                      setDeskQuery("");
                    }}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    title="Change desk"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    value={deskQuery}
                    onChange={(e) => setDeskQuery(e.target.value)}
                    onFocus={() => setDeskOpen(true)}
                    placeholder="Search desk by title…"
                    className={"mt-1.5 " + field}
                  />
                  {deskOpen && (
                    <div className="absolute z-10 mt-1.5 max-h-48 w-full overflow-y-auto rounded-2xl border border-border bg-card p-1.5 shadow-soft">
                      {deskLoading ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
                      ) : deskResults.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          No matching desks.
                        </p>
                      ) : (
                        deskResults.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => {
                              setSelectedDesk(d);
                              setDeskOpen(false);
                            }}
                            className="flex w-full items-center gap-1.5 truncate rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted"
                          >
                            <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{d.title}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
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
                ? "Describe what this person did…"
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
