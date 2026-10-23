import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { getMyBlockedUsers, getMyFollowing, unblockUser, unfollowUser } from "@/lib/users";

type Person = { id: string; name: string; avatar_url: string | null };

/**
 * Two small lists on your own profile: the people you follow (you get a
 * notification when they open a desk) and the people you've blocked (they can't
 * see or join your desks). Loaded only when opened.
 */
export function PeopleLists() {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      <List
        title="People you follow"
        empty="You don't follow anyone yet. Open someone's profile and tap Follow to get a notification when they open a desk."
        load={() => getMyFollowing().then((r) => r.following)}
        actionLabel="Unfollow"
        onAction={unfollowUser}
      />
      <List
        title="People you blocked"
        empty="Nobody. Blocked people can't see your desks or join them."
        load={() => getMyBlockedUsers().then((r) => r.blocked)}
        actionLabel="Unblock"
        onAction={unblockUser}
      />
    </div>
  );
}

function List({
  title,
  empty,
  load,
  actionLabel,
  onAction,
}: {
  title: string;
  empty: string;
  load: () => Promise<Person[]>;
  actionLabel: string;
  onAction: (id: string) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !people) {
      load()
        .then(setPeople)
        .catch(() => toast.error("Couldn't load this list."));
    }
  };

  const act = async (p: Person) => {
    setBusy(p.id);
    try {
      await onAction(p.id);
      setPeople((prev) => (prev ? prev.filter((x) => x.id !== p.id) : prev));
    } catch {
      toast.error("That didn't go through. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <button onClick={toggle} className="flex w-full items-center justify-between text-left">
        <span className="text-sm font-bold">
          {title}
          {people ? ` (${people.length})` : ""}
        </span>
        <ChevronDown className={"h-4 w-4 text-muted-foreground transition-transform " + (open ? "rotate-180" : "")} />
      </button>
      {open && (
        <div className="mt-3">
          {!people ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : people.length === 0 ? (
            <p className="text-xs leading-relaxed text-muted-foreground">{empty}</p>
          ) : (
            <ul className="space-y-2">
              {people.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-muted text-xs font-semibold uppercase text-muted-foreground">
                      {p.name.slice(0, 1)}
                    </span>
                  )}
                  <Link
                    to="/profile/$id"
                    params={{ id: p.id }}
                    className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                  >
                    {p.name}
                  </Link>
                  <button
                    onClick={() => act(p)}
                    disabled={busy === p.id}
                    className="rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    {actionLabel}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
