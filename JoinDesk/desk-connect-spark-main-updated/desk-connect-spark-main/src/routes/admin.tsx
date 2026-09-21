import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
  ChevronUp,
  ChevronDown,
  Users as UsersIcon,
  ExternalLink,
  MessageSquareWarning,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Mail,
  Megaphone,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Navbar } from "@/components/joindesk/Navbar";
import { BlockedScreen } from "@/components/joindesk/BlockedScreen";
import { AdminDeskModal, type AdminDeskFormValues } from "@/components/joindesk/AdminDeskModal";
import { AdminJoinersModal } from "@/components/joindesk/AdminJoinersModal";
import { loginWithGoogle, logout, restoreSession, BlockedError, type AppUser } from "@/lib/auth";
import { isAdminUnlocked, unlockAdmin, lockAdmin } from "@/lib/adminAuth";
import { getAnnouncement, adminSetAnnouncement } from "@/lib/settings";
import {
  adminListDesks,
  adminCreateDesk,
  adminUpdateDesk,
  adminDeleteDesk,
  adminListUsers,
  adminBlockUser,
  adminUnblockUser,
  adminListFeedback,
  adminUpdateFeedbackStatus,
  adminMoveSpecialDesk,
  adminSetSpecialDeskPosition,
  type AdminUser,
  type AdminFeedback,
  type FeedbackStatus,
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

  if (unlocked)
    return (
      <AdminPanel
        onLock={() => {
          lockAdmin();
          setUnlocked(false);
        }}
      />
    );

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
  const [tab, setTab] = useState<"desks" | "users" | "feedback" | "notice">("desks");

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

      <div className="mt-6 inline-flex flex-wrap rounded-full border border-border bg-muted/50 p-1">
        <button
          onClick={() => setTab("desks")}
          className={
            "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors " +
            (tab === "desks"
              ? "bg-card shadow-soft"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          <LayoutGrid className="h-4 w-4" /> Desks
        </button>
        <button
          onClick={() => setTab("users")}
          className={
            "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors " +
            (tab === "users"
              ? "bg-card shadow-soft"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          <UsersIcon className="h-4 w-4" /> Users
        </button>
        <button
          onClick={() => setTab("feedback")}
          className={
            "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors " +
            (tab === "feedback"
              ? "bg-card shadow-soft"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          <MessageSquareWarning className="h-4 w-4" /> Feedback
        </button>
        <button
          onClick={() => setTab("notice")}
          className={
            "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors " +
            (tab === "notice"
              ? "bg-card shadow-soft"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          <Megaphone className="h-4 w-4" /> Notice
        </button>
      </div>

      <div className="mt-6">
        {tab === "desks" ? (
          <AdminDesksTab />
        ) : tab === "users" ? (
          <AdminUsersTab />
        ) : tab === "feedback" ? (
          <AdminFeedbackTab />
        ) : (
          <AdminNoticeTab />
        )}
      </div>
    </div>
  );
}

/** The one site-wide message shown to every logged-in user, top of dashboard. */
function AdminNoticeTab() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAnnouncement()
      .then((current) => setMessage(current ?? ""))
      .catch(() => toast.error("Couldn't load the current notice."))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminSetAnnouncement(message);
      toast.success(message.trim() ? "Notice is live." : "Notice cleared.");
    } catch {
      toast.error("Couldn't save the notice. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl">
      <p className="text-sm text-muted-foreground">
        This message shows in a banner at the top of everyone's dashboard, on phone and desktop
        alike. Leave it empty and save to remove the banner for everyone.
      </p>
      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="e.g. Late-night study session from 10 PM to 12 AM. Join us!"
            className="mt-4 w-full resize-none rounded-2xl border border-border bg-muted/40 p-4 text-sm outline-none focus:border-primary/50 focus:bg-card"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save notice"}
            </button>
            {message.trim() && (
              <button
                onClick={() => setMessage("")}
                className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Clear text
              </button>
            )}
          </div>
        </>
      )}
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
  const [reorderBusyId, setReorderBusyId] = useState<string | null>(null);
  const [positionDraft, setPositionDraft] = useState<Record<string, string>>({});

  // Reordering (up/down + "jump to spot") only makes sense when we're
  // looking at just the Special desks in their real order — mixing
  // Special + Normal rows together has no single meaningful order.
  const reorderable = filter === "true" && !search;

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

  // Moves a Special desk up/down one spot. Re-fetches the list afterwards
  // so the on-screen order always matches what's actually saved — no
  // client-side guessing about the new order.
  const handleMove = async (desk: Desk, direction: "up" | "down") => {
    setReorderBusyId(desk.id);
    try {
      const { moved } = await adminMoveSpecialDesk(desk.id, direction);
      if (moved) await load();
    } catch {
      toast.error("Couldn't move that desk. Try again.");
    } finally {
      setReorderBusyId(null);
    }
  };

  // "Jump to spot" — admin types a number (2, 3, last, etc.) and the desk
  // moves straight there instead of clicking up/down repeatedly.
  const handleSetPosition = async (desk: Desk) => {
    const raw = positionDraft[desk.id];
    const wanted = parseInt(raw ?? "", 10);
    if (!Number.isFinite(wanted) || wanted < 1) {
      toast.error("Enter a spot number, like 1 or 3.");
      return;
    }
    setReorderBusyId(desk.id);
    try {
      await adminSetSpecialDeskPosition(desk.id, wanted);
      setPositionDraft((prev) => ({ ...prev, [desk.id]: "" }));
      await load();
      toast.success("Moved.");
    } catch {
      toast.error("Couldn't move that desk. Try again.");
    } finally {
      setReorderBusyId(null);
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
                (filter === f
                  ? "bg-card shadow-soft"
                  : "text-muted-foreground hover:text-foreground")
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

      {reorderable && desks.length > 1 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Yeh jo order neeche dikh raha hai, dashboard ke Special row mein bhi wahi order dikhega.
          Upar/neeche arrow se ek jagah move karo, ya "spot" box mein number daal ke seedha kisi bhi
          number pe le jao.
        </p>
      )}

      <div className="mt-6 space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading desks…</p>
        ) : desks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No desks match this filter.</p>
        ) : (
          desks.map((d, index) => (
            <div
              key={d.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between"
            >
              {reorderable && (
                <div className="flex shrink-0 items-center gap-1.5 sm:order-first">
                  <div className="flex flex-col overflow-hidden rounded-xl border border-border">
                    <button
                      onClick={() => handleMove(d, "up")}
                      disabled={reorderBusyId === d.id || index === 0}
                      title="Move up"
                      className="grid h-6 w-8 place-items-center border-b border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleMove(d, "down")}
                      disabled={reorderBusyId === d.id || index === desks.length - 1}
                      title="Move down"
                      className="grid h-6 w-8 place-items-center bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted/60 text-xs font-bold text-muted-foreground">
                    {index + 1}
                  </span>
                </div>
              )}

              <div className="min-w-0 flex-1">
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

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {reorderable && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={desks.length}
                      placeholder="Spot"
                      value={positionDraft[d.id] ?? ""}
                      onChange={(e) =>
                        setPositionDraft((prev) => ({ ...prev, [d.id]: e.target.value }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && handleSetPosition(d)}
                      className="h-9 w-16 rounded-full border border-border bg-muted/50 px-3 text-center text-xs outline-none focus:border-special/50 focus:bg-card"
                    />
                    <button
                      onClick={() => handleSetPosition(d)}
                      disabled={reorderBusyId === d.id || !positionDraft[d.id]}
                      className="rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Go
                    </button>
                  </div>
                )}
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

const FEEDBACK_PAGE_SIZE = 15;

const STATUS_META: Record<
  FeedbackStatus,
  { label: string; icon: typeof Clock; className: string }
> = {
  pending: {
    label: "Incomplete",
    icon: Clock,
    className: "bg-muted text-muted-foreground",
  },
  resolved: {
    label: "Complete",
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-600",
  },
  problem: {
    label: "Problem",
    icon: AlertTriangle,
    className: "bg-destructive/10 text-destructive",
  },
};

function AdminFeedbackTab() {
  const [items, setItems] = useState<AdminFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "suggestion" | "complaint">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | FeedbackStatus>("all");
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const load = async (offset: number, replace: boolean) => {
    if (replace) setLoading(true);
    else setLoadingMore(true);
    try {
      const { feedback, hasMore: more } = await adminListFeedback({
        limit: FEEDBACK_PAGE_SIZE,
        offset,
        ...(typeFilter !== "all" ? { type: typeFilter } : {}),
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      });
      setItems((prev) => (replace ? feedback : [...prev, ...feedback]));
      setHasMore(more);
    } catch {
      toast.error("Couldn't load feedback.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Reset to page 1 whenever a filter changes.
  useEffect(() => {
    load(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter]);

  // Infinite scroll — load the next 15 as the sentinel comes into view.
  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) load(items.length, false);
      },
      { rootMargin: "250px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, loadingMore, items.length]);

  const setStatus = async (item: AdminFeedback, status: FeedbackStatus) => {
    setBusyId(item.id);
    try {
      const updated = await adminUpdateFeedbackStatus(item.id, status);
      setItems((prev) => {
        // If the current status filter no longer matches, drop the row from
        // this view instead of showing it in the wrong bucket.
        if (statusFilter !== "all" && updated.status !== statusFilter) {
          return prev.filter((x) => x.id !== item.id);
        }
        return prev.map((x) => (x.id === item.id ? updated : x));
      });
      toast.success(`Marked ${STATUS_META[status].label}.`);
    } catch {
      toast.error("That didn't go through. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const filterChipClass = (active: boolean) =>
    "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors " +
    (active ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground");

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full border border-border bg-muted/50 p-1">
          {(["all", "suggestion", "complaint"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={filterChipClass(typeFilter === f)}
            >
              {f === "all" ? "All types" : f === "suggestion" ? "Suggestions" : "Complaints"}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-full border border-border bg-muted/50 p-1">
          {(["all", "pending", "resolved", "problem"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={filterChipClass(statusFilter === f)}
            >
              {f === "all" ? "All statuses" : STATUS_META[f].label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading feedback…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          items.map((item) => {
            const meta = STATUS_META[item.status];
            const StatusIcon = meta.icon;
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-soft"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize " +
                          (item.type === "complaint"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-info-soft text-info")
                        }
                      >
                        {item.type}
                      </span>
                      <span
                        className={
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                          meta.className
                        }
                      >
                        <StatusIcon className="h-3 w-3" /> {meta.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {relativeTime(new Date(item.created_at).getTime())}
                      </span>
                    </div>

                    <p className="mt-2 text-sm leading-relaxed">{item.message}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {item.reporter && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {item.reporter.name} ({item.reporter.email})
                        </span>
                      )}
                      {item.type === "complaint" && item.reported_name && (
                        <span className="inline-flex items-center gap-1">
                          <UsersIcon className="h-3 w-3" /> Reported: {item.reported_name}
                        </span>
                      )}
                      {item.type === "complaint" && item.reported_desk && (
                        <span className="inline-flex items-center gap-1">
                          <LayoutGrid className="h-3 w-3" /> Desk: {item.reported_desk.title}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {item.status !== "resolved" && (
                      <button
                        onClick={() => setStatus(item, "resolved")}
                        disabled={busyId === item.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Mark Complete
                      </button>
                    )}
                    {item.status === "pending" && (
                      <button
                        onClick={() => setStatus(item, "problem")}
                        disabled={busyId === item.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-60"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" /> Mark Problem
                      </button>
                    )}
                    {item.status !== "pending" && (
                      <button
                        onClick={() => setStatus(item, "pending")}
                        disabled={busyId === item.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Reopen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div ref={sentinelRef} className="h-1" />
      {loadingMore && (
        <p className="mt-4 text-center text-sm text-muted-foreground">Loading more…</p>
      )}
    </div>
  );
}
