import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Navbar } from "@/components/joindesk/Navbar";
import { ProfileView } from "@/components/joindesk/ProfileView";
import { BlockedScreen } from "@/components/joindesk/BlockedScreen";
import { CreateDeskModal, type NewDeskInput } from "@/components/joindesk/CreateDeskModal";
import { loginWithGoogle, logout, restoreSession, BlockedError, type AppUser } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import type { DeskApiRow } from "@/lib/joindesk";

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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  // Bumped after a successful create so <ProfileView> below remounts and
  // re-fetches this person's desks (it has no refresh prop of its own).
  const [refreshKey, setRefreshKey] = useState(0);

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

  const handleCreate = async (input: NewDeskInput) => {
    try {
      await api.post<{ desk: DeskApiRow }>("/api/desks", {
        title: input.title,
        description: input.description,
        google_meet_link: input.meetLink,
        topic: "Research",
      });
      setIsCreateModalOpen(false);
      setRefreshKey((k) => k + 1);
      toast.success("Desk created — find it on the dashboard.");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to create desk.";
      toast.error(message);
    }
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
        onCreate={() => setIsCreateModalOpen(true)}
        hideSearch
      />
      <main>
        <ProfileView key={refreshKey} userId={id} currentUser={user} />
      </main>

      <CreateDeskModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
