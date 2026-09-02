import { ShieldBan } from "lucide-react";
import { logout } from "@/lib/auth";

/**
 * Rendered instead of the ENTIRE app (no Navbar, no dashboard, nothing)
 * when the backend reports this account has been platform-blocked by an
 * admin. There is intentionally no way to dismiss this and use the app —
 * only sign out and, if it was a mistake, contact the admin separately.
 */
export function BlockedScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="grid h-20 w-20 place-items-center rounded-3xl bg-destructive/10 text-destructive shadow-soft">
        <ShieldBan className="h-9 w-9" />
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">You've been blocked</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        An admin has blocked this account from using JoinDesk. You won't be able to browse,
        create, or join any desks while this block is in place.
      </p>
      <button
        onClick={() => {
          logout();
          window.location.href = "/";
        }}
        className="mt-8 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold shadow-soft transition-colors hover:bg-muted"
      >
        Sign out
      </button>
    </div>
  );
}
