import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Gift, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminUserDetailModal } from "./AdminUserDetailModal";
import { AdminPaymentSettings } from "./AdminPaymentSettings";
import { fmtDay, timeAgo, useAdminDeskOptions } from "./adminShared";
import {
  adminCreateGrant,
  adminDeleteGrant,
  adminListGrants,
  adminListUsers,
  type AccessGrant,
  type AdminUser,
} from "@/lib/admin";

/**
 * Give people free access (one desk, or every desk) and take it back.
 * Every row shows whether the person actually uses it, so unused free
 * access is easy to spot and remove.
 */
export function AdminAccessTab() {
  const { options: deskOptions } = useAdminDeskOptions();

  // ---- add form
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<{ email: string; name: string } | null>(null);
  const [suggestions, setSuggestions] = useState<AdminUser[]>([]);
  const [scope, setScope] = useState<"all" | "desk">("all");
  const [deskId, setDeskId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const suggestSeq = useRef(0);

  // ---- list
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [inactiveDays, setInactiveDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [listSearch, setListSearch] = useState("");
  const [listDesk, setListDesk] = useState("");
  const [onlyInactive, setOnlyInactive] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminListGrants({
        search: listSearch,
        ...(listDesk ? { deskId: listDesk } : {}),
      });
      setGrants(r.grants);
      setInactiveDays(r.inactiveDays);
    } catch {
      toast.error("Couldn't load the free-access list.");
    } finally {
      setLoading(false);
    }
  }, [listSearch, listDesk]);

  useEffect(() => {
    const h = setTimeout(load, listSearch ? 350 : 0);
    return () => clearTimeout(h);
  }, [load, listSearch]);

  // Suggest existing users while typing a name/email.
  useEffect(() => {
    const q = query.trim();
    if (picked || q.length < 2) {
      setSuggestions([]);
      return;
    }
    const seq = ++suggestSeq.current;
    const h = setTimeout(() => {
      adminListUsers({ limit: 5, offset: 0, search: q })
        .then(({ users }) => seq === suggestSeq.current && setSuggestions(users))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(h);
  }, [query, picked]);

  const typedEmail = picked?.email ?? (query.includes("@") ? query.trim() : "");

  const submit = async () => {
    if (!typedEmail) {
      toast.error("Pick a user from the list, or type their full email.");
      return;
    }
    if (scope === "desk" && !deskId) {
      toast.error("Pick which desk to make free.");
      return;
    }
    setSaving(true);
    try {
      const r = await adminCreateGrant({
        email: typedEmail,
        scope,
        ...(scope === "desk" ? { deskId } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      toast.success(r.alreadyExisted ? "They already had this free access." : "Free access given.");
      setQuery("");
      setPicked(null);
      setNote("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't give free access.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (g: AccessGrant) => {
    const who = g.user?.name ?? g.email;
    const what = g.scope === "all" ? "all desks" : (g.deskTitle ?? "this desk");
    if (!window.confirm(`Remove ${who}'s free access to ${what}? They will need to pay to join.`))
      return;
    setBusyId(g.id);
    try {
      await adminDeleteGrant(g.id);
      setGrants((prev) => prev.filter((x) => x.id !== g.id));
      toast.success("Free access removed.");
    } catch {
      toast.error("Couldn't remove it. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const rows = useMemo(() => {
    const filtered = onlyInactive ? grants.filter((g) => g.inactive) : grants;
    // Unused free access first — those are the ones you probably want to act on.
    return [...filtered].sort((a, b) => Number(b.inactive) - Number(a.inactive));
  }, [grants, onlyInactive]);

  const inactiveCount = grants.filter((g) => g.inactive).length;

  return (
    <div>
      <AdminPaymentSettings />

      {/* Add form */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <Gift className="h-4 w-4" /> Give free access
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Search a user by name or email — or type a full email for someone who hasn't signed up
          yet. It applies the moment they log in.
        </p>

        <div className="relative mt-3">
          <div className="flex items-center gap-2 rounded-full border border-border bg-muted/60 px-4 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={picked ? `${picked.name} <${picked.email}>` : query}
              onChange={(e) => {
                setPicked(null);
                setQuery(e.target.value);
              }}
              placeholder="Name or email…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          {suggestions.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-glow">
              {suggestions.map((u) => (
                <li key={u.id}>
                  <button
                    onClick={() => {
                      setPicked({ email: u.email, name: u.name });
                      setSuggestions([]);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span className="font-semibold">{u.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{u.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(["all", "desk"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={
                "rounded-full border px-4 py-2 text-xs font-semibold transition-colors " +
                (scope === s
                  ? "border-transparent bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:text-foreground")
              }
            >
              {s === "all" ? "All desks" : "One specific desk"}
            </button>
          ))}
          {scope === "desk" && (
            <select
              value={deskId}
              onChange={(e) => setDeskId(e.target.value)}
              className="min-w-0 max-w-[16rem] rounded-full border border-border bg-card px-3 py-2 text-xs"
            >
              <option value="">Choose desk…</option>
              {deskOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.isSpecial ? "★ " : ""}
                  {d.title}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Note (optional) — e.g. student, friend, can't pay"
            className="min-w-0 flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-sm outline-none"
          />
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-gradient px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Give free access
          </button>
        </div>
      </div>

      {/* List */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <div className="flex max-w-xs items-center gap-2 rounded-full border border-border bg-muted/60 px-4 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            placeholder="Search email…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={listDesk}
          onChange={(e) => setListDesk(e.target.value)}
          className="max-w-[14rem] rounded-full border border-border bg-card px-3 py-2 text-xs"
        >
          <option value="">All free-access entries</option>
          {deskOptions.map((d) => (
            <option key={d.id} value={d.id}>
              Only: {d.title}
            </option>
          ))}
        </select>
        <button
          onClick={() => setOnlyInactive((v) => !v)}
          className={
            "rounded-full border px-4 py-2 text-xs font-semibold transition-colors " +
            (onlyInactive
              ? "border-transparent bg-amber-500 text-white"
              : "border-border bg-card text-muted-foreground hover:text-foreground")
          }
        >
          Not using it ({inactiveCount})
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No free access given yet.</p>
        ) : (
          rows.map((g) => (
            <div
              key={g.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">
                  {g.user?.avatar_url && (
                    <img src={g.user.avatar_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {g.user ? (
                      <button
                        onClick={() => setDetailUserId(g.user!.id)}
                        className="hover:underline"
                      >
                        {g.user.name}
                      </button>
                    ) : (
                      "Not signed up yet"
                    )}
                    <span
                      className={
                        "ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                        (g.scope === "all"
                          ? "bg-special-soft text-special"
                          : "bg-info-soft text-info")
                      }
                    >
                      {g.scope === "all" ? "All desks" : g.deskTitle}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {g.email} · since {fmtDay(g.granted_at)}
                    {g.note ? ` · ${g.note}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs">
                    {!g.user ? (
                      <span className="text-muted-foreground">Waiting for them to sign up</span>
                    ) : g.inactive ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                        <AlertTriangle className="h-3 w-3" />
                        No {g.scope === "desk" ? "visits to this desk" : "visits"} in {inactiveDays}{" "}
                        days · last seen {timeAgo(g.user.last_join_at)}
                      </span>
                    ) : (
                      <span className="text-emerald-600">
                        {g.recentJoins} visit{g.recentJoins === 1 ? "" : "s"} in the last{" "}
                        {inactiveDays} days
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => remove(g)}
                disabled={busyId === g.id}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove free access
              </button>
            </div>
          ))
        )}
      </div>

      <AdminUserDetailModal
        userId={detailUserId}
        onClose={() => setDetailUserId(null)}
        onChanged={load}
      />
    </div>
  );
}
