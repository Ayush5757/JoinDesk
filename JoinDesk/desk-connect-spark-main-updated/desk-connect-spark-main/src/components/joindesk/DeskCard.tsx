import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Eye, EyeOff, Pencil, Sparkles, Trash2, Users } from "lucide-react";
import { relativeTime, type Desk } from "@/lib/joindesk";

export function DeskCard({
  desk,
  onJoin,
  isOwn,
  onViewJoiners,
  onEdit,
  onDelete,
  onToggleHide,
}: {
  desk: Desk;
  onJoin: (d: Desk) => void;
  isOwn?: boolean | undefined;
  onViewJoiners?: ((d: Desk) => void) | undefined;
  onEdit?: ((d: Desk) => void) | undefined;
  onDelete?: ((d: Desk) => void) | undefined;
  onToggleHide?: ((d: Desk) => void) | undefined;
}) {
  const hasOwnerActions = isOwn && (onViewJoiners || onEdit || onDelete || onToggleHide);
  const isSpecial = desk.isSpecial;

  return (
    <article
      className={
        "group flex flex-col rounded-3xl border p-5 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-glow " +
        (isSpecial ? "border-special/30 bg-special-soft/40" : "border-border bg-card") +
        (desk.isHidden ? " opacity-60" : "")
      }
    >
      <div className="flex items-center justify-between gap-2">
        {isSpecial ? (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-special-gradient px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
            <Sparkles className="h-3 w-3" />
            Special Desk
          </span>
        ) : (
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
              <p className="truncate text-xs text-muted-foreground">
                {relativeTime(desk.createdAt)}
              </p>
            </div>
          </Link>
        )}
        {desk.isHidden && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
            Hidden
          </span>
        )}
      </div>

      {isSpecial ? (
        <p className="mt-4 text-[11px] font-medium text-special">By JoinDesk · Always available</p>
      ) : (
        <span className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-medium text-success">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          Active Desk (15d max)
        </span>
      )}

      <h3 className="mt-3 text-base font-semibold leading-snug tracking-tight">{desk.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
        {desk.description || "No description provided."}
      </p>

      <div className="mt-5 flex items-center gap-2">
        <button
          onClick={() => onJoin(desk)}
          className={
            "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] " +
            (isSpecial ? "bg-special-gradient" : "bg-brand-gradient")
          }
        >
          Join Desk
          <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>
      </div>

      {hasOwnerActions && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {onViewJoiners && (
            <button
              onClick={() => onViewJoiners(desk)}
              title="View who joined"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Users className="h-3.5 w-3.5" />
              Joiners
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(desk)}
              title="Edit this desk"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          )}
          {onToggleHide && (
            <button
              onClick={() => onToggleHide(desk)}
              title={desk.isHidden ? "Unhide from dashboard" : "Hide from dashboard"}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {desk.isHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {desk.isHidden ? "Unhide" : "Hide"}
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(desk)}
              title="Delete this desk"
              className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
        </div>
      )}
    </article>
  );
}
