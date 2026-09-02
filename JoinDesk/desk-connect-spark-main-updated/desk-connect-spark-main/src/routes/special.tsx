import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Search } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/joindesk/Navbar";
import { DeskGrid } from "@/components/joindesk/DeskGrid";
import { JoinDeskModal } from "@/components/joindesk/JoinDeskModal";
import { BlockedScreen } from "@/components/joindesk/BlockedScreen";
import { getSpecialDesksPage } from "@/lib/desks";
import { loginWithGoogle, logout, restoreSession, BlockedError, type AppUser } from "@/lib/auth";
import { type Desk } from "@/lib/joindesk";

export const Route = createFileRoute("/special")({
  head: () => ({
    meta: [{ title: "Special Desks — JoinDesk" }],
  }),
  component: SpecialDesksPage,
});

const PAGE_SIZE = 15;

function SpecialDesksPage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);

  const [desks, setDesks] = useState<Desk[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");

  const [selectedDesk, setSelectedDesk] = useState<Desk | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  useEffect(() => {
    restoreSession()
      .then(setUser)
      .catch((err) => {
        if (err instanceof BlockedError) setIsBlocked(true);
      })
      .finally(() => setCheckingSession(false));
  }, []);

  const load = async (fromOffset: number, reset: boolean, query: string) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const { desks: page, hasMore: more } = await getSpecialDesksPage(
        PAGE_SIZE,
        fromOffset,
        query
      );
      setDesks((prev) => (reset ? page : [...prev, ...page]));
      setHasMore(more);
      setOffset(fromOffset + page.length);
    } catch {
      toast.error("Couldn't load special desks. Is the backend running?");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Re-fetch (debounced) whenever the search text changes.
  useEffect(() => {
    const delay = search ? 350 : 0;
    const handle = setTimeout(() => load(0, true, search), delay);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleLogin = async () => {
    try {
      const loggedInUser = await loginWithGoogle();
      setUser(loggedInUser);
    } catch (err) {
      if (err instanceof BlockedError) {
        setIsBlocked(true);
        return;
      }
      const message = err instanceof Error ? err.message : "Couldn't sign in with Google.";
      toast.error(message);
    }
  };

  const handleLogout = () => {
    logout();
    setUser(null);
  };

  if (checkingSession) {
    return <div className="min-h-screen bg-background" />;
  }

  if (isBlocked) {
    return <BlockedScreen />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar
        isLoggedIn={Boolean(user)}
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        searchQuery=""
        onSearchChange={() => {}}
        onCreate={() => {}}
        hideSearch
        hideCreate
      />

      <main>
        <section className="relative mx-auto max-w-6xl px-4 py-10">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-special-gradient text-primary-foreground shadow-glow">
              <Sparkles className="h-4.5 w-4.5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Special Desks</h1>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Long-running desks curated by JoinDesk. They never expire and stay open until
            removed.
          </p>

          <div className="mt-6 flex max-w-md items-center gap-2 rounded-full border border-border bg-muted/60 px-4 py-2.5 transition-shadow focus-within:border-special/50 focus-within:bg-card focus-within:shadow-soft">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search special desks by topic or description"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="mt-8">
            <DeskGrid
              desks={desks}
              loading={loading}
              loadingMore={loadingMore}
              hasMore={hasMore}
              onLoadMore={() => {
                if (loading || loadingMore || !hasMore) return;
                load(offset, false, search);
              }}
              onJoin={(d) => {
                setSelectedDesk(d);
                setIsJoinModalOpen(true);
              }}
              currentUserId={null}
              emptyState={
                <p className="text-sm text-muted-foreground">
                  {search ? "No special desks match that search." : "No special desks yet."}
                </p>
              }
            />
          </div>
        </section>
      </main>

      <JoinDeskModal
        open={isJoinModalOpen}
        desk={selectedDesk}
        onClose={() => setIsJoinModalOpen(false)}
      />
    </div>
  );
}
