import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { getSpecialDesksPage } from "@/lib/desks";
import type { Desk } from "@/lib/deskModel";
import {
  adminGetTimings,
  adminSaveTimings,
  formatRange,
  refreshSpecialTimings,
  type SpecialTimings,
  type TimingRange,
} from "@/lib/specialTimings";

const NEW_RANGE: TimingRange = { start: "18:00", end: "21:00" };

export function AdminTimingsTab() {
  const [data, setData] = useState<SpecialTimings | null>(null);
  const [desks, setDesks] = useState<Desk[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [t, d] = await Promise.all([adminGetTimings(), getSpecialDesksPage(50, 0)]);
        setData(t);
        setDesks(d.desks);
      } catch {
        toast.error("Couldn't load the timings.");
      }
    })();
  }, []);

  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const setAll = (all: TimingRange[]) => {
    setData({ ...data, all });
    setDirty(true);
  };
  const setForDesk = (id: string, list: TimingRange[]) => {
    setData({ ...data, byDesk: { ...data.byDesk, [id]: list } });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await adminSaveTimings(data);
      setData(saved);
      setDirty(false);
      await refreshSpecialTimings();
      toast.success("Timings saved. They are live now.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="rounded-2xl border border-special/25 bg-special-soft p-4 text-sm leading-relaxed text-muted-foreground">
        <p className="flex items-center gap-2 font-semibold text-foreground">
          <Clock className="h-4 w-4 text-special" /> Popular study times on Special desks
        </p>
        <p className="mt-1.5">
          People see these, in bold, in the window that opens when they join a <b>Special desk</b> (never on normal
          desks), together with "Open 24/7". Add as many as you like. If you add none, nothing is shown.
        </p>
        <p className="mt-1.5">
          Enter times in <b>India time (IST)</b>. Each visitor sees them converted to their own local time.
        </p>
      </div>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h3 className="text-base font-bold tracking-tight">Common timings (all Special desks)</h3>
        <p className="mt-1 text-xs text-muted-foreground">Shown on every Special desk that has no timings of its own.</p>
        <RangeEditor ranges={data.all} onChange={setAll} />
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h3 className="text-base font-bold tracking-tight">Different timings for one desk (optional)</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Open a desk and add timings only if that desk should show something different. Leave it empty and the
          common timings above are used.
        </p>
        {desks.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">No Special desks yet.</p>
        ) : (
          <div className="mt-3 grid gap-2">
            {desks.map((d) => {
              const own = data.byDesk[d.id] ?? [];
              return (
                <details key={d.id} className="rounded-2xl border border-border bg-muted/30 p-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold">
                    <span className="min-w-0 truncate">{d.title}</span>
                    <span className="shrink-0 rounded-full bg-card px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {own.length ? `${own.length} own timing${own.length > 1 ? "s" : ""}` : "uses common"}
                    </span>
                  </summary>
                  <RangeEditor ranges={own} onChange={(list) => setForDesk(d.id, list)} />
                </details>
              );
            })}
          </div>
        )}
      </section>

      <div className="sticky bottom-3 z-10 flex items-center justify-end gap-3">
        {dirty && <span className="rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">Unsaved changes</span>}
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-2 rounded-full bg-special-gradient px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save timings
        </button>
      </div>
    </div>
  );
}

function RangeEditor({ ranges, onChange }: { ranges: TimingRange[]; onChange: (r: TimingRange[]) => void }) {
  const update = (i: number, patch: Partial<TimingRange>) =>
    onChange(ranges.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div className="mt-3">
      {ranges.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          No timings added.
        </p>
      )}

      <div className="grid gap-2">
        {ranges.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/40 p-2.5">
            <input
              type="time"
              value={r.start}
              onChange={(e) => update(i, { start: e.target.value })}
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-special/50"
              aria-label="Start time"
            />
            <span className="text-xs font-semibold text-muted-foreground">to</span>
            <input
              type="time"
              value={r.end}
              onChange={(e) => update(i, { end: e.target.value })}
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-special/50"
              aria-label="End time"
            />
            {r.start && r.end && r.start !== r.end && (
              <span className="ml-auto text-[11px] text-muted-foreground">
                You'd see: <b className="text-foreground">{formatRange(r)}</b>
              </span>
            )}
            <button
              onClick={() => onChange(ranges.filter((_, idx) => idx !== i))}
              className="grid h-8 w-8 place-items-center rounded-full text-destructive hover:bg-card"
              aria-label="Remove this timing"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => onChange([...ranges, { ...NEW_RANGE }])}
        disabled={ranges.length >= 12}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" /> Add timing
      </button>
    </div>
  );
}
