import { useState } from "react";
import { Search, Plus, LayoutGrid } from "lucide-react";
import { GoogleIcon } from "./GoogleIcon";
import type { AppUser } from "@/lib/auth";

type Props = {
  isLoggedIn: boolean;
  user: AppUser | null;
  onLogin: () => void;
  onLogout: () => void;
  searchQuery: string;
  onSearchChange: (v: string) => void;
  onCreate: () => void;
};

export function Navbar({
  isLoggedIn,
  user,
  onLogin,
  onLogout,
  searchQuery,
  onSearchChange,
  onCreate,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:flex sm:justify-between sm:gap-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-brand-gradient shadow-glow">
            <LayoutGrid className="h-4.5 w-4.5 text-primary-foreground" strokeWidth={2.5} />
          </span>
          <span className="truncate text-lg font-semibold tracking-tight">JoinDesk</span>
        </div>

        {isLoggedIn && (
          <div className="order-3 col-span-2 flex min-w-0 flex-1 items-center sm:order-none sm:max-w-md">
            <div className="flex w-full items-center gap-2 rounded-full border border-border bg-muted/60 px-4 py-2 transition-shadow focus-within:border-primary/40 focus-within:bg-card focus-within:shadow-soft">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search desks by topic or description"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="hidden shrink-0 rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground sm:block">
                ⌘K
              </kbd>
            </div>
          </div>
        )}

        {isLoggedIn && user ? (
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              onClick={onCreate}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition-transform duration-200 hover:scale-[1.04] active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              <span className="hidden sm:inline">Create Desk</span>
            </button>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="block h-9 w-9 overflow-hidden rounded-full ring-2 ring-border transition hover:ring-primary/50"
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center bg-muted text-xs font-semibold uppercase text-muted-foreground">
                    {user.name.slice(0, 1)}
                  </span>
                )}
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-border bg-card/95 p-4 shadow-soft backdrop-blur-xl">
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</p>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onLogout();
                    }}
                    className="mt-3 w-full rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onLogin}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Log In
            </button>
            <button
              onClick={onLogin}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold shadow-soft transition-transform duration-200 hover:scale-[1.03]"
            >
              <GoogleIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Continue with Google</span>
              <span className="sm:hidden">Google</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
