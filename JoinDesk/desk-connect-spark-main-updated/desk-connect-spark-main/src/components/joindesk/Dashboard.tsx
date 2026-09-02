import { DeskGrid } from "./DeskGrid";
import { EmptyState } from "./EmptyState";
import { SpecialDeskRow } from "./SpecialDeskRow";
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
  return (
    <section className="relative mx-auto max-w-6xl px-4 py-10">
      <div className="pointer-events-none absolute -top-28 right-0 h-72 w-72 rounded-full bg-aurora blur-3xl" />
      <div className="relative">
        <SpecialDeskRow desks={specialDesks} loading={loadingSpecial} onJoin={onJoin} />

        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Active desks</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Pick a desk, agree to the desk rules, and get straight to work.
        </p>

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
    </section>
  );
}
