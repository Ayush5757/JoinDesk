import { PageLoader } from "@/components/studywithstrangers/PageLoader";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useState } from "react";
import { toast } from "sonner";
import { Navbar } from "@/components/studywithstrangers/Navbar";
import { LandingSection } from "@/components/studywithstrangers/LandingSection";
import { Dashboard } from "@/components/studywithstrangers/Dashboard";
import { CreateDeskModal, type NewDeskInput } from "@/components/studywithstrangers/CreateDeskModal";
import { DeskJoinModal } from "@/components/studywithstrangers/DeskJoinModal";
import { JoinersModal } from "@/components/studywithstrangers/JoinersModal";
import { BlockedScreen } from "@/components/studywithstrangers/BlockedScreen";
import { deskFromApi, type Desk, type DeskApiRow } from "@/lib/deskModel";
import { AUTH_TOKEN_KEY, loginWithGoogle, logout, readCachedUser, restoreSession, BlockedError, type AppUser } from "@/lib/auth";
import { SEO_PAGES } from "@/lib/seoPages";
import { enablePushNotifications } from "@/lib/push";
import { getSpecialDesksPage } from "@/lib/desks";
import { getAnnouncement } from "@/lib/settings";
import { api, ApiError } from "@/lib/api";

const SPECIAL_PREVIEW_COUNT = 10;

const PAGE_TITLE = "StudyWithStrangers: Study With People Online & Find a Study Partner";
const PAGE_DESCRIPTION =
  "Study with strangers online in free virtual study rooms. Find a study partner, talk to focused people and improve your study with a focus timer.";

const FAQ_ITEMS = [
  {
    question: "What is StudyWithStrangers?",
    answer:
      "StudyWithStrangers is a free platform where you can study or work alongside strangers online. You join a virtual 'desk' — a live Google Meet session where everyone focuses quietly together, like sitting at the same table in a library or co-working space.",
  },
  {
    question: "Is it free to study with strangers on StudyWithStrangers?",
    answer:
      "Yes. StudyWithStrangers is completely free to use. Sign in with Google, browse open desks, and join or create one in seconds.",
  },
  {
    question: "Who uses StudyWithStrangers?",
    answer:
      "Students preparing for exams, researchers who want to work alongside peers, remote professionals looking for accountability, travelers who want company while working from a new city, and anyone who focuses better with other people around.",
  },
  {
    question: "Do I need to download anything to join a study room?",
    answer:
      "No. StudyWithStrangers runs entirely in your browser and connects you to a Google Meet call — there's nothing to install.",
  },
  {
    question: "How can I study with strangers online?",
    answer:
      "Sign in with Google, open a live desk that matches your subject, and join its video call. Stay on mute, keep your camera on or off, and work. You can also create your own desk in a few seconds.",
  },
  {
    question: "Can I talk to strangers and find a study partner here?",
    answer:
      "Yes. Use Random Chat for a 1-on-1 video chat, or join a desk and say hello. If you click with someone, study at the same time again and follow the desk's creator to get notified when they open a new desk.",
  },
  {
    question: "How can I improve my study with StudyWithStrangers?",
    answer:
      "Studying next to other people makes it easier to start and keep going. Add the free Pomodoro Focus Timer to work in timed blocks, and use the Study Tracker to set goals and see your study history.",
  },
  {
    question: "What is a virtual study room?",
    answer:
      "A virtual study room is a live online space where people study at the same time, usually on a video call with cameras optional. On StudyWithStrangers these rooms are called desks.",
  },
  {
    question: "How long do desks stay open?",
    answer:
      "Each desk stays up for 3 hours, so the list you browse always shows people who are online right now, not stale sessions. Its creator can reuse it for another 3 hours any time.",
  },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: PAGE_TITLE },
      { name: "description", content: PAGE_DESCRIPTION },
      { property: "og:title", content: PAGE_TITLE },
      { property: "og:description", content: PAGE_DESCRIPTION },
      { property: "og:url", content: "https://www.studywithstrangers.com/" },
    ],
    links: [{ rel: "canonical", href: "https://www.studywithstrangers.com/" }],
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
  // Starts false on purpose: the server (and search engines) must receive the full landing page, not a
  // loading spinner. Returning visitors are switched to the signed-in view before the first paint below.
  const [checkingSession, setCheckingSession] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
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
  const [viewJoinersDeskId, setViewJoinersDeskId] = useState<string | null>(null);
  const [specialDesks, setSpecialDesks] = useState<Desk[]>([]);
  const [loadingSpecial, setLoadingSpecial] = useState(false);
  const [slowFirstLoad, setSlowFirstLoad] = useState(false);
  const [announcement, setAnnouncement] = useState<string | null>(null);

  const PAGE_SIZE = 15;
  const isLoggedIn = !!user;

  // Runs before the browser paints, so a returning visitor never sees the landing page flash by.
  useLayoutEffect(() => {
    const cached = readCachedUser();
    if (cached) setUser(cached);
    else if (localStorage.getItem(AUTH_TOKEN_KEY)) setCheckingSession(true);
  }, []);

  // Restore session (if any) on first load.
  useEffect(() => {
    restoreSession()
      .then((restoredUser) => {
        setUser(restoredUser);
        // Best-effort: silently asks for notification permission and
        // subscribes this device if the user hasn't already. Powers the
        // free push notifications "Special" users get on new desks.
        if (restoredUser) enablePushNotifications();
      })
      .catch((err) => {
        if (err instanceof BlockedError) setIsBlocked(true);
      })
      .finally(() => setCheckingSession(false));
  }, []);

  // The site-wide notice banner an admin can set — independent of desks,
  // fails silently so a missing/broken announcement never blocks the
  // dashboard from loading.
  useEffect(() => {
    if (!isLoggedIn) return;
    getAnnouncement()
      .then(setAnnouncement)
      .catch(() => setAnnouncement(null));
  }, [isLoggedIn]);

  // The horizontal "Special Desks" preview row at the top of the
  // dashboard — a small, fixed-size slice, independent of the main
  // paginated desk grid below it.
  useEffect(() => {
    if (!isLoggedIn) return;
    setLoadingSpecial(true);
    getSpecialDesksPage(SPECIAL_PREVIEW_COUNT, 0)
      .then(({ desks: rows }) => setSpecialDesks(rows))
      .catch(() => {
        /* Non-critical — the dashboard still works without the preview row. */
      })
      .finally(() => setLoadingSpecial(false));
  }, [isLoggedIn]);

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
      // A new desk can appear while someone scrolls (pages are cut by position), so never show one twice.
      setDesks((prev) => {
        if (reset) return mapped;
        const seen = new Set(prev.map((d) => d.id));
        return [...prev, ...mapped.filter((d) => !seen.has(d.id))];
      });
      setHasMore(more);
      setOffset(fromOffset + mapped.length);
    } catch (err) {
      toast.error("Couldn't load desks. Is the backend running?");
    } finally {
      setLoadingDesks(false);
      setLoadingMore(false);
    }
  };

  // If the very first load takes unusually long (a serverless cold start on
  // the backend, most likely), let the person know what's happening after
  // a few seconds instead of leaving them staring at a stuck-looking
  // skeleton with no explanation.
  useEffect(() => {
    if (!loadingDesks || desks.length > 0) {
      setSlowFirstLoad(false);
      return;
    }
    const handle = setTimeout(() => setSlowFirstLoad(true), 4000);
    return () => clearTimeout(handle);
  }, [loadingDesks, desks.length]);

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
      // Best-effort: shows the native "Allow notifications?" popup and
      // subscribes this device if granted.
      enablePushNotifications();
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
    setDesks([]);
    setOffset(0);
    setHasMore(true);
    setSpecialDesks([]);
  };

  const handleCreate = async (input: NewDeskInput) => {
    try {
      const { desk } = await api.post<{ desk: DeskApiRow }>("/api/desks", {
        title: input.title,
        subject: input.subject,
        description: input.description,
        google_meet_link: input.meetLink,
        topic: activeTopic === "All Desks" ? "Research" : activeTopic,
      });
      setDesks((prev) => [deskFromApi(desk), ...prev]);
      setOffset((prev) => prev + 1);
      setIsCreateModalOpen(false);
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to create desk.";
      toast.error(message);
      return false;
    }
  };

  const openJoin = (desk: Desk) => {
    setSelectedDesk(desk);
    setIsJoinModalOpen(true);
  };

  if (checkingSession) {
    return <PageLoader />;
  }

  if (isBlocked) {
    return <BlockedScreen />;
  }

  return (
    <>
    {/* Signed-in people get the placeholder below instead of this page until the app has loaded. */}
    <div className={"min-h-screen bg-background text-foreground" + (isLoggedIn ? "" : " landing-only")}>
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
            currentUserId={user?.id}
            onViewJoiners={(d) => setViewJoinersDeskId(d.id)}
            specialDesks={specialDesks}
            loadingSpecial={loadingSpecial}
            announcement={announcement}
            slowFirstLoad={slowFirstLoad}
          />
        ) : (
          <LandingSection onLogin={handleLogin} faqItems={FAQ_ITEMS} />
        )}
      </main>

      <footer className="border-t border-border/60 px-4 py-8 text-center text-xs text-muted-foreground">
        <nav aria-label="Guides" className="mb-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
          {SEO_PAGES.map((p) => (
            <a key={p.slug} href={p.path} className="font-medium text-foreground/80 hover:text-primary hover:underline">
              {p.label}
            </a>
          ))}
          <Link to="/special" className="font-medium text-foreground/80 hover:text-primary hover:underline">
            Special desks
          </Link>
          <Link to="/pomodoro" className="font-medium text-foreground/80 hover:text-primary hover:underline">
            Focus timer
          </Link>
        </nav>
        StudyWithStrangers — desks stay up for 3 hours to keep listings fresh.
      </footer>

      <CreateDeskModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreate}
      />
      <DeskJoinModal
        open={isJoinModalOpen}
        desk={selectedDesk}
        onClose={() => setIsJoinModalOpen(false)}
      />
      <JoinersModal
        open={Boolean(viewJoinersDeskId)}
        deskId={viewJoinersDeskId}
        onClose={() => setViewJoinersDeskId(null)}
      />
    </div>
    {!isLoggedIn && (
      <div className="session-splash">
        <PageLoader />
      </div>
    )}
    </>
  );
}
