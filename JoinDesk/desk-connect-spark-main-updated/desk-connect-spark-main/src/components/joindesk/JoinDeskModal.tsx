import { useEffect, useState } from "react";
import { Check, CreditCard, Loader2, Sparkles, Video } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "./Modal";
import { relativeTime, type Desk } from "@/lib/joindesk";
import { recordDeskJoin } from "@/lib/users";
import { ApiError } from "@/lib/api";
import {
  formatDate,
  paymentInfoFromError,
  payForAccess,
  type PaymentRequiredInfo,
} from "@/lib/billing";

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
  const [joining, setJoining] = useState(false);
  const [paying, setPaying] = useState(false);
  // Set when the backend answers 402: this person has no free access, no
  // active paid month and no trial left — show the payment panel.
  const [paywall, setPaywall] = useState<PaymentRequiredInfo | null>(null);

  useEffect(() => {
    if (open) {
      setAgreed(false);
      setPaywall(null);
      setJoining(false);
      setPaying(false);
    }
  }, [open, desk?.id]);

  if (!desk) return null;

  const join = async () => {
    if (joining) return;
    setJoining(true);
    // Open the tab right now, inside the click, so popup blockers allow it —
    // we only point it at the meeting link once the access check passes.
    const win = window.open("", "_blank");
    try {
      const { meetLink } = await recordDeskJoin(desk.id);
      if (win) {
        win.opener = null;
        win.location.href = meetLink;
      } else if (!window.open(meetLink, "_blank")) {
        window.location.href = meetLink;
      }
      onClose();
    } catch (err) {
      win?.close();
      const info = paymentInfoFromError(err);
      if (info) {
        setPaywall(info);
      } else if (err instanceof ApiError && err.status === 401) {
        toast.error("Please sign in with Google to join a desk.");
      } else if (err instanceof ApiError && err.status === 403) {
        toast.error("Your account can't join desks right now.");
      } else {
        toast.error(err instanceof Error ? err.message : "Couldn't join this desk. Try again.");
      }
    } finally {
      setJoining(false);
    }
  };

  const pay = async () => {
    if (paying) return;
    setPaying(true);
    try {
      const access = await payForAccess();
      if (access) {
        setPaywall(null);
        toast.success(
          `Payment successful — full access active until ${formatDate(access.until)}. Tap Join Meeting.`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment didn't go through. Try again.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      {desk.isSpecial ? (
        <span className="inline-flex items-center gap-2 rounded-full bg-special-soft px-2.5 py-1 text-[11px] font-medium text-special">
          <Sparkles className="h-3 w-3" />
          Special Desk · Always available
        </span>
      ) : (
        <span className="inline-flex items-center gap-2 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-medium text-success">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          Active Desk (15d max)
        </span>
      )}
      <h2 className="mt-3 pr-8 text-xl font-bold leading-snug tracking-tight">{desk.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {desk.description || "No description provided."}
      </p>

      {!desk.isSpecial && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-muted/50 p-3">
          <img
            src={desk.creatorAvatar}
            alt={desk.creatorName}
            className="h-9 w-9 rounded-full object-cover"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Created by {desk.creatorName}</p>
            <p className="text-xs text-muted-foreground">{relativeTime(desk.createdAt)}</p>
          </div>
        </div>
      )}

      {paywall ? (
        <div className="mt-5 rounded-2xl border border-primary/25 bg-primary/10 p-4">
          <p className="text-sm font-bold">
            {paywall.trialDays > 0 ? "Your free trial has ended" : "Subscription required"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Get {paywall.days} days of full access to every desk — special and regular — with one
            payment. UPI, cards and netbanking all work.
          </p>
          <button
            onClick={pay}
            disabled={paying}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-gradient px-5 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
          >
            {paying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            {paying
              ? "Opening payment…"
              : paywall.priceInr > 0
                ? `Pay ₹${paywall.priceInr} · ${paywall.days} days access`
                : "Pay & unlock access"}
          </button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Secure payment by Razorpay. Access starts the moment you pay.
          </p>
        </div>
      ) : (
        <>
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
            disabled={!agreed || joining}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-join-gradient px-5 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-none disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:hover:scale-100"
          >
            {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
            Join Meeting
          </button>
        </>
      )}
    </Modal>
  );
}
