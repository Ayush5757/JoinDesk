import { useEffect, useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { adminGetPaymentSettings, adminSavePaymentSettings, type PaymentSettings } from "@/lib/admin";
import { fmtDay, todayIst } from "./adminShared";

const FEATURES: { key: keyof PaymentSettings["features"]; label: string }[] = [
  { key: "normalDesks", label: "Normal desks" },
  { key: "specialDesks", label: "Special desks" },
  { key: "randomChat", label: "Random chat" },
];

/**
 * One switch decides if the website is free or paid:
 *  - OFF: everything is free for everyone, no matter how old their account is.
 *  - ON: accounts newer than the "free days" below can use everything free;
 *    everybody else needs a subscription (you add their dates from the Users tab).
 * The advanced part lets you pick which features are paid and set a last free day.
 */
export function AdminPaymentSettings() {
  const [s, setS] = useState<PaymentSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminGetPaymentSettings()
      .then(setS)
      .catch(() => toast.error("Couldn't load payment settings."));
  }, []);

  const save = async () => {
    if (!s) return;
    setSaving(true);
    try {
      setS(await adminSavePaymentSettings(s));
      toast.success("Payment settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const status = (() => {
    if (!s) return "";
    if (!s.paid) return "Everything is FREE for everyone.";
    if (s.freeUntil && s.freeUntil >= todayIst()) {
      return `Free for everyone until ${fmtDay(s.freeUntil + "T00:00:00+05:30")}. After that: new accounts get ${s.trialDays} free day${s.trialDays === 1 ? "" : "s"}, everybody else pays.`;
    }
    return `PAID. New accounts get ${s.trialDays} free day${s.trialDays === 1 ? "" : "s"}, everybody else needs a subscription.`;
  })();

  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-soft">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <Wallet className="h-4 w-4" /> Free or paid
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        One switch for the whole website: desks (normal and special) and Random chat. Add a person's paid dates from
        the <b>Users</b> tab (click the person → Subscription).
      </p>

      {!s ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <button onClick={() => setS({ ...s, paid: !s.paid })} className="flex items-center gap-3 text-left">
            <span
              className={
                "relative h-7 w-12 shrink-0 rounded-full transition-colors " +
                (s.paid ? "bg-emerald-500" : "bg-muted-foreground/30")
              }
            >
              <span
                className={
                  "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all " +
                  (s.paid ? "left-[22px]" : "left-0.5")
                }
              />
            </span>
            <span className="text-sm font-semibold">{s.paid ? "Paid is ON" : "Everything is free (paid is OFF)"}</span>
          </button>

          <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs font-medium">{status}</p>

          <div>
            <p className="text-[11px] font-semibold text-muted-foreground">
              Free days for new accounts (counted from the day they sign up)
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {[0, 1, 3, 5, 7].map((n) => (
                <button
                  key={n}
                  onClick={() => setS({ ...s, trialDays: n })}
                  className={
                    "h-9 min-w-[2.5rem] rounded-full border px-3 text-xs font-semibold transition-colors " +
                    (s.trialDays === n ? "border-transparent bg-foreground text-background" : "border-border hover:bg-muted")
                  }
                >
                  {n}
                </button>
              ))}
              <input
                type="number"
                min={0}
                max={365}
                value={s.trialDays}
                onChange={(e) => setS({ ...s, trialDays: Math.max(0, Math.min(365, Math.round(Number(e.target.value) || 0))) })}
                className="w-20 rounded-full border border-border bg-card px-3 py-1.5 text-xs"
              />
              <span className="text-xs text-muted-foreground">days</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="block text-[11px] font-semibold text-muted-foreground">
              Amount to show (₹)
              <input
                type="number"
                min={0}
                value={s.amountInr}
                onChange={(e) => setS({ ...s, amountInr: Math.max(0, Number(e.target.value) || 0) })}
                className="mt-1 block w-36 rounded-full border border-border bg-card px-4 py-2 text-sm font-normal text-foreground"
              />
            </label>
          </div>

          <label className="block text-[11px] font-semibold text-muted-foreground">
            How to pay (shown to people who need a subscription)
            <textarea
              value={s.message}
              onChange={(e) => setS({ ...s, message: e.target.value })}
              rows={4}
              maxLength={1000}
              placeholder={
                "Pay on PhonePe / UPI: yourname@ybl (9876543210)\nThen send the screenshot to us on WhatsApp / Instagram with your email."
              }
              className="mt-1 block w-full resize-none rounded-2xl border border-border bg-muted/40 p-3 text-sm font-normal text-foreground outline-none focus:border-primary/50 focus:bg-card"
            />
          </label>

          <details className="rounded-xl border border-border px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Advanced</summary>
            <div className="mt-3 space-y-4">
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground">What is paid when Paid is ON</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {FEATURES.map((f) => (
                    <label key={f.key} className="flex items-center gap-2 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={s.features[f.key]}
                        onChange={(e) => setS({ ...s, features: { ...s.features, [f.key]: e.target.checked } })}
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
              <label className="block text-[11px] font-semibold text-muted-foreground">
                Everyone free until (optional, last free day)
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="date"
                    value={s.freeUntil ?? ""}
                    onChange={(e) => setS({ ...s, freeUntil: e.target.value || null })}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-normal text-foreground"
                  />
                  {s.freeUntil && (
                    <button onClick={() => setS({ ...s, freeUntil: null })} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
                      Clear
                    </button>
                  )}
                </div>
              </label>
            </div>
          </details>

          <button
            onClick={save}
            disabled={saving}
            className="rounded-full bg-foreground px-5 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </section>
  );
}
