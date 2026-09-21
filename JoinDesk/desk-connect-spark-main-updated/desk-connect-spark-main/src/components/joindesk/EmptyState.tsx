import { Plus, Coffee } from "lucide-react";

export function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-dashed border-border bg-card/60 px-6 py-14 text-center shadow-soft backdrop-blur">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-aurora shadow-soft">
        <Coffee className="h-7 w-7 text-primary" />
      </div>
      <p className="mt-5 text-base font-semibold">No active desks right now.</p>
      <p className="mt-1 text-sm text-muted-foreground">Be the first to create one!</p>
      <button
        onClick={onCreate}
        className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-transform duration-200 hover:scale-[1.03]"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        Create Desk
      </button>
    </div>
  );
}
