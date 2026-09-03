import { api } from "./api";
import { deskFromApi, type Desk, type DeskApiRow } from "./joindesk";

export type PublicUser = {
  id: string;
  name: string;
  email?: string; // only present when viewing your own profile
  avatar_url: string | null;
  created_at: string;
};

export type ProfileResponse = {
  user: PublicUser;
  isOwner: boolean;
  iBlockedThem: boolean;
  theyBlockedMe: boolean;
};

export type Joiner = {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  joined_at: string;
  isSpecial: boolean;
  isBlocked: boolean;
  // Platform-wide ban status (from the Admin Panel) — distinct from
  // `isBlocked`, which is the desk owner's own personal block list.
  isPlatformBlocked?: boolean;
};

export function getProfile(userId: string) {
  return api.get<ProfileResponse>(`/api/users/${userId}`);
}

export function updateAvatar(file: File) {
  const form = new FormData();
  form.append("avatar", file);
  return api.patchForm<{ user: PublicUser }>("/api/users/me/avatar", form);
}

export function blockUser(userId: string) {
  return api.post<{ blocked: boolean }>(`/api/users/${userId}/block`);
}

export function unblockUser(userId: string) {
  return api.post<{ blocked: boolean }>(`/api/users/${userId}/unblock`);
}

export function getMyBlockedUsers() {
  return api.get<{ blocked: PublicUser[] }>("/api/users/me/blocks");
}

export function markSpecial(userId: string) {
  return api.post<{ special: boolean }>(`/api/users/${userId}/special`);
}

export function unmarkSpecial(userId: string) {
  return api.delete<{ special: boolean }>(`/api/users/${userId}/special`);
}

export function getMySpecialUsers() {
  return api.get<{ special: PublicUser[] }>("/api/users/me/special");
}

export function getDeskJoiners(deskId: string, search = "") {
  const params = search ? `?search=${encodeURIComponent(search)}` : "";
  return api.get<{ deskTitle: string; joiners: Joiner[] }>(`/api/desks/${deskId}/joiners${params}`);
}

export function recordDeskJoin(deskId: string) {
  return api.post<{ joined: boolean }>(`/api/desks/${deskId}/join`);
}

export async function getUserDesksPage(userId: string, limit: number, offset: number) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const { desks, hasMore, total } = await api.get<{
    desks: DeskApiRow[];
    hasMore: boolean;
    total: number;
  }>(`/api/users/${userId}/desks?${params.toString()}`);
  return { desks: desks.map(deskFromApi) as Desk[], hasMore, total };
}
