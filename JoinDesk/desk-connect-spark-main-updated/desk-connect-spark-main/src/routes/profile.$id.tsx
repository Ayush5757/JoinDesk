import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/joindesk/Navbar";
import { ProfileView } from "@/components/joindesk/ProfileView";
import { loginWithGoogle, logout, restoreSession, type AppUser } from "@/lib/auth";

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

  useEffect(() => {
    restoreSession()
      .then(setUser)
      .finally(() => setCheckingSession(false));
  }, []);

  const handleLogin = async () => {
    const loggedInUser = await loginWithGoogle().catch(() => null);
    if (loggedInUser) setUser(loggedInUser);
  };

  const handleLogout = () => {
    logout();
    setUser(null);
  };

  if (checkingSession) {
    return <div className="min-h-screen bg-background" />;
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
