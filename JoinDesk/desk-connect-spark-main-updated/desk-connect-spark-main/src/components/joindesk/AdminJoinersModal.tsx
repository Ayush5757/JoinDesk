import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Search, ShieldBan, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/joindesk/Modal";
import { adminGetDeskJoiners, adminBlockUser, adminUnblockUser } from "@/lib/admin";
import { type Joiner } from "@/lib/users";

export function AdminJoinersModal({
  open,
  deskId,
  onClose,
}: {
  open: boolean;
  deskId: string | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [deskTitle, setDeskTitle] = useState("");
  const [joiners, setJoiners] = useState<Joiner[]>([]);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !deskId) return;
    setSearch("");
    load(deskId, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deskId]);

  useEffect(() => {
    if (!open || !deskId) return;
    const handle = setTimeout(() => load(deskId, search), 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const load = async (id: string, q: string) => {
    setLoading(true);
    try {
      const { deskTitle: title, joiners: rows } = await adminGetDeskJoiners(id, q);
      setDeskTitle(title);
      setJoiners(rows);
    } catch {
      toast.error("Couldn't load who joined this desk.");
    } finally {
      setLoading(false);
    }
  };

  const togglePlatformBlock = async (user: Joiner) => {
    setBusyId(user.id);
    try {
      if (user.isPlatformBlocked) {
        await adminUnblockUser(user.id);
        toast.success(`Unblocked ${user.name}.`);
      } else {
        await adminBlockUser(user.id);
        toast.success(`Blocked ${user.name}. They can no longer use JoinDesk.`);
      }
      setJoiners((prev) =>
        prev.map((j) => (j.id === user.id ? { ...j, isPlatformBlocked: !j.isPlatformBlocked } : j))
      );
    } catch {
      toast.error("That didn't go through. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-special" />
        <h2 className="pr-8 text-lg font-bold tracking-tight">People who joined</h2>
      </div>
      {deskTitle && <p className="mt-1 truncate text-sm text-muted-foreground">{deskTitle}</p>}
      <p className="mt-1 text-xs text-muted-foreground">
        Admin view — block here is a platform-wide ban, not a personal block.
      </p>

      <div className="mt-4 flex items-center gap-2 rounded-full border border-border bg-muted/60 px-4 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : joiners.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {search ? "No one matches that search." : "No one has joined this desk yet."}
          </p>
        ) : (
          joiners.map((j) => (
            <div
              key={j.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
            >
              <img
                src={j.avatar_url || undefined}
                alt={j.name}
                className="h-9 w-9 shrink-0 rounded-full bg-muted object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{j.name}</p>
                <p className="truncate text-xs text-muted-foreground">{j.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Link
                  to="/profile/$id"
                  params={{ id: j.id }}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open profile in a new tab"
                  className="grid h-8 w-8 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => togglePlatformBlock(j)}
                  disabled={busyId === j.id}
                  title={j.isPlatformBlocked ? "Unblock platform-wide" : "Block platform-wide"}
                  className={
                    "inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold transition-colors disabled:opacity-50 " +
                    (j.isPlatformBlocked
                      ? "border-border bg-card text-muted-foreground hover:bg-muted"
                      : "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20")
                  }
                >
                  {j.isPlatformBlocked ? (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5" /> Unblock
                    </>
                  ) : (
                    <>
                      <ShieldBan className="h-3.5 w-3.5" /> Block
                    </>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
