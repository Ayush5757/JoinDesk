import { supabaseAdmin } from "../config/supabase.js";
import { getBillingConfig } from "../config/billing.js";
import {
  summarizeAccess,
  loadPaymentSettings,
  loadManualSubs,
  loadManualSubsForUsers,
} from "../services/access.js";
import {
  parseMonth,
  fetchDeskEvents,
  fetchDeskJoinRows,
  fetchUserEvents,
  fetchUserJoinRows,
  mergeDeskJoins,
  mergeUserJoins,
  fetchRecentEventsForUsers,
  fetchUsersByIds,
  buildDeskReport,
  buildUserActivity,
} from "../services/analytics.js";
import { deskReportToWorkbook, usersToWorkbook } from "../services/excel.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cleanSearch = (v) =>
  typeof v === "string" ? v.trim().replace(/[%,()]/g, "") : "";

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/** email (lowercase) -> grants[] for a list of emails. */
async function loadGrantsByEmail(emails) {
  const map = new Map();
  const lower = [...new Set(emails.filter(Boolean).map((e) => e.toLowerCase()))];
  for (const part of chunk(lower, 150)) {
    const { data, error } = await supabaseAdmin
      .from("access_grants")
      .select("id, email, scope, desk_id, note, granted_at")
      .in("email", part);
    if (error) throw error;
    for (const g of data) {
      if (!map.has(g.email)) map.set(g.email, []);
      map.get(g.email).push(g);
    }
  }
  return map;
}

// =========================
// Users list (with activity + access status)
// =========================

const USER_COLUMNS =
  "id, name, email, avatar_url, is_blocked, created_at, total_joins, last_join_at, trial_started_at, subscription_expires_at";

/**
 * Builds the filtered/sorted users query.
 * sort:   newest (default) | most | least | recent
 * filter: all (default) | never (0 joins ever = "dead") | inactive (no join in
 *         INACTIVE_DAYS) | paid | blocked
 */
function usersQuery({ search, sort, filter, paidIds = [] }) {
  const cfg = getBillingConfig();
  return () => {
    let q = supabaseAdmin.from("users").select(USER_COLUMNS, { count: "exact" });

    if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%`);

    if (filter === "never") q = q.eq("total_joins", 0);
    else if (filter === "inactive") {
      const cutoff = new Date(Date.now() - cfg.inactiveDays * DAY_MS).toISOString();
      q = q.or(`last_join_at.is.null,last_join_at.lt.${cutoff}`);
    } else if (filter === "paid") {
      const nowIso = new Date().toISOString();
      q = paidIds.length
        ? q.or(`subscription_expires_at.gt.${nowIso},id.in.(${paidIds.join(",")})`)
        : q.gt("subscription_expires_at", nowIso);
    }
    else if (filter === "blocked") q = q.eq("is_blocked", true);

    if (sort === "most") {
      q = q.order("total_joins", { ascending: false }).order("last_join_at", { ascending: false, nullsFirst: false });
    } else if (sort === "least") {
      q = q.order("total_joins", { ascending: true }).order("created_at", { ascending: false });
    } else if (sort === "recent") {
      q = q.order("last_join_at", { ascending: false, nullsFirst: false });
    } else {
      q = q.order("created_at", { ascending: false });
    }
    return q.order("id", { ascending: true });
  };
}

async function decorateUsers(rows) {
  const [grants, subs, payment] = await Promise.all([
    loadGrantsByEmail(rows.map((r) => r.email)),
    loadManualSubsForUsers(rows.map((r) => r.id)),
    loadPaymentSettings(),
  ]);
  return rows.map((u) => ({
    ...u,
    access: summarizeAccess({
      user: u,
      grants: grants.get((u.email || "").toLowerCase()) || [],
      manualSubs: subs.get(u.id) || [],
      payment,
    }),
  }));
}

/** ids of people who are inside a manual subscription right now. */
async function activeManualUserIds() {
  const nowIso = new Date().toISOString();
  const { data } = await supabaseAdmin
    .from("manual_subscriptions")
    .select("user_id")
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso);
  return [...new Set((data || []).map((r) => r.user_id))];
}

/**
 * GET /api/admin/users
 * Query: search, sort, filter, limit, offset.
 */
export async function listUsers(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const build = usersQuery({
      search: cleanSearch(req.query.search),
      sort: req.query.sort,
      filter: req.query.filter,
      paidIds: req.query.filter === "paid" ? await activeManualUserIds() : [],
    });

    const { data, error, count } = await build().range(offset, offset + limit - 1);
    if (error) throw error;

    const users = await decorateUsers(data);
    const total = count ?? 0;
    return res.status(200).json({ users, hasMore: offset + data.length < total, total });
  } catch (err) {
    console.error("admin listUsers error:", err);
    return res.status(500).json({ error: "Failed to fetch users" });
  }
}

/** GET /api/admin/users/export  -> .xlsx of every user matching the same filters. */
export async function exportUsers(req, res) {
  try {
    const build = usersQuery({
      search: cleanSearch(req.query.search),
      sort: req.query.sort,
      filter: req.query.filter,
      paidIds: req.query.filter === "paid" ? await activeManualUserIds() : [],
    });

    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await build().range(from, from + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) break;
    }

    const users = await decorateUsers(rows);
    const buffer = await usersToWorkbook(users, getBillingConfig().tzOffsetMinutes);

    res.setHeader("Content-Type", XLSX_MIME);
    res.setHeader("Content-Disposition", 'attachment; filename="joindesk-users.xlsx"');
    return res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    console.error("admin exportUsers error:", err);
    return res.status(500).json({ error: "Failed to export users" });
  }
}

// =========================
// Desk analytics
// =========================

async function loadDeskReport(deskId, monthInput) {
  const { data: desk, error } = await supabaseAdmin
    .from("desks")
    .select("id, title, topic, is_special, created_at, creator_name")
    .eq("id", deskId)
    .maybeSingle();
  if (error) throw error;
  if (!desk) return null;

  const monthInfo = parseMonth(monthInput);
  const events = mergeDeskJoins(await fetchDeskEvents(deskId), await fetchDeskJoinRows(deskId));
  const users = await fetchUsersByIds(events.map((e) => e.user_id));

  // Which of these people currently have free access (all desks / this desk)?
  const grants = await loadGrantsByEmail(users.map((u) => u.email));
  const freeMap = {};
  for (const [email, list] of grants) {
    if (list.some((g) => g.scope === "all")) freeMap[email] = "all";
    else if (list.some((g) => g.scope === "desk" && g.desk_id === deskId)) freeMap[email] = "desk";
  }

  const report = buildDeskReport({ desk, events, users, freeMap, monthInfo });
  return { report, events, users };
}

/**
 * GET /api/admin/desks/:id/analytics?month=YYYY-MM
 * A few totals + the ranked list of people for one desk and month.
 */
export async function deskAnalytics(req, res) {
  try {
    const loaded = await loadDeskReport(req.params.id, req.query.month);
    if (!loaded) return res.status(404).json({ error: "Desk not found" });
    return res.status(200).json(loaded.report);
  } catch (err) {
    console.error("admin deskAnalytics error:", err);
    return res.status(500).json({ error: "Failed to load analytics" });
  }
}

/** GET /api/admin/desks/:id/export?month=YYYY-MM -> .xlsx (Summary, Users, Daily, Join Log). */
export async function exportDesk(req, res) {
  try {
    const loaded = await loadDeskReport(req.params.id, req.query.month);
    if (!loaded) return res.status(404).json({ error: "Desk not found" });

    const usersById = new Map(loaded.users.map((u) => [u.id, u]));
    const buffer = await deskReportToWorkbook(loaded.report, loaded.events, usersById);

    res.setHeader("Content-Type", XLSX_MIME);
    res.setHeader("Content-Disposition", `attachment; filename="desk-${loaded.report.month}.xlsx"`);
    return res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    console.error("admin exportDesk error:", err);
    return res.status(500).json({ error: "Failed to export" });
  }
}

// =========================
// One user's activity + access
// =========================

/**
 * GET /api/admin/users/:id/activity?month=YYYY-MM
 * Which desks they visit, how many times, on which days — plus their access
 * (paid / trial / free grants) and payment history, so the admin can decide
 * whether free access is still being used.
 */
export async function userActivity(req, res) {
  try {
    const { id } = req.params;
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select(USER_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!user) return res.status(404).json({ error: "User not found" });

    const monthInfo = parseMonth(req.query.month);
    const events = mergeUserJoins(await fetchUserEvents(id), await fetchUserJoinRows(id));

    const deskIds = [...new Set(events.map((e) => e.desk_id))];
    const desks = [];
    for (const part of chunk(deskIds, 150)) {
      const { data } = await supabaseAdmin.from("desks").select("id, title, is_special").in("id", part);
      desks.push(...(data || []));
    }

    const grants = (await loadGrantsByEmail([user.email])).get((user.email || "").toLowerCase()) || [];
    const deskTitles = new Map();
    const grantDeskIds = grants.filter((g) => g.desk_id).map((g) => g.desk_id);
    if (grantDeskIds.length) {
      const { data } = await supabaseAdmin.from("desks").select("id, title").in("id", grantDeskIds);
      (data || []).forEach((d) => deskTitles.set(d.id, d.title));
    }

    const { data: payments } = await supabaseAdmin
      .from("payments")
      .select("amount_paise, paid_at, starts_at, expires_at, days")
      .eq("user_id", id)
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(10);

    const activity = buildUserActivity({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
        is_blocked: user.is_blocked,
      },
      events,
      desks,
      monthInfo,
    });

    const [manualSubs, payment] = await Promise.all([loadManualSubs(id), loadPaymentSettings()]);

    return res.status(200).json({
      ...activity,
      access: summarizeAccess({ user, grants, manualSubs, payment }),
      manualSubs,
      grants: grants.map((g) => ({
        id: g.id,
        scope: g.scope,
        deskId: g.desk_id,
        deskTitle: g.desk_id ? deskTitles.get(g.desk_id) || "(deleted desk)" : null,
        note: g.note,
        granted_at: g.granted_at,
      })),
      payments: payments || [],
    });
  } catch (err) {
    console.error("admin userActivity error:", err);
    return res.status(500).json({ error: "Failed to load user activity" });
  }
}

// =========================
// Free access grants
// =========================

/**
 * GET /api/admin/access
 * Query: search (email), scope ("all" | "desk"), desk_id, limit, offset.
 * Each grant is enriched with the person's name (if they've signed up) and
 * how much they've actually been visiting — so you can spot free access
 * that nobody is using and take it back.
 */
export async function listGrants(req, res) {
  try {
    const cfg = getBillingConfig();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const search = cleanSearch(req.query.search).toLowerCase();

    let q = supabaseAdmin
      .from("access_grants")
      .select("id, email, scope, desk_id, note, granted_at", { count: "exact" })
      .order("granted_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) q = q.ilike("email", `%${search}%`);
    if (req.query.scope === "all") q = q.eq("scope", "all");
    if (req.query.scope === "desk") q = q.eq("scope", "desk");
    if (typeof req.query.desk_id === "string" && req.query.desk_id) q = q.eq("desk_id", req.query.desk_id);

    const { data, error, count } = await q;
    if (error) throw error;

    const emails = [...new Set(data.map((g) => g.email))];
    const users = [];
    for (const part of chunk(emails, 150)) {
      const { data: rows } = await supabaseAdmin
        .from("users")
        .select("id, name, email, avatar_url, total_joins, last_join_at")
        .in("email", part);
      users.push(...(rows || []));
    }
    const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));

    const deskIds = [...new Set(data.map((g) => g.desk_id).filter(Boolean))];
    const deskTitles = new Map();
    if (deskIds.length) {
      const { data: desks } = await supabaseAdmin.from("desks").select("id, title").in("id", deskIds);
      (desks || []).forEach((d) => deskTitles.set(d.id, d.title));
    }

    const since = new Date(Date.now() - cfg.inactiveDays * DAY_MS).toISOString();
    const recent = await fetchRecentEventsForUsers(users.map((u) => u.id), since);

    const grants = data.map((g) => {
      const u = userByEmail.get(g.email);
      const mine = u ? recent.filter((e) => e.user_id === u.id) : [];
      // For a one-desk grant, "active" means they joined THAT desk.
      const relevant = g.scope === "desk" ? mine.filter((e) => e.desk_id === g.desk_id) : mine;
      return {
        id: g.id,
        email: g.email,
        scope: g.scope,
        deskId: g.desk_id,
        deskTitle: g.desk_id ? deskTitles.get(g.desk_id) || "(deleted desk)" : null,
        note: g.note,
        granted_at: g.granted_at,
        user: u
          ? { id: u.id, name: u.name, avatar_url: u.avatar_url, total_joins: u.total_joins, last_join_at: u.last_join_at }
          : null,
        recentJoins: relevant.length,
        inactive: relevant.length === 0,
      };
    });

    const total = count ?? 0;
    return res
      .status(200)
      .json({ grants, hasMore: offset + data.length < total, total, inactiveDays: cfg.inactiveDays });
  } catch (err) {
    console.error("admin listGrants error:", err);
    return res.status(500).json({ error: "Failed to load free-access list" });
  }
}

/**
 * POST /api/admin/access
 * Body: { email, scope: "all" | "desk", desk_id?, note? }
 */
export async function createGrant(req, res) {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const scope = req.body?.scope;
    const deskId = req.body?.desk_id || null;
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 200) : "";

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address" });
    }
    if (scope !== "all" && scope !== "desk") {
      return res.status(400).json({ error: "scope must be 'all' or 'desk'" });
    }
    if (scope === "desk") {
      if (!deskId) return res.status(400).json({ error: "Pick a desk" });
      const { data: desk } = await supabaseAdmin.from("desks").select("id").eq("id", deskId).maybeSingle();
      if (!desk) return res.status(404).json({ error: "Desk not found" });
    }

    let existing = supabaseAdmin.from("access_grants").select("id").eq("email", email).eq("scope", scope);
    existing = scope === "desk" ? existing.eq("desk_id", deskId) : existing;
    const { data: found } = await existing.maybeSingle();
    if (found) {
      return res.status(200).json({ grant: found, alreadyExisted: true });
    }

    const { data, error } = await supabaseAdmin
      .from("access_grants")
      .insert({ email, scope, desk_id: scope === "desk" ? deskId : null, note: note || null })
      .select()
      .single();
    if (error) throw error;

    return res.status(201).json({ grant: data });
  } catch (err) {
    console.error("admin createGrant error:", err);
    return res.status(500).json({ error: "Failed to give free access" });
  }
}

/** DELETE /api/admin/access/:id  -> takes the free access back. */
export async function deleteGrant(req, res) {
  try {
    const { error } = await supabaseAdmin.from("access_grants").delete().eq("id", req.params.id);
    if (error) throw error;
    return res.status(200).json({ deleted: true });
  } catch (err) {
    console.error("admin deleteGrant error:", err);
    return res.status(500).json({ error: "Failed to remove free access" });
  }
}
