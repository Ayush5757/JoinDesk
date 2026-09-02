import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Pencil, Users } from "lucide-react";
import { relativeTime, type Desk } from "@/lib/joindesk";

export function DeskCard({
  desk,
  onJoin,
  isOwn,
  onViewJoiners,
  onEdit,
}: {
  desk: Desk;
  onJoin: (d: Desk) => void;
  isOwn?: boolean | undefined;
  onViewJoiners?: ((d: Desk) => void) | undefined;
  onEdit?: ((d: Desk) => void) | undefined;
}) {
  return (
    <article className="group flex flex-col rounded-3xl border border-border bg-card p-5 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-glow">
      <Link
        to="/profile/$id"
        params={{ id: desk.creatorId }}
        className="flex min-w-0 items-center gap-3 rounded-xl transition-opacity hover:opacity-80"
        title={`View ${desk.creatorName}'s profile`}
      >
        <img
          src={desk.creatorAvatar}
          alt={desk.creatorName}
          className="h-9 w-9 shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{desk.creatorName}</p>
          <p className="truncate text-xs text-muted-foreground">{relativeTime(desk.createdAt)}</p>
        </div>
      </Link>

      <span className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-medium text-success">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        Active Desk (15d max)
      </span>

      <h3 className="mt-3 text-base font-semibold leading-snug tracking-tight">{desk.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
        {desk.description || "No description provided."}
      </p>

      <div className="mt-5 flex items-center gap-2">
        <button
          onClick={() => onJoin(desk)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
        >
          Join Desk
          <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>
        {isOwn && onViewJoiners && (
          <button
            onClick={() => onViewJoiners(desk)}
            title="View who joined"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Users className="h-4 w-4" />
          </button>
        )}
        {isOwn && onEdit && (
          <button
            onClick={() => onEdit(desk)}
            title="Edit this desk"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>
    </article>
  );
}
