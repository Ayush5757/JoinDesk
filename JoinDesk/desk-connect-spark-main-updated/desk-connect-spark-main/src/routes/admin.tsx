import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Lock,
  Plus,
  Pencil,
  Trash2,
  Search,
  Sparkles,
  ShieldBan,
  ShieldCheck,
  LayoutGrid,
  Users as UsersIcon,
  ExternalLink,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Navbar } from "@/components/joindesk/Navbar";
import { BlockedScreen } from "@/components/joindesk/BlockedScreen";
import { AdminDeskModal, type AdminDeskFormValues } from "@/components/joindesk/AdminDeskModal";
import { AdminJoinersModal } from "@/components/joindesk/AdminJoinersModal";
import { loginWithGoogle, logout, restoreSession, BlockedError, type AppUser } from "@/lib/auth";
import { isAdminUnlocked, unlockAdmin, lockAdmin } from "@/lib/adminAuth";
import {
  adminListDesks,
  adminCreateDesk,
  adminUpdateDesk,
  adminDeleteDesk,
  adminListUsers,
  adminBlockUser,
  adminUnblockUser,
  type AdminUser,
} from "@/lib/admin";
import { relativeTime, type Desk } from "@/lib/joindesk";
import { ApiError } from "@/lib/api";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Panel — JoinDesk" }] }),
  component: AdminPage,
});

function AdminPage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    restoreSession()
      .then(setUser)
      .catch((err) => {
        if (err instanceof BlockedError) setIsBlocked(true);
      })
      .finally(() => setCheckingSession(false));
  }, []);

  const handleLogin = async () => {
    try {
      setUser(await loginWithGoogle());
    } catch (err) {
      if (err instanceof BlockedError) setIsBlocked(true);
    }
  };

  const handleLogout = () => {
    logout();
    setUser(null);
  };

  if (checkingSession) return <div className="min-h-screen bg-background" />;
  if (isBlocked) return <BlockedScreen />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar
        isLoggedIn={Boolean(user)}
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        searchQuery=""
        onSearchChange={() => {}}
        onCreate={() => {}}
        hideSearch
        hideCreate
      />
      <main className="mx-auto max-w-6xl px-4 py-10">
        {!user ? (
          <div className="mx-auto max-w-sm py-24 text-center">
            <p className="text-sm text-muted-foreground">Sign in to open the Admin Panel.</p>
          </div>
        ) : (
          <AdminGate />
        )}
      </main>
    </div>
  );
}

/** Shows the password prompt until unlocked, then the actual panel. */
function AdminGate() {
  const [unlocked, setUnlocked] = useState(isAdminUnlocked());
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (unlocked) return <AdminPanel onLock={() => { lockAdmin(); setUnlocked(false); }} />;

  const submit = async () => {
    if (!password) return;
    setSubmitting(true);
    setError("");
    try {
      await unlockAdmin(password);
      setUnlocked(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm py-20">
      <div className="grid h-14 w-14 place-items-center rounded-3xl bg-special-gradient text-primary-foreground shadow-glow">
        <Lock className="h-6 w-6" />
      </div>
      <h1 className="mt-5 text-2xl font-bold tracking-tight">Admin Panel</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Enter the admin password to manage Special desks and users.
      </p>

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Admin password"
        autoFocus
        className="mt-6 w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-special/50 focus:bg-card focus:shadow-soft"
      />
      {error && <p className="mt-2 text-xs font-medium text-destructive">{error}</p>}

      <button
        onClick={submit}
        disabled={submitting || !password}
        className="mt-4 w-full rounded-full bg-special-gradient px-5 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
      >
        {submitting ? "Checking…" : "Unlock"}
      </button>
    </div>
  );
}

function AdminPanel({ onLock }: { onLock: () => void }) {
  const [tab, setTab] = useState<"desks" | "users">("desks");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage Special desks and platform-wide user blocks.
          </p>
        </div>
        <button
          onClick={onLock}
          className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold transition-colors hover:bg-muted"
        >
          Lock Admin Panel
        </button>
      </div>

      <div className="mt-6 inline-flex rounded-full border border-border bg-muted/50 p-1">
        <button
          onClick={() => setTab("desks")}
          className={
            "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors " +
            (tab === "desks" ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground")
          }
        >
          <LayoutGrid className="h-4 w-4" /> Desks
        </button>
        <button
          onClick={() => setTab("users")}
          className={
            "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors " +
            (tab === "users" ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground")
          }
        >
          <UsersIcon className="h-4 w-4" /> Users
        </button>
      </div>

      <div className="mt-6">{tab === "desks" ? <AdminDesksTab /> : <AdminUsersTab />}</div>
    </div>
  );
}

function AdminDesksTab() {
  const [desks, setDesks] = useState<Desk[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "true" | "false">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Desk | null>(null);
  const [joinersDeskId, setJoinersDeskId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { desks: rows } = await adminListDesks({
        limit: 100,
        offset: 0,
        search,
        ...(filter !== "all" ? { special: filter } : {}),
      });
      setDesks(rows);
    } catch {
      toast.error("Couldn't load desks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handle = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filter]);

  const handleSave = async (values: AdminDeskFormValues) => {
    if (editing) {
      const updated = await adminUpdateDesk(editing.id, {
        title: values.title,
        description: values.description,
        meetLink: values.meetLink,
        topic: values.topic,
        isSpecial: values.isSpecial,
      });
      setDesks((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      toast.success("Desk updated.");
    } else {
      const created = await adminCreateDesk(values);
      setDesks((prev) => [created, ...prev]);
      toast.success("Desk created.");
    }
    setModalOpen(false);
    setEditing(null);
  };

  const handleDelete = async (desk: Desk) => {
    if (!confirm(`Delete "${desk.title}"? This can't be undone.`)) return;
    try {
      await adminDeleteDesk(desk.id);
      setDesks((prev) => prev.filter((d) => d.id !== desk.id));
      toast.success("Desk deleted.");
    } catch {
      toast.error("Couldn't delete that desk.");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-muted/60 px-4 py-2.5 sm:max-w-xs">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search desks…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="inline-flex rounded-full border border-border bg-muted/50 p-1 text-xs font-semibold">
          {(["all", "true", "false"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                "rounded-full px-3 py-1.5 transition-colors " +
                (filter === f ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground")
              }
            >
              {f === "all" ? "All" : f === "true" ? "Special" : "Normal"}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-special-gradient px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition-transform hover:scale-[1.03]"
        >
          <Plus className="h-4 w-4" /> New Desk
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading desks…</p>
        ) : desks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No desks match this filter.</p>
        ) : (
          desks.map((d) => (
            <div
              key={d.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {d.isSpecial && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-special-soft px-2 py-0.5 text-[10px] font-semibold text-special">
                      <Sparkles className="h-3 w-3" /> Special
                    </span>
                  )}
                  <h3 className="truncate text-sm font-semibold">{d.title}</h3>
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {d.description || "No description"} · {d.topic} · {relativeTime(d.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => setJoinersDeskId(d.id)}
                  title="View who joined"
                  className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <UsersIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setEditing(d);
                    setModalOpen(true);
                  }}
                  title="Edit"
                  className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(d)}
                  title="Delete"
                  className="grid h-9 w-9 place-items-center rounded-full border border-destructive/30 bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <AdminDeskModal
        open={modalOpen}
        desk={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />
      <AdminJoinersModal
        open={Boolean(joinersDeskId)}
        deskId={joinersDeskId}
        onClose={() => setJoinersDeskId(null)}
      />
    </div>
  );
}

function AdminUsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { users: rows } = await adminListUsers({ limit: 100, offset: 0, search });
      setUsers(rows);
    } catch {
      toast.error("Couldn't load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handle = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const toggleBlock = async (u: AdminUser) => {
    setBusyId(u.id);
    try {
      if (u.is_blocked) {
        await adminUnblockUser(u.id);
        setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_blocked: false } : x)));
        toast.success(`Unblocked ${u.name}.`);
      } else {
        await adminBlockUser(u.id);
        setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_blocked: true } : x)));
        toast.success(`Blocked ${u.name}. They can no longer log in or use JoinDesk.`);
      }
    } catch {
      toast.error("That didn't go through. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex max-w-xs items-center gap-2 rounded-full border border-border bg-muted/60 px-4 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading users…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users match that search.</p>
        ) : (
          users.map((u) => (
            <div
              key={u.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">
                  {u.avatar_url && (
                    <img src={u.avatar_url} alt={u.name} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{u.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
                {u.is_blocked && (
                  <span className="ml-2 shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                    Blocked
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  to="/profile/$id"
                  params={{ id: u.id }}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> View
                </Link>
                <button
                  onClick={() => toggleBlock(u)}
                  disabled={busyId === u.id}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-60 " +
                    (u.is_blocked
                      ? "border-border bg-card hover:bg-muted"
                      : "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20")
                  }
                >
                  {u.is_blocked ? (
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
    </div>
  );
}
