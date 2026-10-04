import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Gift, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "./Modal";
import {
  AccessBadge,
  NumberRow,
  ACCESS_TYPE_LABEL,
  currentMonth,
  fmtDateTime,
  fmtDay,
  timeAgo,
  useAdminDeskOptions,
} from "./adminShared";
import {
  adminCreateGrant,
  adminDeleteGrant,
  adminUserActivity,
  type UserActivity,
} from "@/lib/admin";

/**
 * Everything about one person: which desks they visit, how often and on
 * which days (any month), their access (paid / trial / free), payments —
 * and the buttons to give or take back free access.
 */
export function AdminUserDetailModal({
  userId,
  onClose,
  onChanged,
}: {
  userId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<UserActivity | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deskPick, setDeskPick] = useState("");
  const { options: deskOptions } = useAdminDeskOptions();

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      setData(await adminUserActivity(userId, month));
    } catch {
      toast.error("Couldn't load this user's activity.");
    } finally {
      setLoading(false);
    }
  }, [userId, month]);

  useEffect(() => {
    if (userId) {
      setData(null);
      load();
    }
  }, [userId, load]);

  if (!userId) return null;

  const hasAll = data?.grants.some((g) => g.scope === "all") ?? false;

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(okMsg);
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't go through.");
    } finally {
      setBusy(false);
    }
  };

  const giveAll = () =>
    data &&
    run(
      () => adminCreateGrant({ email: data.user.email, scope: "all" }),
      "Free access to all desks given.",
    );

  const giveDesk = () =>
    data &&
    deskPick &&
    run(async () => {
      await adminCreateGrant({ email: data.user.email, scope: "desk", deskId: deskPick });
      setDeskPick("");
    }, "Free access to that desk given.");

  const removeGrant = (id: string) => run(() => adminDeleteGrant(id), "Free access removed.");

  const hasFree = (data?.grants.length ?? 0) > 0;
  const unusedFree =
    data &&
    hasFree &&
    data.totals.joinsInMonth === 0 &&
    (data.totals.daysSinceLast === null || data.totals.daysSinceLast >= 30);

  return (
    <Modal open onClose={onClose} wide>
      {!data ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3 pr-8">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
              {data.user.avatar_url && (
                <img src={data.user.avatar_url} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{data.user.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {data.user.email} · joined {fmtDay(data.user.created_at)}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <AccessBadge access={data.access} />
                {data.user.is_blocked && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                    Blocked
                  </span>
                )}
                {data.totals.allTimeJoins === 0 && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    Never joined any desk
                  </span>
                )}
              </div>
            </div>
          </div>

          {unusedFree && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                This person has free access but hasn't joined anything in{" "}
                {data.totals.daysSinceLast === null
                  ? "their whole time here"
                  : `${data.totals.daysSinceLast} days`}
                . You may want to remove it so they pay if they come back.
              </span>
            </div>
          )}

          {/* Access */}
          <section className="rounded-2xl border border-border p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Gift className="h-4 w-4" /> Free access
            </h3>

            {data.grants.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                No free access given. They use the trial / paid plan like everyone else.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.grants.map((g) => (
                  <li
                    key={g.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {g.scope === "all" ? "All desks" : g.deskTitle}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Since {fmtDay(g.granted_at)}
                        {g.note ? ` · ${g.note}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => removeGrant(g.id)}
                      disabled={busy}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {!hasAll && (
                <button
                  onClick={giveAll}
                  disabled={busy}
                  className="rounded-full bg-brand-gradient px-4 py-2 text-xs font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
                >
                  Give free access · all desks
                </button>
              )}
              <select
                value={deskPick}
                onChange={(e) => setDeskPick(e.target.value)}
                className="min-w-0 max-w-[14rem] rounded-full border border-border bg-card px-3 py-2 text-xs"
              >
                <option value="">One desk only…</option>
                {deskOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.isSpecial ? "★ " : ""}
                    {d.title}
                  </option>
                ))}
              </select>
              <button
                onClick={giveDesk}
                disabled={busy || !deskPick}
                className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold transition-colors hover:bg-muted disabled:opacity-50"
              >
                Give this desk free
              </button>
            </div>

            {data.payments.length > 0 && (
              <div className="mt-4 border-t border-border pt-3">
                <p className="text-xs font-semibold text-muted-foreground">Payments</p>
                <ul className="mt-1 space-y-1">
                  {data.payments.map((p, i) => (
                    <li
                      key={i}
                      className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"
                    >
                      <span>
                        ₹{Math.round(p.amount_paise / 100)} · {fmtDay(p.paid_at)}
                      </span>
                      <span>
                        {fmtDay(p.starts_at)} → {fmtDay(p.expires_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Activity */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold">Activity</h3>
              <input
                type="month"
                value={month}
                max={currentMonth()}
                onChange={(e) => e.target.value && setMonth(e.target.value)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs"
              />
            </div>

            <div className={"mt-3 " + (loading ? "opacity-50" : "")}>
              <NumberRow
                items={[
                  { label: "Joins this month", value: data.totals.joinsInMonth },
                  { label: "Days active", value: data.totals.daysActiveInMonth },
                  { label: "Joins all-time", value: data.totals.allTimeJoins },
                  { label: "Last join", value: timeAgo(data.totals.lastJoinAt) },
                ]}
              />
            </div>

            <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[34rem] text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Desk</th>
                    <th className="px-3 py-2 font-semibold">This month</th>
                    <th className="px-3 py-2 font-semibold">Days</th>
                    <th className="px-3 py-2 font-semibold">All-time</th>
                    <th className="px-3 py-2 font-semibold">Last join</th>
                  </tr>
                </thead>
                <tbody>
                  {data.perDesk.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-muted-foreground">
                        Hasn't joined any desk yet.
                      </td>
                    </tr>
                  ) : (
                    data.perDesk.map((d) => (
                      <tr key={d.deskId} className="border-t border-border">
                        <td className="px-3 py-2 font-medium">
                          {d.isSpecial && <span className="mr-1 text-special">★</span>}
                          {d.title}
                        </td>
                        <td className="px-3 py-2">{d.joinsInMonth}</td>
                        <td className="px-3 py-2">{d.daysActiveInMonth}</td>
                        <td className="px-3 py-2">{d.totalJoins}</td>
                        <td className="px-3 py-2">{timeAgo(d.lastJoinAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {data.log.length > 0 && (
              <div className="mt-4 max-h-56 overflow-y-auto rounded-2xl border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-muted/90 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-semibold">When</th>
                      <th className="px-3 py-2 font-semibold">Desk</th>
                      <th className="px-3 py-2 font-semibold">Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.log.map((l, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="whitespace-nowrap px-3 py-1.5">
                          {fmtDateTime(l.joined_at)}
                        </td>
                        <td className="px-3 py-1.5">{l.deskTitle}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {ACCESS_TYPE_LABEL[l.access_type ?? ""] ?? l.access_type ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
