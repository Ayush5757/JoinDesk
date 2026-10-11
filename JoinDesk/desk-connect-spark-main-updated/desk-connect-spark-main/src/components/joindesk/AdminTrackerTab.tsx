import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addDaysStr, fmtDay, todayIst } from "./adminShared";
import {
  adminAddMotivations,
  adminDeleteMotivation,
  adminGetTrackerSettings,
  adminListMotivations,
  adminSaveTrackerSettings,
  type AdminMotivation,
  type MotivationKind,
} from "@/lib/admin";

const KINDS: { v: MotivationKind; label: string; hint: string }[] = [
  { v: "start", label: "Start", hint: "Shown before they press Let's go" },
  { v: "resume", label: "Resume", hint: "Shown when they come back from a break" },
  { v: "end", label: "End", hint: "Shown after they end the day" },
];

/**
 * Study Tracker controls:
 *  - how many days a goal may last
 *  - motivation lines for Start / Resume / End. A line given a date is shown
 *    to EVERYONE on that day, so you can queue several days ahead before a trip.
 */
export function AdminTrackerTab() {
  return (
    <div className="space-y-6">
      <GoalLimit />
      <AddMotivations />
      <MotivationList />
    </div>
  );
}

function GoalLimit() {
  const [value, setValue] = useState("4");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminGetTrackerSettings()
      .then((s) => setValue(String(s.maxGoalDays)))
      .catch(() => toast.error("Couldn't load tracker settings."));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await adminSaveTrackerSettings(Number(value));
      setValue(String(saved.maxGoalDays));
      toast.success("Saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <h3 className="text-sm font-bold">Goal length</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        The most days a student can give one goal. Default is 4. You can raise it to 10, 30 or more.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={365}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-28 rounded-full border border-border bg-card px-4 py-2 text-sm"
        />
        <span className="text-xs text-muted-foreground">days max</span>
        <button
          onClick={save}
          disabled={saving}
          className="ml-2 rounded-full bg-foreground px-5 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </section>
  );
}

function AddMotivations() {
  const [kind, setKind] = useState<MotivationKind>("start");
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [scheduled, setScheduled] = useState(true);
  const [startDate, setStartDate] = useState(todayIst());
  const [saving, setSaving] = useState(false);

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const submit = async () => {
    setSaving(true);
    try {
      const r = await adminAddMotivations({
        kind,
        lines,
        ...(scheduled ? { startDate } : {}),
        ...(author.trim() ? { author: author.trim() } : {}),
      });
      toast.success(`${r.added} line${r.added === 1 ? "" : "s"} added.`);
      setText("");
      window.dispatchEvent(new Event("tracker-motivations-changed"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <h3 className="text-sm font-bold">Add motivation lines</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        One line per row. Everyone sees the same line on the same day. Going away? Add 5 lines and schedule them from a
        date. They'll cover the next 5 days, one per day.
      </p>

      <div className="mt-3 inline-flex rounded-full border border-border bg-muted/50 p-1">
        {KINDS.map((k) => (
          <button
            key={k.v}
            onClick={() => setKind(k.v)}
            className={
              "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors " +
              (kind === k.v ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground")
            }
          >
            {k.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{KINDS.find((k) => k.v === kind)?.hint}</p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder={"Today you outwork yesterday's you.\nSmall steps. Big results.\nThe pain of discipline is lighter than regret."}
        className="mt-3 block w-full resize-none rounded-2xl border border-border bg-muted/40 p-3 text-sm outline-none focus:border-primary/50 focus:bg-card"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input type="checkbox" checked={scheduled} onChange={(e) => setScheduled(e.target.checked)} />
          Schedule by date
        </label>
        {scheduled && (
          <input
            type="date"
            value={startDate}
            onChange={(e) => e.target.value && setStartDate(e.target.value)}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs"
          />
        )}
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          maxLength={80}
          placeholder="Author (optional)"
          className="min-w-0 flex-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs"
        />
      </div>

      {scheduled && lines.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-xl bg-muted/40 p-3 text-xs">
          {lines.slice(0, 8).map((l, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-24 shrink-0 font-semibold text-muted-foreground">{fmtDay(addDaysStr(startDate, i) + "T00:00:00+05:30")}</span>
              <span className="min-w-0 truncate">{l}</span>
            </li>
          ))}
          {lines.length > 8 && <li className="text-muted-foreground">+ {lines.length - 8} more days</li>}
        </ul>
      )}
      {!scheduled && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Without a date, these lines join the daily rotation together with the built-in ones.
        </p>
      )}

      <button
        onClick={submit}
        disabled={saving || lines.length === 0}
        className="mt-4 rounded-full bg-brand-gradient px-6 py-2.5 text-xs font-semibold text-primary-foreground shadow-soft disabled:opacity-50"
      >
        {saving ? "Saving…" : `Add ${lines.length || ""} line${lines.length === 1 ? "" : "s"}`}
      </button>
    </section>
  );
}

function MotivationList() {
  const [rows, setRows] = useState<AdminMotivation[] | null>(null);

  const load = useCallback(() => {
    adminListMotivations()
      .then((r) => setRows(r.motivations))
      .catch(() => toast.error("Couldn't load motivations."));
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("tracker-motivations-changed", load);
    return () => window.removeEventListener("tracker-motivations-changed", load);
  }, [load]);

  const remove = async (id: string) => {
    try {
      await adminDeleteMotivation(id);
      load();
    } catch {
      toast.error("Couldn't delete.");
    }
  };

  if (!rows) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
      </p>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <h3 className="text-sm font-bold">Your lines ({rows.length})</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Nothing yet. Students currently see the built-in lines, which change every day.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {rows.map((m) => (
            <li key={m.id} className="flex items-start gap-3 py-2.5">
              <span className="mt-0.5 w-14 shrink-0 rounded-full bg-muted px-2 py-0.5 text-center text-[10px] font-semibold uppercase">
                {m.kind}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">{m.text}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {m.show_date ? `Shown to everyone on ${fmtDay(m.show_date + "T00:00:00+05:30")}` : "Daily rotation"}
                  {m.author ? ` · ${m.author}` : ""}
                </p>
              </div>
              <button
                onClick={() => remove(m.id)}
                aria-label="Delete"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
