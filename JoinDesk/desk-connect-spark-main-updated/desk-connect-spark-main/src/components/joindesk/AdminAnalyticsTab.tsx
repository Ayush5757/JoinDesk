import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AdminUserDetailModal } from "./AdminUserDetailModal";
import {
  NumberRow,
  currentMonth,
  fmtDateTime,
  fmtDay,
  safeFileName,
  saveBlob,
  useAdminDeskOptions,
} from "./adminShared";
import { adminDeskAnalytics, adminDownloadDeskExport, type DeskReport } from "@/lib/admin";

type SortKey = "month" | "total" | "last";

/**
 * Pick a desk and a month → a few numbers and one table of everyone who
 * joined (click a column title to sort; click a person for their details).
 * "Download Excel" has the full join-by-join log.
 */
export function AdminAnalyticsTab() {
  const { options, loading: loadingDesks } = useAdminDeskOptions();
  const [deskId, setDeskId] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [report, setReport] = useState<DeskReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("month");
  const [desc, setDesc] = useState(true);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  // Start on the first desk (a Special one if there is any).
  useEffect(() => {
    if (!deskId && options.length > 0) setDeskId(options[0]!.id);
  }, [options, deskId]);

  const load = (silent = false) => {
    if (!deskId) return () => {};
    let cancelled = false;
    if (!silent) setLoading(true);
    adminDeskAnalytics(deskId, month)
      .then((r) => !cancelled && setReport(r))
      .catch(() => !cancelled && toast.error("Couldn't load analytics for this desk."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  };

  useEffect(() => load(), [deskId, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const users = useMemo(() => {
    if (!report) return [];
    const value = (u: DeskReport["users"][number]) =>
      sortKey === "last"
        ? Date.parse(u.lastJoinAt)
        : sortKey === "total"
          ? u.totalJoins
          : u.daysActiveInMonth * 1e6 + u.totalJoins;
    const rows = [...report.users].sort((a, b) => value(b) - value(a));
    return desc ? rows : rows.reverse();
  }, [report, sortKey, desc]);

  const sortBy = (key: SortKey) => {
    if (key === sortKey) setDesc((d) => !d);
    else {
      setSortKey(key);
      setDesc(true);
    }
  };

  const download = async () => {
    if (!report) return;
    setExporting(true);
    try {
      const blob = await adminDownloadDeskExport(report.desk.id, month);
      saveBlob(blob, `${safeFileName(report.desk.title)}-${month}.xlsx`);
      toast.success("Excel downloaded.");
    } catch {
      toast.error("Couldn't download the Excel file.");
    } finally {
      setExporting(false);
    }
  };

  const Th = ({ label, k }: { label: string; k?: SortKey }) => (
    <th className="px-3 py-2 font-semibold">
      {k ? (
        <button
          onClick={() => sortBy(k)}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          {label}
          {sortKey === k &&
            (desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
        </button>
      ) : (
        label
      )}
    </th>
  );

  const t = report?.totals;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="text-xs font-semibold text-muted-foreground">Desk</label>
          <select
            value={deskId}
            onChange={(e) => setDeskId(e.target.value)}
            className="mt-1 block w-full rounded-full border border-border bg-card px-4 py-2.5 text-sm"
          >
            {loadingDesks && <option>Loading desks…</option>}
            {options.map((d) => (
              <option key={d.id} value={d.id}>
                {d.isSpecial ? "★ " : ""}
                {d.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Month</label>
          <input
            type="month"
            value={month}
            max={currentMonth()}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="mt-1 block rounded-full border border-border bg-card px-4 py-2.5 text-sm"
          />
        </div>
        <button
          onClick={download}
          disabled={!report || exporting}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Excel
        </button>
      </div>

      {!report ? (
        <p className="mt-6 text-sm text-muted-foreground">
          {loading ? "Loading…" : options.length === 0 && !loadingDesks ? "No desks yet." : ""}
        </p>
      ) : (
        <div className={"mt-5 space-y-5 " + (loading ? "opacity-50" : "")}>
          <NumberRow
            items={[
              { label: "Joins this month", value: t!.joinsInMonth },
              { label: "People this month", value: t!.uniqueUsersInMonth },
              { label: "Days active", value: t!.activeDays },
              { label: "Joins all-time", value: t!.allTimeJoins },
              { label: "People all-time", value: t!.allTimeUniqueUsers },
            ]}
          />

          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[40rem] text-left text-xs">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <Th label="#" />
                  <Th label="Person" />
                  <Th label="Days this month" k="month" />
                  <Th label="Total days" k="total" />
                  <Th label="First join" />
                  <Th label="Last join" k="last" />
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                      Nobody has joined this desk yet.
                    </td>
                  </tr>
                ) : (
                  users.map((u, i) => (
                    <tr
                      key={u.id}
                      onClick={() => setDetailUserId(u.id)}
                      className="cursor-pointer border-t border-border hover:bg-muted/40"
                    >
                      <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2">
                        <p className="font-semibold">
                          {u.name}
                          {u.freeAccess && (
                            <span className="ml-1.5 rounded-full bg-special-soft px-1.5 py-0.5 text-[9px] font-semibold text-special">
                              FREE
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="px-3 py-2 font-semibold">{u.daysActiveInMonth}</td>
                      <td className="px-3 py-2">{u.totalJoins}</td>
                      <td className="whitespace-nowrap px-3 py-2">{fmtDay(u.firstJoinAt)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{fmtDateTime(u.lastJoinAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AdminUserDetailModal
        userId={detailUserId}
        onClose={() => setDetailUserId(null)}
        onChanged={() => load(true)}
      />
    </div>
  );
}