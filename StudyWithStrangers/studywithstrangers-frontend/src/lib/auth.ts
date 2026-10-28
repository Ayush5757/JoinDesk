import { api, ApiError, AUTH_TOKEN_KEY } from "./api";

export { AUTH_TOKEN_KEY };

/** Mirrors "is someone signed in" onto <html> so the landing page can be hidden before React loads. */
function setSessionFlag(on: boolean) {
  if (typeof document !== "undefined") document.documentElement.classList.toggle("has-session", on);
}

/** Fired on window right after a sign-in or sign-out, so parts of the app outside the page can react. */
export const AUTH_CHANGED_EVENT = "sws-auth-changed";

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
    const fail = () => {
      scriptLoadPromise = null; // allow a retry next time
      reject(new Error("Couldn't load Google sign-in. Check your internet and try again."));
    };
    const timeout = setTimeout(fail, 15000);
    const done = () => {
      clearTimeout(timeout);
      resolve();
    };
    const existing = document.querySelector(`script[src="${GSI_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", done);
      existing.addEventListener("error", fail);
      return;
    }
    const script = document.createElement("script");
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = done;
    script.onerror = fail;
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

/**
 * Downloads Google's sign-in script in the background as soon as the app opens. If it were only
 * fetched when the button is pressed, the browser could treat the pop-up as "not caused by a click"
 * and block it, which is why people sometimes had to press Sign in twice.
 */
export function preloadGoogleSignIn() {
  if (typeof window === "undefined" || !GOOGLE_CLIENT_ID) return;
  void loadGoogleScript().catch(() => {});
}

// ---------------------------------------------------------------------------
// What the app remembers about you between pages
// ---------------------------------------------------------------------------
const USER_KEY = "sws_user";

/**
 * The last signed-in person, kept on this device. Pages use it to show the right screen at once when you
 * come back to them (for example with the Back button), instead of flashing the signed-out screen
 * while the session is being checked again in the background.
 */
export function readCachedUser(): AppUser | null {
  try {
    if (!localStorage.getItem(AUTH_TOKEN_KEY)) return null;
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
}

function cacheUser(user: AppUser | null) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* storage can be full or blocked: not a problem */
  }
}

// ---------------------------------------------------------------------------
// "Signing you in..." state, so the screen never looks stuck
// ---------------------------------------------------------------------------
let signingIn = false;
const busyListeners = new Set<() => void>();
function setSigningIn(value: boolean) {
  signingIn = value;
  busyListeners.forEach((fn) => fn());
}
export function subscribeSigningIn(fn: () => void) {
  busyListeners.add(fn);
  return () => {
    busyListeners.delete(fn);
  };
}
export const getSigningIn = () => signingIn;

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

    let finished = false;
    const finish = (fn: () => void) => {
      if (finished) return;
      finished = true;
      setSigningIn(false);
      fn();
    };

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "openid email profile",
      callback: async (response) => {
        if (response.error || !response.access_token) {
          finish(() => reject(new Error(response.error ? "Google sign-in didn't complete. Try again." : "Google sign-in was cancelled.")));
          return;
        }
        try {
          const { token, user } = await api.post<{ token: string; user: AppUser }>(
            "/api/auth/google",
            { access_token: response.access_token },
          );
          localStorage.setItem(AUTH_TOKEN_KEY, token);
          cacheUser(user);
          setSessionFlag(true);
          window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
          finish(() => resolve(user));
        } catch (err) {
          finish(() => reject(isBlockedApiError(err) ? new BlockedError() : err));
        }
      },
      // the person closed Google's window, or the browser blocked it: don't leave the page waiting forever
      error_callback: (err: { type?: string }) => {
        finish(() =>
          reject(
            new Error(
              err?.type === "popup_failed_to_open"
                ? "Your browser blocked the Google window. Allow pop-ups for this site and try again."
                : "Sign-in was cancelled.",
            ),
          ),
        );
      },
    });

    setSigningIn(true);
    client.requestAccessToken();
  });
}

export function logout() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  cacheUser(null);
  setSessionFlag(false);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

/**
 * Called on app load to restore a previous session. Validates the stored
 * token against the backend; clears it if it's stale/expired. Throws
 * BlockedError (without clearing the token) if an admin has blocked this
 * account — the caller should render BlockedScreen instead of the app.
 */
export async function restoreSession(): Promise<AppUser | null> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    setSessionFlag(false);
    return null;
  }

  try {
    const { user } = await api.get<{ user: AppUser }>("/api/auth/me");
    cacheUser(user);
    setSessionFlag(true);
    return user;
  } catch (err) {
    if (isBlockedApiError(err)) throw new BlockedError();
    // Only a real "your session is not valid" answer signs you out. A slow or failed network must not,
    // otherwise a brief hiccup would log people out.
    if (err instanceof ApiError && err.status === 401) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      cacheUser(null);
      setSessionFlag(false);
      return null;
    }
    return readCachedUser();
  }
}
