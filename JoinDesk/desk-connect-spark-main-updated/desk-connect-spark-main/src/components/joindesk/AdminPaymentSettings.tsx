import { useEffect, useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { adminGetPaymentSettings, adminSavePaymentSettings } from "@/lib/admin";

/**
 * The paywall switch + what people see when they need to pay for a Special
 * desk: the amount and a free-text "how to pay" message (UPI id, PhonePe
 * number, "send screenshot on WhatsApp …"). Normal desks are always free.
 */
export function AdminPaymentSettings() {
  const [enabled, setEnabled] = useState(false);
  const [amount, setAmount] = useState("149");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminGetPaymentSettings()
      .then((s) => {
        setEnabled(s.enabled);
        setAmount(String(s.amountInr));
        setMessage(s.message);
      })
      .catch(() => toast.error("Couldn't load payment settings."))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await adminSavePaymentSettings({
        enabled,
        amountInr: Number(amount) || 0,
        message,
      });
      toast.success("Payment settings saved.");
    } catch {
      toast.error("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-soft">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <Wallet className="h-4 w-4" /> Special desk payment
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Only Special desks need a subscription — every other desk stays free. Add a person's dates
        from the <b>Users</b> tab (click the person → Subscription).
      </p>

      {loading ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <button
            onClick={() => setEnabled((v) => !v)}
            className="flex items-center gap-3 text-left"
          >
            <span
              className={
                "relative h-6 w-11 shrink-0 rounded-full transition-colors " +
                (enabled ? "bg-emerald-500" : "bg-muted-foreground/30")
              }
            >
              <span
                className={
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all " +
                  (enabled ? "left-[22px]" : "left-0.5")
                }
              />
            </span>
            <span className="text-xs font-semibold">
              {enabled
                ? "Payment ON — Special desks need an active subscription"
                : "Payment OFF — everyone can join every desk"}
            </span>
          </button>

          <label className="block text-[11px] font-semibold text-muted-foreground">
            Amount to show (₹)
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 block w-40 rounded-full border border-border bg-card px-4 py-2 text-sm font-normal text-foreground"
            />
          </label>

          <label className="block text-[11px] font-semibold text-muted-foreground">
            How to pay (shown to people without access)
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder={
                "Pay on PhonePe / UPI: yourname@ybl (9876543210)\nThen send the screenshot to us on WhatsApp / Instagram with your email."
              }
              className="mt-1 block w-full resize-none rounded-2xl border border-border bg-muted/40 p-3 text-sm font-normal text-foreground outline-none focus:border-primary/50 focus:bg-card"
            />
          </label>

          <button
            onClick={save}
            disabled={saving}
            className="rounded-full bg-foreground px-5 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save payment settings"}
          </button>
        </div>
      )}
    </section>
  );
}
