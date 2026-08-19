import { useEffect, useState } from "react";
import { Check, Video } from "lucide-react";
import { Modal } from "./Modal";
import { relativeTime, type Desk } from "@/lib/joindesk";

export function JoinDeskModal({
  open,
  desk,
  onClose,
}: {
  open: boolean;
  desk: Desk | null;
  onClose: () => void;
}) {
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (open) setAgreed(false);
  }, [open, desk?.id]);

  if (!desk) return null;

  const join = () => {
    window.open(desk.meetLink, "_blank");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      <span className="inline-flex items-center gap-2 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-medium text-success">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
        Active Desk (3h max)
      </span>
      <h2 className="mt-3 pr-8 text-xl font-bold leading-snug tracking-tight">{desk.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {desk.description || "No description provided."}
      </p>

      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-muted/50 p-3">
        <img src={desk.creatorAvatar} alt={desk.creatorName} className="h-9 w-9 rounded-full object-cover" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Created by {desk.creatorName}</p>
          <p className="text-xs text-muted-foreground">{relativeTime(desk.createdAt)}</p>
        </div>
      </div>

      <button
        onClick={() => setAgreed((a) => !a)}
        className="mt-5 flex w-full items-start gap-3 rounded-2xl border border-border p-4 text-left transition-colors hover:bg-muted/50"
      >
        <span
          className={
            "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-all " +
            (agreed ? "border-transparent bg-brand-gradient" : "border-border bg-card")
          }
        >
          {agreed && <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />}
        </span>
        <span className="text-xs leading-relaxed text-muted-foreground">
          I agree to keep the environment focused, be respectful, and avoid spam/self-promotion.
        </span>
      </button>

      <button
        onClick={join}
        disabled={!agreed}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-join-gradient px-5 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-none disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:hover:scale-100"
      >
        <Video className="h-4 w-4" />
        Join via Google Meet
      </button>
    </Modal>
  );
}
