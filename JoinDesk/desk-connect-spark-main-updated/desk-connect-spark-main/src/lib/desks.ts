import { api } from "./api";
import { deskFromApi, type Desk, type DeskApiRow } from "./joindesk";

/**
 * GET /api/desks/special — the permanent, admin-curated desks. No 15-day
 * cutoff applies to these; they only disappear when an admin deletes them.
 */
export async function getSpecialDesksPage(limit: number, offset: number, search = "") {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (search.trim()) params.set("search", search.trim());
  const { desks, hasMore, total } = await api.get<{
    desks: DeskApiRow[];
    hasMore: boolean;
    total: number;
  }>(`/api/desks/special?${params.toString()}`);
  return { desks: desks.map(deskFromApi) as Desk[], hasMore, total };
}

export type EditableDeskFields = {
  title: string;
  description: string;
  meetLink: string;
  topic: string;
};

/**
 * PATCH /api/desks/:id — used both by a normal user editing their own
 * desk from their profile, and (when the caller holds an admin token) by
 * the Admin Panel editing any desk.
 */
export async function updateDesk(deskId: string, fields: Partial<EditableDeskFields>) {
  const body: Record<string, unknown> = {};
  if (fields.title !== undefined) body["title"] = fields.title;
  if (fields.description !== undefined) body["description"] = fields.description;
  if (fields.meetLink !== undefined) body["google_meet_link"] = fields.meetLink;
  if (fields.topic !== undefined) body["topic"] = fields.topic;

  const { desk } = await api.patch<{ desk: DeskApiRow }>(`/api/desks/${deskId}`, body);
  return deskFromApi(desk);
}

export function deleteDesk(deskId: string) {
  return api.delete<{ deleted: boolean }>(`/api/desks/${deskId}`);
}

/**
 * Toggle a desk's visibility on the public dashboard without deleting it.
 * Only the desk's own creator (or an admin) can do this.
 */
export async function setDeskHidden(deskId: string, hidden: boolean) {
  const { desk } = await api.patch<{ desk: DeskApiRow }>(`/api/desks/${deskId}`, {
    is_hidden: hidden,
  });
  return deskFromApi(desk);
}
