import { useState } from "react";
import { MessageSquareWarning } from "lucide-react";
import { DeskGrid } from "./DeskGrid";
import { EmptyState } from "./EmptyState";
import { SpecialDeskRow } from "./SpecialDeskRow";
import { FeedbackModal } from "./FeedbackModal";
import { type Desk } from "@/lib/joindesk";

type Props = {
  desks: Desk[];
  loading?: boolean | undefined;
  loadingMore?: boolean | undefined;
  hasMore?: boolean | undefined;
  onLoadMore?: (() => void) | undefined;
  activeTopic: string;
  onTopicChange: (t: string) => void;
  onJoin: (d: Desk) => void;
  onCreate: () => void;
  currentUserId?: string | null | undefined;
  onViewJoiners?: ((d: Desk) => void) | undefined;
  specialDesks?: Desk[];
  loadingSpecial?: boolean;
};

export function Dashboard({
  desks,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  onJoin,
  onCreate,
  currentUserId,
  onViewJoiners,
  specialDesks = [],
  loadingSpecial,
}: Props) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <section className="relative mx-auto max-w-6xl px-4 py-10">
      <div className="pointer-events-none absolute -top-28 right-0 h-72 w-72 rounded-full bg-aurora blur-3xl" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Active desks</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
             "Late-night study session from 10 PM to 12 AM. Join us and study with people who share the same goals!"
            </p>
          </div>
          <button
            onClick={() => setFeedbackOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground shadow-soft transition-colors hover:bg-muted hover:text-foreground sm:text-sm"
          >
            <MessageSquareWarning className="h-4 w-4" />
            <span className="hidden sm:inline">Suggestions & Complaints</span>
            <span className="sm:hidden">Feedback</span>
          </button>
        </div>

        <div className="mt-8">
          <SpecialDeskRow desks={specialDesks} loading={loadingSpecial} onJoin={onJoin} />
        </div>

        <div className="mt-8">
          <DeskGrid
            desks={desks}
            loading={loading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            onLoadMore={onLoadMore}
            onJoin={onJoin}
            currentUserId={currentUserId}
            onViewJoiners={onViewJoiners}
            emptyState={<EmptyState onCreate={onCreate} />}
          />
        </div>
      </div>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </section>
  );
}
