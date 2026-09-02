import { api, ApiError, AUTH_TOKEN_KEY } from "./api";

export { AUTH_TOKEN_KEY };

export type AppUser = {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
};

/**
 * Thrown by loginWithGoogle/restoreSession when the backend reports this
 * account has been platform-blocked by an admin. The UI should stop
 * showing the normal app entirely and render a full "you're blocked"
 * screen instead — see BlockedScreen.tsx.
 */
export class BlockedError extends Error {
  constructor() {
    super("You have been blocked by the admin.");
    this.name = "BlockedError";
  }
}

function isBlockedApiError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403 && err.message === "blocked";
}

const GOOGLE_CLIENT_ID = import.meta.env["VITE_GOOGLE_CLIENT_ID"] as string;
const GSI_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

let scriptLoadPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google script")));
      return;
    }
    const script = document.createElement("script");
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google script"));
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

/**
 * "Continue with Google": opens Google's real account-picker popup, then
 * hands the resulting access token to our backend, which verifies it with
 * Google, upserts the user, and returns our own session token + profile.
 */
export async function loginWithGoogle(): Promise<AppUser> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("Missing VITE_GOOGLE_CLIENT_ID. Check your .env file.");
  }

  await loadGoogleScript();

  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error("Google sign-in isn't available right now."));
      return;
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "openid email profile",
      callback: async (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error || "Google sign-in was cancelled."));
          return;
        }
        try {
          const { token, user } = await api.post<{ token: string; user: AppUser }>(
            "/api/auth/google",
            { access_token: response.access_token },
          );
          localStorage.setItem(AUTH_TOKEN_KEY, token);
          resolve(user);
        } catch (err) {
          reject(isBlockedApiError(err) ? new BlockedError() : err);
        }
      },
    });

    client.requestAccessToken();
  });
}

export function logout() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

/**
 * Called on app load to restore a previous session. Validates the stored
 * token against the backend; clears it if it's stale/expired. Throws
 * BlockedError (without clearing the token) if an admin has blocked this
 * account — the caller should render BlockedScreen instead of the app.
 */
export async function restoreSession(): Promise<AppUser | null> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return null;

  try {
    const { user } = await api.get<{ user: AppUser }>("/api/auth/me");
    return user;
  } catch (err) {
    if (isBlockedApiError(err)) throw new BlockedError();
    localStorage.removeItem(AUTH_TOKEN_KEY);
    return null;
  }
}
