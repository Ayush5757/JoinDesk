import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { adminApi } from "@/lib/adminApi";

/** One popular study window. Both times are 24-hour "HH:MM" in India time (IST). */
export type TimingRange = { start: string; end: string };

export type SpecialTimings = {
  /** Shown on every Special desk. */
  all: TimingRange[];
  /** Optional: replaces `all` for one specific desk. */
  byDesk: Record<string, TimingRange[]>;
};

const EMPTY: SpecialTimings = { all: [], byDesk: {} };

let cache: SpecialTimings | null = null;
let inflight: Promise<SpecialTimings> | null = null;
const listeners = new Set<(t: SpecialTimings) => void>();

/** Loads the timings once and shares them. Never throws: on any problem it behaves as "no timings". */
export function fetchSpecialTimings(force = false): Promise<SpecialTimings> {
  if (cache && !force) return Promise.resolve(cache);
  if (inflight && !force) return inflight;
  inflight = api
    .getQuiet<SpecialTimings>("/api/special-timings")
    .catch(() => EMPTY)
    .then((t) => {
      cache = t;
      inflight = null;
      listeners.forEach((fn) => fn(t));
      return t;
    });
  return inflight;
}

export const refreshSpecialTimings = () => fetchSpecialTimings(true);

export function useSpecialTimings() {
  const [timings, setTimings] = useState<SpecialTimings | null>(cache);
  useEffect(() => {
    listeners.add(setTimings);
    void fetchSpecialTimings().then(setTimings);
    return () => {
      listeners.delete(setTimings);
    };
  }, []);
  return timings;
}

/** A desk's own timings if the admin set any, otherwise the common ones. Empty list = show nothing. */
export function timingsForDesk(t: SpecialTimings | null, deskId: string): TimingRange[] {
  if (!t) return [];
  const own = t.byDesk[deskId];
  return own && own.length ? own : t.all;
}

// ---------------------------------------------------------------- showing times to people
const IST_OFFSET_MIN = 330; // India time is UTC+5:30 all year (no daylight saving)

/** "06:00" in India time -> "6:00 AM" in the viewer's own time zone. */
function toLocal(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const now = new Date();
  const utc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m) - IST_OFFSET_MIN * 60_000;
  return new Date(utc).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

/** "6:00 AM – 9:00 AM" in the viewer's local time. */
export const formatRange = (r: TimingRange) => `${toLocal(r.start)} – ${toLocal(r.end)}`;

// ---------------------------------------------------------------- admin
export const adminGetTimings = () => adminApi.get<SpecialTimings>("/api/admin/special-timings");
export const adminSaveTimings = (body: SpecialTimings) =>
  adminApi.put<SpecialTimings>("/api/admin/special-timings", body);
