import { ArrowUpRight } from "lucide-react";
import { relativeTime, type Desk } from "@/lib/joindesk";

export function DeskCard({ desk, onJoin }: { desk: Desk; onJoin: (d: Desk) => void }) {
  return (
    <article className="group flex flex-col rounded-3xl border border-border bg-card p-5 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-glow">
      <div className="flex min-w-0 items-center gap-3">
        <img
          src={desk.creatorAvatar}
          alt={desk.creatorName}
          className="h-9 w-9 shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{desk.creatorName}</p>
          <p className="truncate text-xs text-muted-foreground">{relativeTime(desk.createdAt)}</p>
        </div>
      </div>

      <span className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-medium text-success">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        Active Desk (3h max)
      </span>

      <h3 className="mt-3 text-base font-semibold leading-snug tracking-tight">{desk.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
        {desk.description || "No description provided."}
      </p>

      <button
        onClick={() => onJoin(desk)}
        className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
      >
        Join Desk
        <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </button>
    </article>
  );
}
