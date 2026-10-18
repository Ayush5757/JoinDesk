import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageLoader } from "@/components/joindesk/PageLoader";
import { BlockedScreen } from "@/components/joindesk/BlockedScreen";
import { GoogleIcon } from "@/components/joindesk/GoogleIcon";
import { TrackerWorkspace } from "@/components/tracker/TrackerWorkspace";
import { loginWithGoogle, readCachedUser, restoreSession, BlockedError, type AppUser } from "@/lib/auth";

export const Route = createFileRoute("/tracker")({
  head: () => ({ meta: [{ title: "Study Tracker — JoinDesk" }] }),
  component: TrackerPage,
});

function TrackerPage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [deskTitle, setDeskTitle] = useState("");

  useEffect(() => {
    const cached = readCachedUser();
    if (cached) {
      setUser(cached);
      setChecking(false);
    }
    restoreSession()
      .then(setUser)
      .catch((err) => {
        if (err instanceof BlockedError) setBlocked(true);
      })
      .finally(() => setChecking(false));
    setDeskTitle(new URLSearchParams(window.location.search).get("d") ?? "");
  }, []);

  const handleLogin = async () => {
    try {
      setUser(await loginWithGoogle());
    } catch (err) {
      if (err instanceof BlockedError) setBlocked(true);
      else toast.error(err instanceof Error ? err.message : "Couldn't sign in with Google.");
    }
  };

  if (checking) return <PageLoader />;
  if (blocked) return <BlockedScreen />;

  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
        <div className="w-full max-w-sm rounded-[28px] border border-border bg-card p-8 text-center shadow-soft">
          <h1 className="text-xl font-bold tracking-tight">Study Tracker</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to track your study time and goals.</p>
          <button
            onClick={handleLogin}
            className="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted"
          >
            <GoogleIcon /> Continue with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Link
            to="/special"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Desks
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        <TrackerWorkspace deskTitle={deskTitle} onBlocked={() => setBlocked(true)} />
      </main>
    </div>
  );
}
