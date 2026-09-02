import { Link } from "@tanstack/react-router";
import { ChevronRight, Sparkles } from "lucide-react";
import { SpecialDeskCard } from "./SpecialDeskCard";
import { type Desk } from "@/lib/joindesk";

export function SpecialDeskRow({
  desks,
  loading,
  onJoin,
}: {
  desks: Desk[];
  loading?: boolean | undefined;
  onJoin: (d: Desk) => void;
}) {
  if (!loading && desks.length === 0) return null;

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-special-gradient text-primary-foreground">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-lg font-bold tracking-tight">Special Desks</h2>
        </div>
        <Link
          to="/special"
          className="inline-flex items-center gap-1 text-sm font-semibold text-special transition-opacity hover:opacity-80"
        >
          View all
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Long-running desks curated by JoinDesk — always open, never expire.
      </p>

      <div className="mt-4 -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
        {loading && desks.length === 0
          ? [1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 w-64 shrink-0 animate-pulse rounded-2xl bg-muted sm:w-72"
              />
            ))
          : desks.map((d) => <SpecialDeskCard key={d.id} desk={d} onJoin={onJoin} />)}
      </div>
    </div>
  );
}
