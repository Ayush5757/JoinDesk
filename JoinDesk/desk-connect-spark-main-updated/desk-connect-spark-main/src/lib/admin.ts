import { adminApi } from "./adminApi";
import { deskFromApi, type Desk, type DeskApiRow } from "./joindesk";
import { type Joiner } from "./users";
import { type AccessSummary } from "./billing";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  is_blocked: boolean;
  created_at: string;
  // Activity counters kept by the backend on every join. total_joins === 0
  // means the person signed up but never joined anything ("dead" user).
  total_joins: number;
  last_join_at: string | null;
  access: AccessSummary;
};

export type UserSort = "newest" | "most" | "least" | "recent";
export type UserFilter = "all" | "never" | "inactive" | "paid" | "blocked";

export type NewAdminDeskInput = {
  title: string;
  description: string;
  meetLink: string;
  topic: string;
  isSpecial: boolean;
};

/**
 * GET /api/admin/desks — every desk on the platform, Special or not,
 * expired or not. `special`: "true" | "false" | undefined (= all).
 */
export async function adminListDesks(opts: {
  limit: number;
  offset: number;
  search?: string;
  special?: "true" | "false";
}) {
  const params = new URLSearchParams({
    limit: String(opts.limit),
    offset: String(opts.offset),
  });
  if (opts.search?.trim()) params.set("search", opts.search.trim());
  if (opts.special) params.set("special", opts.special);

  const { desks, hasMore, total } = await adminApi.get<{
    desks: DeskApiRow[];
    hasMore: boolean;
    total: number;
  }>(`/api/admin/desks?${params.toString()}`);
  return { desks: desks.map(deskFromApi) as Desk[], hasMore, total };
}

export async function adminCreateDesk(input: NewAdminDeskInput) {
  const { desk } = await adminApi.post<{ desk: DeskApiRow }>("/api/admin/desks", {
    title: input.title,
    description: input.description,
    google_meet_link: input.meetLink,
    topic: input.topic,
    is_special: input.isSpecial,
  });
  return deskFromApi(desk);
}

/**
 * Editing/deleting any desk reuses the normal /api/desks/:id route — the
 * backend grants full access there when it sees an admin token, so this
 * just points those same calls at the admin fetch wrapper (admin token)
 * instead of the normal one.
 */
export async function adminUpdateDesk(
  deskId: string,
  fields: {
    title?: string;
    description?: string;
    meetLink?: string;
    topic?: string;
    isSpecial?: boolean;
  },
) {
  const body: Record<string, unknown> = {};
  if (fields.title !== undefined) body["title"] = fields.title;
  if (fields.description !== undefined) body["description"] = fields.description;
  if (fields.meetLink !== undefined) body["google_meet_link"] = fields.meetLink;
  if (fields.topic !== undefined) body["topic"] = fields.topic;
  if (fields.isSpecial !== undefined) body["is_special"] = fields.isSpecial;

  const { desk } = await adminApi.patch<{ desk: DeskApiRow }>(`/api/desks/${deskId}`, body);
  return deskFromApi(desk);
}

export function adminDeleteDesk(deskId: string) {
  return adminApi.delete<{ deleted: boolean }>(`/api/desks/${deskId}`);
}

/**
 * Special-desk manual ordering — the up/down arrows and "jump to spot"
 * input in the Admin Panel's Desks tab. Only meaningful for Special desks;
 * both just return whether the move happened so the caller can re-fetch.
 */
export function adminMoveSpecialDesk(deskId: string, direction: "up" | "down") {
  return adminApi.patch<{ moved: boolean }>(`/api/admin/desks/${deskId}/move`, { direction });
}

export function adminSetSpecialDeskPosition(deskId: string, position: number) {
  return adminApi.patch<{ moved: boolean; position: number }>(
    `/api/admin/desks/${deskId}/position`,
    { position },
  );
}

/** GET /api/admin/users — search/list users for the Block/Unblock screen. */
export async function adminListUsers(opts: {
  limit: number;
  offset: number;
  search?: string;
  sort?: UserSort;
  filter?: UserFilter;
}) {
  const params = new URLSearchParams({
    limit: String(opts.limit),
    offset: String(opts.offset),
  });
  if (opts.search?.trim()) params.set("search", opts.search.trim());
  if (opts.sort) params.set("sort", opts.sort);
  if (opts.filter && opts.filter !== "all") params.set("filter", opts.filter);

  return adminApi.get<{ users: AdminUser[]; hasMore: boolean; total: number }>(
    `/api/admin/users?${params.toString()}`,
  );
}

export function adminBlockUser(userId: string) {
  return adminApi.post<{ blocked: boolean }>(`/api/admin/users/${userId}/block`);
}

export function adminUnblockUser(userId: string) {
  return adminApi.post<{ blocked: boolean }>(`/api/admin/users/${userId}/unblock`);
}

/**
 * GET /api/desks/:id/joiners, but sent with the ADMIN token — the backend
 * allows an admin to view the joiners of ANY desk, not just their own, so
 * an admin can moderate any group from the Admin Panel's Desks tab.
 */
export function adminGetDeskJoiners(deskId: string, search = "") {
  const params = search ? `?search=${encodeURIComponent(search)}` : "";
  return adminApi.get<{ deskTitle: string; joiners: Joiner[] }>(
    `/api/desks/${deskId}/joiners${params}`,
  );
}

// =========================
// Feedback (Suggestions & Complaints)
// =========================

export type FeedbackStatus = "pending" | "resolved" | "problem";

export type AdminFeedback = {
  id: string;
  type: "suggestion" | "complaint";
  message: string;
  status: FeedbackStatus;
  created_at: string;
  reported_name: string | null;
  reporter: { id: string; name: string; email: string } | null;
  reported_desk: { id: string; title: string } | null;
};

/**
 * GET /api/admin/feedback — powers the Feedback tab's infinite-scroll list.
 * `type`/`status` left undefined mean "all".
 */
export async function adminListFeedback(opts: {
  limit: number;
  offset: number;
  type?: "suggestion" | "complaint";
  status?: FeedbackStatus;
}) {
  const params = new URLSearchParams({
    limit: String(opts.limit),
    offset: String(opts.offset),
  });
  if (opts.type) params.set("type", opts.type);
  if (opts.status) params.set("status", opts.status);

  return adminApi.get<{ feedback: AdminFeedback[]; hasMore: boolean; total: number }>(
    `/api/admin/feedback?${params.toString()}`,
  );
}

/**
 * PATCH /api/admin/feedback/:id/status — move a suggestion/complaint
 * between Incomplete ("pending"), Complete ("resolved"), and Problem
 * ("problem").
 */
export async function adminUpdateFeedbackStatus(feedbackId: string, status: FeedbackStatus) {
  const { feedback } = await adminApi.patch<{ feedback: AdminFeedback }>(
    `/api/admin/feedback/${feedbackId}/status`,
    { status },
  );
  return feedback;
}

// =========================
// Join analytics (per desk / per user) + Excel export
// =========================

export type DeskReportUser = {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  is_blocked: boolean;
  joinsInMonth: number;
  daysActiveInMonth: number;
  totalJoins: number;
  firstJoinAt: string;
  lastJoinAt: string;
  freeAccess: "all" | "desk" | null;
};

export type DeskReport = {
  desk: {
    id: string;
    title: string;
    topic: string;
    is_special: boolean;
    created_at: string;
    creator_name: string;
  };
  month: string;
  totals: {
    joinsInMonth: number;
    uniqueUsersInMonth: number;
    activeDays: number;
    allTimeJoins: number;
    allTimeUniqueUsers: number;
  };
  daily: { date: string; joins: number; uniqueUsers: number }[];
  users: DeskReportUser[];
};

export function adminDeskAnalytics(deskId: string, month: string) {
  return adminApi.get<DeskReport>(
    `/api/admin/desks/${deskId}/analytics?month=${encodeURIComponent(month)}`,
  );
}

export function adminDownloadDeskExport(deskId: string, month: string) {
  return adminApi.getBlob(`/api/admin/desks/${deskId}/export?month=${encodeURIComponent(month)}`);
}

export function adminDownloadUsersExport(opts: {
  search?: string;
  sort?: UserSort;
  filter?: UserFilter;
}) {
  const params = new URLSearchParams();
  if (opts.search?.trim()) params.set("search", opts.search.trim());
  if (opts.sort) params.set("sort", opts.sort);
  if (opts.filter && opts.filter !== "all") params.set("filter", opts.filter);
  return adminApi.getBlob(`/api/admin/users/export?${params.toString()}`);
}

export type UserGrant = {
  id: string;
  scope: "all" | "desk";
  deskId: string | null;
  deskTitle: string | null;
  note: string | null;
  granted_at: string;
};

export type UserActivity = {
  user: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    created_at: string;
    is_blocked: boolean;
  };
  month: string;
  totals: {
    joinsInMonth: number;
    daysActiveInMonth: number;
    desksJoinedInMonth: number;
    allTimeJoins: number;
    firstJoinAt: string | null;
    lastJoinAt: string | null;
    daysSinceLast: number | null;
  };
  perDesk: {
    deskId: string;
    title: string;
    isSpecial: boolean;
    joinsInMonth: number;
    daysActiveInMonth: number;
    totalJoins: number;
    lastJoinAt: string;
  }[];
  log: { joined_at: string; deskId: string; deskTitle: string; access_type: string | null }[];
  access: AccessSummary;
  grants: UserGrant[];
  payments: {
    amount_paise: number;
    paid_at: string | null;
    starts_at: string | null;
    expires_at: string | null;
    days: number;
  }[];
};

export function adminUserActivity(userId: string, month: string) {
  return adminApi.get<UserActivity>(
    `/api/admin/users/${userId}/activity?month=${encodeURIComponent(month)}`,
  );
}

// =========================
// Free access (per desk or all desks)
// =========================

export type AccessGrant = {
  id: string;
  email: string;
  scope: "all" | "desk";
  deskId: string | null;
  deskTitle: string | null;
  note: string | null;
  granted_at: string;
  // null = this email hasn't signed up yet
  user: {
    id: string;
    name: string;
    avatar_url: string | null;
    total_joins: number;
    last_join_at: string | null;
  } | null;
  recentJoins: number;
  inactive: boolean;
};

export function adminListGrants(opts: {
  search?: string;
  deskId?: string;
  scope?: "all" | "desk";
}) {
  const params = new URLSearchParams({ limit: "200" });
  if (opts.search?.trim()) params.set("search", opts.search.trim());
  if (opts.deskId) params.set("desk_id", opts.deskId);
  if (opts.scope) params.set("scope", opts.scope);
  return adminApi.get<{ grants: AccessGrant[]; total: number; inactiveDays: number }>(
    `/api/admin/access?${params.toString()}`,
  );
}

export function adminCreateGrant(input: {
  email: string;
  scope: "all" | "desk";
  deskId?: string;
  note?: string;
}) {
  return adminApi.post<{ grant: { id: string }; alreadyExisted?: boolean }>("/api/admin/access", {
    email: input.email,
    scope: input.scope,
    desk_id: input.deskId,
    note: input.note,
  });
}

export function adminDeleteGrant(grantId: string) {
  return adminApi.delete<{ deleted: boolean }>(`/api/admin/access/${grantId}`);
}
