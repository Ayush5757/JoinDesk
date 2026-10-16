import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adminGetScenes, adminSaveScenes } from "@/lib/admin";
import { MUSIC_OPTIONS, SCENE_CATEGORIES, sceneThumb, type Scene } from "@/lib/pomodoro";

type Draft = { id?: string; title: string; category: string; source: string; music: string };

const empty = (): Draft => ({ title: "", category: "Nature", source: "", music: "" });

/**
 * Background videos of the Focus Timer. Paste a YouTube link (best: a 3 to 10 hour
 * relaxing video of a beach, forest, city walk...) or a direct .mp4 / .webm link, give it a
 * name and pick the music that suits it. Students see these as small thumbnails.
 * If a video stops working (the owner removes it or turns off embedding), the timer
 * skips it by itself. Replace it here when you notice.
 */
export function AdminPomodoroTab() {
  const [rows, setRows] = useState<Draft[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    adminGetScenes()
      .then((r) =>
        setRows(r.scenes.map((s: Scene) => ({ id: s.id, title: s.title, category: s.category, source: s.kind === "youtube" ? `https://youtu.be/${s.source}` : s.source, music: s.music ?? "" }))),
      )
      .catch(() => toast.error("Couldn't load the scenes."));
  }, []);

  const update = (i: number, patch: Partial<Draft>) => {
    setRows((prev) => (prev ? prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) : prev));
    setDirty(true);
  };
  const move = (i: number, dir: -1 | 1) => {
    setRows((prev) => {
      if (!prev) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      return copy;
    });
    setDirty(true);
  };

  const save = async () => {
    if (!rows) return;
    setSaving(true);
    try {
      const r = await adminSaveScenes(rows.map((x) => ({ ...(x.id ? { id: x.id } : {}), title: x.title, category: x.category, source: x.source, music: x.music || null })));
      setRows(r.scenes.map((s) => ({ id: s.id, title: s.title, category: s.category, source: s.kind === "youtube" ? `https://youtu.be/${s.source}` : s.source, music: s.music ?? "" })));
      setDirty(false);
      toast.success("Scenes saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the scenes.");
    } finally {
      setSaving(false);
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
    <div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Add long, relaxing videos for the Focus Timer background: beaches, forests, rain, mountains, city walks, study
        rooms. Paste a YouTube link (a video that is allowed to be embedded) or a direct link to an .mp4 / .webm file.
        The first scene is the default. Tip: on YouTube search for something like "4K city walk 3 hours" or "10 hour ocean
        waves", open it and copy the link.
      </p>

      <ul className="mt-4 space-y-3">
        {rows.map((r, i) => {
          const thumb = sceneThumb({ id: "x", title: "", category: "", kind: /youtu/.test(r.source) || /^[A-Za-z0-9_-]{11}$/.test(r.source) ? "youtube" : "file", source: (r.source.match(/(?:youtu\.be\/|v=|embed\/|live\/|shorts\/)([A-Za-z0-9_-]{11})/)?.[1] ?? r.source), music: null });
          return (
            <li key={r.id ?? i} className="flex gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft">
              <div
                className="hidden h-16 w-28 shrink-0 rounded-xl bg-muted bg-cover bg-center sm:block"
                style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}
              />
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                <input
                  value={r.title}
                  onChange={(e) => update(i, { title: e.target.value })}
                  placeholder="Title, e.g. Maldives Beach, Ocean Waves"
                  maxLength={60}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs"
                />
                <input
                  value={r.source}
                  onChange={(e) => update(i, { source: e.target.value })}
                  placeholder="YouTube link or .mp4 / .webm link"
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs"
                />
                <select
                  value={r.category}
                  onChange={(e) => update(i, { category: e.target.value })}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs"
                >
                  {[...new Set([...SCENE_CATEGORIES, r.category])].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  value={r.music}
                  onChange={(e) => update(i, { music: e.target.value })}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs"
                >
                  <option value="">Music: keep what they chose</option>
                  {MUSIC_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>
                      Music: {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex shrink-0 flex-col items-center justify-center gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="grid h-7 w-7 place-items-center rounded-full hover:bg-muted disabled:opacity-30">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down" className="grid h-7 w-7 place-items-center rounded-full hover:bg-muted disabled:opacity-30">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    setRows(rows.filter((_, idx) => idx !== i));
                    setDirty(true);
                  }}
                  aria-label="Delete"
                  className="grid h-7 w-7 place-items-center rounded-full text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => {
            setRows([...rows, empty()]);
            setDirty(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold transition-colors hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" /> Add a scene
        </button>
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="rounded-full bg-foreground px-5 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save scenes"}
        </button>
        {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
      </div>
    </div>
  );
}
