import { supabaseAdmin } from "../config/supabase.js";
import { getBillingConfig } from "../config/billing.js";

const PAGE = 1000; // Supabase returns max 1000 rows per request
const DAY_MS = 24 * 60 * 60 * 1000;

const tzMin = () => getBillingConfig().tzOffsetMinutes;

// =========================
// Time helpers (everything is bucketed in the configured timezone, IST by default)
// =========================

/** "2026-10-03T09:05:00Z" -> { date: "2026-10-03", hour: 14 } in local (IST) time. */
export function localParts(iso, offsetMin = tzMin()) {
  const d = new Date(Date.parse(iso) + offsetMin * 60000);
  return { date: d.toISOString().slice(0, 10), hour: d.getUTCHours() };
}

export function currentMonthStr(now = Date.now(), offsetMin = tzMin()) {
  return new Date(now + offsetMin * 60000).toISOString().slice(0, 7);
}

/** "2026-10" -> start/end instants of that month in the local timezone. Falls back to this month. */
export function parseMonth(input, now = Date.now(), offsetMin = tzMin()) {
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(input || "") ? input : currentMonthStr(now, offsetMin);
  const [y, m] = month.split("-").map(Number);
  return {
    month,
    startMs: Date.UTC(y, m - 1, 1) - offsetMin * 60000,
    endMs: Date.UTC(y, m, 1) - offsetMin * 60000,
    days: new Date(Date.UTC(y, m, 0)).getUTCDate(),
  };
}

// =========================
// Fetching (paginated: a busy desk easily has > 1000 events)
// =========================

async function fetchAllPages(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await buildQuery().range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function fetchDeskEvents(deskId) {
  return fetchAllPages(() =>
    supabaseAdmin
      .from("desk_join_events")
      .select("user_id, joined_at, access_type")
      .eq("desk_id", deskId)
      .order("joined_at", { ascending: true })
      .order("id", { ascending: true })
  );
}

// ---- Fallback: the older desk_joins table (one row per person+desk).
// Anyone in there who has no logged events still shows up (as one visit at
// their join time), so the analytics list always matches "People who joined".
export function fetchDeskJoinRows(deskId) {
  return fetchAllPages(() =>
    supabaseAdmin
      .from("desk_joins")
      .select("user_id, joined_at")
      .eq("desk_id", deskId)
      .order("joined_at", { ascending: true })
      .order("user_id", { ascending: true })
  );
}

export function fetchUserJoinRows(userId) {
  return fetchAllPages(() =>
    supabaseAdmin
      .from("desk_joins")
      .select("desk_id, joined_at")
      .eq("user_id", userId)
      .order("joined_at", { ascending: true })
      .order("desk_id", { ascending: true })
  );
}

/** Adds one synthetic visit for every person in desk_joins who has no events yet. */
export function mergeDeskJoins(events, joinRows) {
  const seen = new Set(events.map((e) => e.user_id));
  const extra = joinRows
    .filter((j) => !seen.has(j.user_id))
    .map((j) => ({ user_id: j.user_id, joined_at: j.joined_at, access_type: "legacy" }));
  return extra.length
    ? [...events, ...extra].sort((a, b) => Date.parse(a.joined_at) - Date.parse(b.joined_at))
    : events;
}

/** Same idea for one person: desks they joined that have no events yet. */
export function mergeUserJoins(events, joinRows) {
  const seen = new Set(events.map((e) => e.desk_id));
  const extra = joinRows
    .filter((j) => !seen.has(j.desk_id))
    .map((j) => ({ desk_id: j.desk_id, joined_at: j.joined_at, access_type: "legacy" }));
  return extra.length
    ? [...events, ...extra].sort((a, b) => Date.parse(a.joined_at) - Date.parse(b.joined_at))
    : events;
}

export function fetchUserEvents(userId) {
  return fetchAllPages(() =>
    supabaseAdmin
      .from("desk_join_events")
      .select("desk_id, joined_at, access_type")
      .eq("user_id", userId)
      .order("joined_at", { ascending: true })
      .order("id", { ascending: true })
  );
}

/** Events since `sinceIso` for a set of users (used for "visits in last 30 days"). */
export async function fetchRecentEventsForUsers(userIds, sinceIso) {
  const out = [];
  for (const ids of chunk([...new Set(userIds)], 100)) {
    const rows = await fetchAllPages(() =>
      supabaseAdmin
        .from("desk_join_events")
        .select("user_id, desk_id, joined_at")
        .in("user_id", ids)
        .gte("joined_at", sinceIso)
        .order("joined_at", { ascending: true })
        .order("id", { ascending: true })
    );
    out.push(...rows);
  }
  return out;
}

export async function fetchUsersByIds(ids) {
  const out = [];
  for (const part of chunk([...new Set(ids)], 150)) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, name, email, avatar_url, created_at, total_joins, last_join_at, is_blocked")
      .in("id", part);
    if (error) throw error;
    out.push(...data);
  }
  return out;
}

// =========================
// Pure report builders (no DB access -> easy to test)
// =========================

/**
 * What the admin needs for ONE desk and ONE month — nothing more:
 * a few totals, the per-day counts (used for the Excel "Daily" sheet), and
 * the people ranked by how often they joined (with first/last join).
 */
export function buildDeskReport({ desk, events, users, freeMap = {}, monthInfo }) {
  const { month, startMs, endMs, days } = monthInfo;
  const daily = Array.from({ length: days }, (_, i) => ({
    date: `${month}-${String(i + 1).padStart(2, "0")}`,
    users: new Set(),
  }));
  const perUser = new Map();

  for (const ev of events) {
    const t = Date.parse(ev.joined_at);
    const { date } = localParts(ev.joined_at);

    let u = perUser.get(ev.user_id);
    if (!u) {
      u = { allDays: new Set(), days: new Set(), firstMs: t, lastMs: t };
      perUser.set(ev.user_id, u);
    }
    // A person counts ONCE per day, however many times they join that day.
    u.allDays.add(date);
    u.firstMs = Math.min(u.firstMs, t);
    u.lastMs = Math.max(u.lastMs, t);

    if (t >= startMs && t < endMs) {
      u.days.add(date);
      const slot = daily[Number(date.slice(8, 10)) - 1];
      if (slot) slot.users.add(ev.user_id);
    }
  }

  const userRows = [];
  for (const row of users) {
    const u = perUser.get(row.id);
    if (!u) continue;
    userRows.push({
      id: row.id,
      name: row.name,
      email: row.email,
      avatar_url: row.avatar_url,
      is_blocked: Boolean(row.is_blocked),
      // Day-wise: number of different DAYS the person joined (not clicks).
      joinsInMonth: u.days.size,
      daysActiveInMonth: u.days.size,
      totalJoins: u.allDays.size,
      firstJoinAt: new Date(u.firstMs).toISOString(),
      lastJoinAt: new Date(u.lastMs).toISOString(),
      freeAccess: freeMap[row.email?.toLowerCase()] || null,
    });
  }
  userRows.sort(
    (a, b) =>
      b.joinsInMonth - a.joinsInMonth ||
      b.totalJoins - a.totalJoins ||
      Date.parse(b.lastJoinAt) - Date.parse(a.lastJoinAt) ||
      (a.name || "").localeCompare(b.name || "")
  );

  // joins per day = number of different people that day
  const dailyOut = daily.map((d) => ({ date: d.date, joins: d.users.size, uniqueUsers: d.users.size }));

  return {
    desk,
    month,
    timezoneOffsetMinutes: tzMin(),
    totals: {
      joinsInMonth: dailyOut.reduce((n, d) => n + d.joins, 0),
      uniqueUsersInMonth: userRows.filter((r) => r.joinsInMonth > 0).length,
      activeDays: dailyOut.filter((d) => d.joins > 0).length,
      allTimeJoins: [...perUser.values()].reduce((n, u) => n + u.allDays.size, 0),
      allTimeUniqueUsers: perUser.size,
    },
    daily: dailyOut,
    users: userRows,
  };
}

/** One person's activity: which desks, how often, which days, plus overall totals. */
export function buildUserActivity({ user, events, desks, monthInfo, now = Date.now() }) {
  const { month, startMs, endMs, days } = monthInfo;
  const deskMap = new Map(desks.map((d) => [d.id, d]));
  const daily = Array.from({ length: days }, (_, i) => ({
    date: `${month}-${String(i + 1).padStart(2, "0")}`,
    joins: 0,
  }));
  const perDesk = new Map();
  const log = [];
  const activeDates = new Set();

  for (const ev of events) {
    const t = Date.parse(ev.joined_at);
    const { date } = localParts(ev.joined_at);

    let d = perDesk.get(ev.desk_id);
    if (!d) perDesk.set(ev.desk_id, (d = { allDays: new Set(), days: new Set(), lastMs: t }));
    d.allDays.add(date); // 1 per day, however many times joined that day
    d.lastMs = Math.max(d.lastMs, t);

    if (t >= startMs && t < endMs) {
      d.days.add(date);
      activeDates.add(date);
      const slot = daily[Number(date.slice(8, 10)) - 1];
      if (slot) slot.joins = 1; // active that day
      log.push({
        joined_at: ev.joined_at,
        deskId: ev.desk_id,
        deskTitle: deskMap.get(ev.desk_id)?.title || "(deleted desk)",
        access_type: ev.access_type || null,
      });
    }
  }

  const perDeskOut = [...perDesk.entries()]
    .map(([deskId, d]) => ({
      deskId,
      title: deskMap.get(deskId)?.title || "(deleted desk)",
      isSpecial: Boolean(deskMap.get(deskId)?.is_special),
      joinsInMonth: d.days.size,
      daysActiveInMonth: d.days.size,
      totalJoins: d.allDays.size,
      lastJoinAt: new Date(d.lastMs).toISOString(),
    }))
    .sort((a, b) => b.joinsInMonth - a.joinsInMonth || b.totalJoins - a.totalJoins);

  const lastMs = events.length ? Date.parse(events[events.length - 1].joined_at) : null;

  return {
    user,
    month,
    totals: {
      joinsInMonth: activeDates.size,
      daysActiveInMonth: activeDates.size,
      desksJoinedInMonth: perDeskOut.filter((d) => d.joinsInMonth > 0).length,
      allTimeJoins: new Set(events.map((e) => `${e.desk_id}|${localParts(e.joined_at).date}`)).size,
      firstJoinAt: events.length ? events[0].joined_at : null,
      lastJoinAt: lastMs ? new Date(lastMs).toISOString() : null,
      daysSinceLast: lastMs ? Math.floor((now - lastMs) / DAY_MS) : null,
    },
    perDesk: perDeskOut,
    daily,
    log: log.reverse().slice(0, 200),
  };
}