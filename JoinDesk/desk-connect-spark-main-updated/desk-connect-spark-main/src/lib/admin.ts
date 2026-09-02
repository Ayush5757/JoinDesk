import { adminApi } from "./adminApi";
import { deskFromApi, type Desk, type DeskApiRow } from "./joindesk";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  is_blocked: boolean;
  created_at: string;
};

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
  }
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

/** GET /api/admin/users — search/list users for the Block/Unblock screen. */
export async function adminListUsers(opts: { limit: number; offset: number; search?: string }) {
  const params = new URLSearchParams({
    limit: String(opts.limit),
    offset: String(opts.offset),
  });
  if (opts.search?.trim()) params.set("search", opts.search.trim());

  return adminApi.get<{ users: AdminUser[]; hasMore: boolean; total: number }>(
    `/api/admin/users?${params.toString()}`
  );
}

export function adminBlockUser(userId: string) {
  return adminApi.post<{ blocked: boolean }>(`/api/admin/users/${userId}/block`);
}

export function adminUnblockUser(userId: string) {
  return adminApi.post<{ blocked: boolean }>(`/api/admin/users/${userId}/unblock`);
}
