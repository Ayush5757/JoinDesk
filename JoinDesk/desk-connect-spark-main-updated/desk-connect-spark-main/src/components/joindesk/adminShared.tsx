import { useEffect, useState } from "react";
import type { AccessSummary } from "@/lib/billing";
import { adminListDesks } from "@/lib/admin";

// Small helpers shared by the admin screens (analytics, access, user details).

const IST = { timeZone: "Asia/Kolkata" } as const;

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    ...IST,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function fmtDay(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    ...IST,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/** "YYYY-MM" for right now, in India time (matches the backend's bucketing). */
export function currentMonth() {
  return new Date(Date.now() + 330 * 60000).toISOString().slice(0, 7);
}

/** "YYYY-MM-DD" for today in India time (for <input type="date">). */
export function todayIst() {
  return new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" + n days. */
export function addDaysStr(dateStr: string, n: number) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole days between two "YYYY-MM-DD" dates, both included. */
export function inclusiveDays(start: string, end: string) {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Saves a downloaded Blob (e.g. the Excel export) to the user's computer. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFileName(name: string) {
  return (
    name
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "desk"
  );
}

export const ACCESS_TYPE_LABEL: Record<string, string> = {
  paid: "Paid",
  trial: "Free trial",
  free_all: "Free (all desks)",
  free_desk: "Free (this desk)",
  open: "Open",
  owner: "Desk owner",
  legacy: "Before tracking",
};

/** A plain row of big numbers with small labels — no cards, no charts. */
export function NumberRow({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <div className="flex flex-wrap gap-x-10 gap-y-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-soft">
      {items.map((it) => (
        <div key={it.label}>
          <p className="text-2xl font-bold leading-none tracking-tight">{it.value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{it.label}</p>
        </div>
      ))}
    </div>
  );
}

/** One-line access status chip for a user (paid till…, trial, free, expired). */
export function AccessBadge({ access }: { access: AccessSummary }) {
  let label = "";
  let cls = "bg-muted text-muted-foreground";
  switch (access.status) {
    case "paid":
      label = `Paid · till ${fmtDay(access.until)}`;
      cls = "bg-emerald-500/10 text-emerald-600";
      break;
    case "scheduled":
      label = `Starts ${fmtDay(access.until)}`;
      cls = "bg-info-soft text-info";
      break;
    case "trial":
      label = `Trial · till ${fmtDay(access.until)}`;
      cls = "bg-info-soft text-info";
      break;
    case "free_all":
      label = "Free · all desks";
      cls = "bg-special-soft text-special";
      break;
    case "free_desks":
      label = `Free · ${access.freeDeskIds.length} desk${access.freeDeskIds.length === 1 ? "" : "s"}`;
      cls = "bg-special-soft text-special";
      break;
    case "open":
      label = "Paywall off";
      break;
    default:
      label = "Expired · must pay";
      cls = "bg-destructive/10 text-destructive";
  }
  return (
    <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold " + cls}>{label}</span>
  );
}

export type DeskOption = { id: string; title: string; isSpecial: boolean };

/** Desks for the admin dropdowns (Special first, then regular). */
export function useAdminDeskOptions() {
  const [options, setOptions] = useState<DeskOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    adminListDesks({ limit: 100, offset: 0 })
      .then(({ desks }) => {
        if (cancelled) return;
        const mapped = desks.map((d) => ({ id: d.id, title: d.title, isSpecial: d.isSpecial }));
        mapped.sort((a, b) => Number(b.isSpecial) - Number(a.isSpecial));
        setOptions(mapped);
      })
      .catch(() => {
        /* dropdowns just stay empty */
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return { options, loading };
}
