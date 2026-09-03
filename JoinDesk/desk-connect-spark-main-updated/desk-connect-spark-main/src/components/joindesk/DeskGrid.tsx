import { useEffect, useRef } from "react";
import { DeskCard } from "./DeskCard";
import { EmptyState } from "./EmptyState";
import { type Desk } from "@/lib/joindesk";

type Props = {
  desks: Desk[];
  loading?: boolean | undefined;
  loadingMore?: boolean | undefined;
  hasMore?: boolean | undefined;
  onLoadMore?: (() => void) | undefined;
  onJoin: (d: Desk) => void;
  currentUserId?: string | null | undefined;
  onViewJoiners?: ((d: Desk) => void) | undefined;
  onEdit?: ((d: Desk) => void) | undefined;
  onDelete?: ((d: Desk) => void) | undefined;
  onToggleHide?: ((d: Desk) => void) | undefined;
  emptyState?: React.ReactNode;
};

/**
 * Grid of desk cards with infinite scroll via IntersectionObserver. Shared
 * between the main Dashboard (all active desks) and a user's Profile page
 * (just their own desks) so both stay visually and behaviorally identical.
 */
export function DeskGrid({
  desks,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  onJoin,
  currentUserId,
  onViewJoiners,
  onEdit,
  onDelete,
  onToggleHide,
  emptyState,
}: Props) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!onLoadMore || !hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: "250px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore, desks.length]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading desks…</p>;
  }

  if (desks.length === 0) {
    return <>{emptyState ?? <p className="text-sm text-muted-foreground">Nothing here yet.</p>}</>;
  }

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {desks.map((d) => (
          <DeskCard
            key={d.id}
            desk={d}
            onJoin={onJoin}
            isOwn={Boolean(currentUserId) && d.creatorId === currentUserId}
            onViewJoiners={onViewJoiners}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleHide={onToggleHide}
          />
        ))}
      </div>

      <div ref={sentinelRef} className="h-1" />

      {loadingMore && (
        <p className="mt-6 text-center text-sm text-muted-foreground">Loading more desks…</p>
      )}
      {/* {!hasMore && (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          You've reached the end — that's all there is right now.
        </p>
      )} */}
    </>
  );
}
