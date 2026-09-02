import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/joindesk/Navbar";
import { ProfileView } from "@/components/joindesk/ProfileView";
import { BlockedScreen } from "@/components/joindesk/BlockedScreen";
import { loginWithGoogle, logout, restoreSession, BlockedError, type AppUser } from "@/lib/auth";

export const Route = createFileRoute("/profile/$id")({
  head: () => ({
    meta: [{ title: "Profile — JoinDesk" }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { id } = Route.useParams();
  const [user, setUser] = useState<AppUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    restoreSession()
      .then(setUser)
      .catch((err) => {
        if (err instanceof BlockedError) setIsBlocked(true);
      })
      .finally(() => setCheckingSession(false));
  }, []);

  const handleLogin = async () => {
    try {
      const loggedInUser = await loginWithGoogle();
      setUser(loggedInUser);
    } catch (err) {
      if (err instanceof BlockedError) setIsBlocked(true);
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
      />
      <main>
        <ProfileView userId={id} currentUser={user} />
      </main>
    </div>
  );
}
