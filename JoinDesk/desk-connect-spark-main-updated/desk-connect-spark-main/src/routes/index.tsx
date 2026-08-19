import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Navbar } from "@/components/joindesk/Navbar";
import { LandingSection } from "@/components/joindesk/LandingSection";
import { Dashboard } from "@/components/joindesk/Dashboard";
import { CreateDeskModal, type NewDeskInput } from "@/components/joindesk/CreateDeskModal";
import { JoinDeskModal } from "@/components/joindesk/JoinDeskModal";
import { deskFromApi, type Desk, type DeskApiRow } from "@/lib/joindesk";
import { loginWithGoogle, logout, restoreSession, type AppUser } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";

const PAGE_TITLE = "JoinDesk — Study & Work With Strangers Online | Find a Study Partner";
const PAGE_DESCRIPTION =
  "Free virtual desks where students, researchers, travelers, and professionals study or work alongside strangers in real time over Google Meet. Find a study partner or accountability buddy — no signup friction, no downloads.";

const FAQ_ITEMS = [
  {
    question: "What is JoinDesk?",
    answer:
      "JoinDesk is a free platform where you can study or work alongside strangers online. You join a virtual 'desk' — a live Google Meet session where everyone focuses quietly together, like sitting at the same table in a library or co-working space.",
  },
  {
    question: "Is it free to study with strangers on JoinDesk?",
    answer:
      "Yes. JoinDesk is completely free to use. Sign in with Google, browse open desks, and join or create one in seconds.",
  },
  {
    question: "Who uses JoinDesk?",
    answer:
      "Students preparing for exams, researchers who want to work alongside peers, remote professionals looking for accountability, travelers who want company while working from a new city, and anyone who focuses better with other people around.",
  },
  {
    question: "Do I need to download anything to join a study room?",
    answer:
      "No. JoinDesk runs entirely in your browser and connects you to a Google Meet call — there's nothing to install.",
  },
  {
    question: "How long do desks stay open?",
    answer:
      "Each desk automatically expires after 3 hours, so the list you browse always shows people who are actively online right now, not stale sessions.",
  },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: PAGE_TITLE },
      { name: "description", content: PAGE_DESCRIPTION },
      { property: "og:title", content: PAGE_TITLE },
      { property: "og:description", content: PAGE_DESCRIPTION },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ_ITEMS.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }),
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [desks, setDesks] = useState<Desk[]>([]);
  const [loadingDesks, setLoadingDesks] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTopic, setActiveTopic] = useState("All Desks");
  const [selectedDesk, setSelectedDesk] = useState<Desk | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  const PAGE_SIZE = 15;
  const isLoggedIn = !!user;

  // Restore session (if any) on first load.
  useEffect(() => {
    restoreSession()
      .then(setUser)
      .finally(() => setCheckingSession(false));
  }, []);

  // reset = true  -> fresh search/topic change, start again from offset 0
  // reset = false -> "load 15 more" triggered by scrolling to the bottom
  const loadDesks = async (opts: { reset: boolean; fromOffset: number }) => {
    const { reset, fromOffset } = opts;
    if (reset) setLoadingDesks(true);
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(fromOffset));
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (activeTopic !== "All Desks") params.set("topic", activeTopic);

      const { desks: rows, hasMore: more } = await api.get<{
        desks: DeskApiRow[];
        hasMore: boolean;
      }>(`/api/desks?${params.toString()}`);

      const mapped = rows.map(deskFromApi);
      setDesks((prev) => (reset ? mapped : [...prev, ...mapped]));
      setHasMore(more);
      setOffset(fromOffset + mapped.length);
    } catch (err) {
      toast.error("Couldn't load desks. Is the backend running?");
    } finally {
      setLoadingDesks(false);
      setLoadingMore(false);
    }
  };

  // Fetch desks once logged in, and re-fetch from the backend whenever the
  // search text or topic changes (debounced so we don't call the API on
  // every keystroke). Always resets back to the first page of 15.
  useEffect(() => {
    if (!isLoggedIn) return;
    const delay = searchQuery ? 350 : 0;
    const handle = setTimeout(() => {
      loadDesks({ reset: true, fromOffset: 0 });
    }, delay);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, searchQuery, activeTopic]);

  // Called when the user scrolls to the bottom of the desk grid.
  const loadMore = () => {
    if (loadingDesks || loadingMore || !hasMore) return;
    loadDesks({ reset: false, fromOffset: offset });
  };

  const handleLogin = async () => {
    try {
      const loggedInUser = await loginWithGoogle();
      setUser(loggedInUser);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't sign in with Google.";
      toast.error(message);
    }
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setDesks([]);
    setOffset(0);
    setHasMore(true);
  };

  const handleCreate = async (input: NewDeskInput) => {
    try {
      const { desk } = await api.post<{ desk: DeskApiRow }>("/api/desks", {
        title: input.title,
        description: input.description,
        google_meet_link: input.meetLink,
        topic: activeTopic === "All Desks" ? "Research" : activeTopic,
      });
      setDesks((prev) => [deskFromApi(desk), ...prev]);
      setOffset((prev) => prev + 1);
      setIsCreateModalOpen(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to create desk.";
      toast.error(message);
    }
  };

  const openJoin = (desk: Desk) => {
    setSelectedDesk(desk);
    setIsJoinModalOpen(true);
  };

  if (checkingSession) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar
        isLoggedIn={isLoggedIn}
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onCreate={() => setIsCreateModalOpen(true)}
      />

      <main>
        {isLoggedIn ? (
          <Dashboard
            desks={desks}
            loading={loadingDesks}
            loadingMore={loadingMore}
            hasMore={hasMore}
            onLoadMore={loadMore}
            activeTopic={activeTopic}
            onTopicChange={setActiveTopic}
            onJoin={openJoin}
            onCreate={() => setIsCreateModalOpen(true)}
          />
        ) : (
          <LandingSection onLogin={handleLogin} faqItems={FAQ_ITEMS} />
        )}
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        JoinDesk — desks auto-expire after 3 hours to keep listings fresh.
      </footer>

      <CreateDeskModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreate}
      />
      <JoinDeskModal
        open={isJoinModalOpen}
        desk={selectedDesk}
        onClose={() => setIsJoinModalOpen(false)}
      />
    </div>
  );
}
