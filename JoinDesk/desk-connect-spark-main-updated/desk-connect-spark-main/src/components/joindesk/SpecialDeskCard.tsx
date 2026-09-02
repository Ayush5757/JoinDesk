import { ArrowUpRight, Sparkles } from "lucide-react";
import { type Desk } from "@/lib/joindesk";

/**
 * Deliberately smaller and visually distinct from the normal DeskCard —
 * gold/amber accents, a "Special" badge instead of the creator row (the
 * admin's identity is never shown here, only "JoinDesk"), and no 15-day
 * badge since these desks don't expire.
 */
export function SpecialDeskCard({ desk, onJoin }: { desk: Desk; onJoin: (d: Desk) => void }) {
  return (
    <article className="group flex w-64 shrink-0 flex-col rounded-2xl border border-special/30 bg-special-soft/40 p-4 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-glow sm:w-72">
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-special-gradient px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
        <Sparkles className="h-3 w-3" />
        Special Desk
      </span>

      <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-snug tracking-tight">
        {desk.title}
      </h3>
      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {desk.description || "No description provided."}
      </p>

      <p className="mt-2 text-[11px] font-medium text-special">By JoinDesk · Always available</p>

      <button
        onClick={() => onJoin(desk)}
        className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-full bg-special-gradient px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
      >
        Join Desk
        <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </button>
    </article>
  );
}
