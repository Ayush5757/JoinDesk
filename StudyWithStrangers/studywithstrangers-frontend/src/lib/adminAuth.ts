import { api } from "./api";

// Kept in a separate localStorage key from the normal session token
// (AUTH_TOKEN_KEY in api.ts) on purpose: this is a distinct, short-lived
// (12h) admin session layered on top of whichever Google account is
// currently logged in — see backend README section "Special Desks & the
// Admin Panel" for the full flow.
export const ADMIN_TOKEN_KEY = "admin_token";

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function isAdminUnlocked(): boolean {
  return Boolean(getAdminToken());
}

export function lockAdmin(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

/**
 * Sends the admin password to the backend (using the NORMAL session
 * token, since /api/admin/unlock requires being logged in first). On
 * success, stores the short-lived admin token used for every other
 * /api/admin/* call.
 */
export async function unlockAdmin(password: string): Promise<void> {
  const { adminToken } = await api.post<{ adminToken: string }>("/api/admin/unlock", {
    password,
  });
  localStorage.setItem(ADMIN_TOKEN_KEY, adminToken);
}
