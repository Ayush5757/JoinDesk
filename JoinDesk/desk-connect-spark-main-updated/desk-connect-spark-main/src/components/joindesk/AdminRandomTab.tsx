import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  adminBlockUser,
  adminClearRandomReportsAgainst,
  adminListRandomReports,
  adminResolveRandomReport,
  adminUnblockUser,
  type RandomReport,
} from "@/lib/admin";

type Filter = "open" | "actioned" | "dismissed" | "all";

const REASON_LABEL: Record<string, string> = {
  nudity: "Nudity / sexual",
  harassment: "Harassment / hate",
  underage: "Looks under 18",
  spam: "Spam",
  other: "Other",
};

function ago(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
}

/**
 * Reports from Random chat. Block an account here (it's the same account block as
 * the Users list) or dismiss a report. Dismissing stops it counting toward the
 * automatic pause (set by RANDOM_AUTO_RESTRICT_REPORTS in .env).
 */
export function AdminRandomTab() {
  const [filter, setFilter] = useState<Filter>("open");
  const [rows, setRows] = useState<RandomReport[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setRows(null);
    adminListRandomReports(filter)
      .then((r) => setRows(r.reports))
      .catch(() => toast.error("Couldn't load reports."));
  }, [filter]);

  useEffect(load, [load]);

  const act = async (id: string, fn: () => Promise<unknown>, done: string) => {
    setBusyId(id);
    try {
      await fn();
      toast.success(done);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="inline-flex rounded-full border border-border bg-muted/50 p-1">
        {(["open", "actioned", "dismissed", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              "rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition-colors " +
              (filter === f ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground")
            }
          >
            {f}
          </button>
        ))}
      </div>

      {!rows ? (
        <p className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">No reports here. All quiet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => {
            const bad = r.reportedUser;
            const busy = busyId === r.id;
            return (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-semibold text-destructive">
                    {REASON_LABEL[r.reason] ?? r.reason}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{ago(r.created_at)}</span>
                  {r.status !== "open" && (
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold capitalize">{r.status}</span>
                  )}
                  {r.openReportsAgainst >= 2 && (
                    <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600">
                      {r.openReportsAgainst} people reported them
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm">
                  <b>{bad?.name ?? "Unknown"}</b>{" "}
                  <span className="text-muted-foreground">{bad?.email}</span>
                  {bad?.is_blocked && <span className="ml-2 text-xs font-semibold text-destructive">Blocked</span>}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Reported by {r.reporterUser?.name ?? "Unknown"} ({r.reporterUser?.email})
                </p>
                {r.details && <p className="mt-2 rounded-xl bg-muted/50 p-2.5 text-xs">{r.details}</p>}

                <div className="mt-3 flex flex-wrap gap-2">
                  {bad && !bad.is_blocked && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        act(
                          r.id,
                          async () => {
                            await adminBlockUser(bad.id);
                            await adminResolveRandomReport(r.id, "actioned");
                          },
                          "Account blocked.",
                        )
                      }
                      className="rounded-full bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      Block account
                    </button>
                  )}
                  {bad?.is_blocked && (
                    <button
                      disabled={busy}
                      onClick={() => act(r.id, () => adminUnblockUser(bad.id), "Account unblocked.")}
                      className="rounded-full border border-border px-4 py-2 text-xs font-semibold transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      Unblock
                    </button>
                  )}
                  {r.status === "open" && (
                    <>
                      <button
                        disabled={busy}
                        onClick={() => act(r.id, () => adminResolveRandomReport(r.id, "dismissed"), "Dismissed.")}
                        className="rounded-full border border-border px-4 py-2 text-xs font-semibold transition-colors hover:bg-muted disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                      {bad && r.openReportsAgainst > 1 && (
                        <button
                          disabled={busy}
                          onClick={() => act(r.id, () => adminClearRandomReportsAgainst(bad.id), "All their open reports cleared.")}
                          className="rounded-full px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                        >
                          Clear all reports on them
                        </button>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
