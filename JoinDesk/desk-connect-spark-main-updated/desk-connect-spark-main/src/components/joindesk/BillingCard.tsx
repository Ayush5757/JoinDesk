import { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, CreditCard, Gift, Loader2, Receipt, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { formatDate, getBillingStatus, payForAccess, type BillingStatus } from "@/lib/billing";

/**
 * "My access" card on the owner's profile: shows exactly what they have
 * (paid month with end date, free trial, free access from the admin) and a
 * Pay / Renew button. Renewing early adds on top of the remaining days.
 */
export function BillingCard() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [paying, setPaying] = useState(false);

  const load = () =>
    getBillingStatus()
      .then(setStatus)
      .catch(() => {
        /* Non-critical — profile still works without this card. */
      });

  useEffect(() => {
    load();
  }, []);

  if (!status) return null;

  const { access } = status;

  const pay = async () => {
    setPaying(true);
    try {
      const updated = await payForAccess();
      if (updated) {
        toast.success(`Payment successful — access active until ${formatDate(updated.until)}.`);
        await load();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment didn't go through. Try again.");
    } finally {
      setPaying(false);
    }
  };

  let icon = <CheckCircle2 className="h-5 w-5" />;
  let tone = "bg-success-soft text-success";
  let title = "";
  let detail = "";

  if (access.status === "open") {
    title = "All desks are free right now";
    detail = "No subscription needed at the moment.";
  } else if (access.status === "free_all") {
    icon = <Gift className="h-5 w-5" />;
    tone = "bg-special-soft text-special";
    title = "Free access to all desks";
    detail = "The JoinDesk team has given you free access. Enjoy!";
  } else if (access.status === "paid") {
    title = `Access active until ${formatDate(access.until)}`;
    detail = `${access.daysLeft} day${access.daysLeft === 1 ? "" : "s"} left · Special desks unlocked.`;
  } else if (access.status === "scheduled") {
    icon = <CalendarClock className="h-5 w-5" />;
    tone = "bg-info-soft text-info";
    title = `Subscription starts on ${formatDate(access.until)}`;
    detail = "You can join Special desks from that date.";
  } else if (access.status === "trial") {
    icon = <Sparkles className="h-5 w-5" />;
    tone = "bg-info-soft text-info";
    title = `Free trial until ${formatDate(access.until)}`;
    detail = "Try every desk free. After the trial, one payment unlocks everything.";
  } else if (access.status === "free_desks") {
    icon = <Gift className="h-5 w-5" />;
    tone = "bg-special-soft text-special";
    title = `Free access to ${access.freeDeskIds.length} desk${access.freeDeskIds.length === 1 ? "" : "s"}`;
    detail = "Other Special desks need a subscription.";
  } else {
    icon = <CreditCard className="h-5 w-5" />;
    tone = "bg-destructive/10 text-destructive";
    title = "No active subscription";
    detail = status.message?.trim()
      ? `Special desks need a subscription (₹${status.priceInr}). ${status.message.trim()}`
      : `Special desks need a subscription (₹${status.priceInr}). All other desks are free.`;
  }

  const showPay = status.enabled && status.configured && access.status !== "free_all";

  return (
    <div className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className={"grid h-10 w-10 shrink-0 place-items-center rounded-2xl " + tone}>
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
          </div>
        </div>
        {showPay && (
          <button
            onClick={pay}
            disabled={paying}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-60"
          >
            {paying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            {access.status === "paid"
              ? `Renew · ₹${status.priceInr} for ${status.days} days`
              : `Pay ₹${status.priceInr} · ${status.days} days`}
          </button>
        )}
      </div>

      {(status.manualSubs?.length ?? 0) > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Receipt className="h-3.5 w-3.5" /> My subscriptions
          </p>
          <ul className="mt-2 space-y-1">
            {status.manualSubs!.map((m) => (
              <li key={m.id} className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span>{m.amount_inr != null ? `₹${m.amount_inr}` : "Subscription"}</span>
                <span>
                  {formatDate(m.starts_at)} → {formatDate(new Date(Date.parse(m.ends_at) - 1).toISOString())}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {status.payments.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Receipt className="h-3.5 w-3.5" /> Recent payments
          </p>
          <ul className="mt-2 space-y-1">
            {status.payments.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"
              >
                <span>
                  ₹{Math.round(p.amount_paise / 100)} · paid {formatDate(p.paid_at)}
                </span>
                <span>
                  {formatDate(p.starts_at)} → {formatDate(p.expires_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
