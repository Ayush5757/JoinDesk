import { useEffect, useRef } from "react";
import { DeskCard } from "./DeskCard";
import { EmptyState } from "./EmptyState";
import { type Desk } from "@/lib/joindesk";

type Props = {
  desks: Desk[];
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  activeTopic: string;
  onTopicChange: (t: string) => void;
  onJoin: (d: Desk) => void;
  onCreate: () => void;
};

export function Dashboard({
  desks,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  activeTopic,
  onTopicChange,
  onJoin,
  onCreate,
}: Props) {
  // Invisible marker at the bottom of the grid. When it scrolls into view,
  // we ask the parent (routes/index.tsx) to fetch the next 15 desks.
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!onLoadMore || !hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: "250px" } // start loading a bit before the user hits the bottom
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore, desks.length]);

  return (
    <section className="relative mx-auto max-w-6xl px-4 py-10">
      <div className="pointer-events-none absolute -top-28 right-0 h-72 w-72 rounded-full bg-aurora blur-3xl" />
      <div className="relative">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Active desks</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Pick a desk, agree to the desk rules, and get straight to work.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {/* {topics.map((t) => {
            const active = t === activeTopic;
            return (
              <button
                key={t}
                onClick={() => onTopicChange(t)}
                className={
                  "rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 " +
                  (active
                    ? "bg-foreground text-background shadow-soft"
                    : "border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground")
                }
              >
                {t}
              </button>
            );
          })} */}
        </div>

        <div className="mt-8">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading desks…</p>
          ) : desks.length === 0 ? (
            <EmptyState onCreate={onCreate} />
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {desks.map((d) => (
                  <DeskCard key={d.id} desk={d} onJoin={onJoin} />
                ))}
              </div>

              {/* Scroll sentinel — fetches the next 15 desks when it enters view */}
              <div ref={sentinelRef} className="h-1" />

              {loadingMore && (
                <p className="mt-6 text-center text-sm text-muted-foreground">
                  Loading more desks…
                </p>
              )}
              {!hasMore && (
                <p className="mt-6 text-center text-xs text-muted-foreground">
                  You've reached the end — that's all the active desks right now.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
