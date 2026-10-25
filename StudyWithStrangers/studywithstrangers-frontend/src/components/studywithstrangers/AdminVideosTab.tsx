import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Film, Link2, Loader2, Trash2, Upload } from "lucide-react";
import { VideoEmbed } from "./VideoEmbed";
import { parseYouTubeId } from "@/lib/video";
import {
  adminDeleteMedia,
  adminGetMedia,
  adminSaveMedia,
  adminUploadVideo,
  refreshSiteMedia,
  type AdminMedia,
  type AdminMediaSlot,
  type MediaSlotName,
} from "@/lib/siteMedia";

export function AdminVideosTab() {
  const [data, setData] = useState<AdminMedia | null>(null);

  const load = async () => {
    try {
      setData(await adminGetMedia());
    } catch {
      toast.error("Couldn't load the videos.");
    }
  };
  useEffect(() => {
    void load();
  }, []);

  // After any change: reload this panel AND the copy the rest of the app is using.
  const changed = async () => {
    await Promise.all([load(), refreshSiteMedia()]);
  };

  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-muted-foreground">
        <p className="font-semibold text-foreground">Two ways to add a video</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>
            <b>YouTube link (recommended, free for any number of viewers).</b> Upload the video to YouTube, set
            its visibility to <b>Unlisted</b> (not Private), keep "Allow embedding" on, then paste the link below.
            There is no bandwidth limit, so thousands of people can watch it.
          </li>
          <li>
            <b>Upload a file</b> (MP4, under {data.limits.maxMb} MB). Stored in your Supabase storage, which has a
            small monthly bandwidth allowance on the free plan, so it suits only a small number of viewers.
          </li>
        </ul>
      </div>

      <VideoSlotCard
        slot="intro"
        title="Welcome video (required for new visitors)"
        description="Every first-time visitor must watch this fully, with sound, before they can use the site. They are never asked again unless you tick the box below when you replace it."
        current={data.intro}
        maxMb={data.limits.maxMb}
        offerRewatch
        onChanged={changed}
      />

      <VideoSlotCard
        slot="feedback"
        title="Help video in “Suggestions & Complaints” (optional to watch)"
        description="Shown inside the Suggestions & Complaints window. Nobody has to watch it. Leave it empty to hide the video box."
        current={data.feedback}
        maxMb={data.limits.maxMb}
        onChanged={changed}
      />
    </div>
  );
}

function VideoSlotCard({
  slot,
  title,
  description,
  current,
  maxMb,
  offerRewatch = false,
  onChanged,
}: {
  slot: MediaSlotName;
  title: string;
  description: string;
  current: AdminMediaSlot;
  maxMb: number;
  offerRewatch?: boolean;
  onChanged: () => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [link, setLink] = useState("");
  const [rewatch, setRewatch] = useState(false);

  const afterSave = async (msg: string) => {
    toast.success(msg);
    setLink("");
    setRewatch(false);
    await onChanged();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/^video\/(mp4|webm|quicktime)$/.test(file.type)) {
      toast.error("Please choose an MP4 or WebM video.");
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`That file is ${(file.size / 1048576).toFixed(0)} MB. Keep it under ${maxMb} MB.`);
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const { url, path } = await adminUploadVideo(slot, file, setProgress);
      await adminSaveMedia(slot, { url, path, forceRewatch: rewatch });
      await afterSave(current ? "Video replaced. It is live now." : "Video uploaded. It is live now.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const saveLink = async () => {
    setBusy(true);
    try {
      await adminSaveMedia(slot, { url: link.trim(), path: null, forceRewatch: rewatch });
      await afterSave("Video link saved. It is live now.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the link.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Remove this video?")) return;
    setBusy(true);
    try {
      await adminDeleteMedia(slot);
      await afterSave("Video removed.");
    } catch {
      toast.error("Couldn't remove it. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <h3 className="flex items-center gap-2 text-base font-bold tracking-tight">
        <Film className="h-4 w-4 text-primary" /> {title}
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>

      {current ? (
        <div className="mt-4">
          <VideoEmbed url={current.url} className="max-h-72 rounded-2xl" />
          <p className="mt-2 text-[11px] text-muted-foreground">
            {parseYouTubeId(current.url) ? "YouTube video" : "Uploaded file"} · live since{" "}
            {new Date(current.updatedAt).toLocaleString()}
            {offerRewatch ? ` · version ${current.version}` : ""}
          </p>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No video yet.
        </p>
      )}

      {offerRewatch && (
        <label className="mt-4 flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={rewatch} onChange={(e) => setRewatch(e.target.checked)} className="mt-0.5" />
          <span>
            Make <b>everyone watch this video again</b> (even people who already finished the earlier one). Leave
            it unticked and only new users will see it.
          </span>
        </label>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-50"
        >
          {busy && progress !== null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {busy && progress !== null ? `Uploading ${progress}%` : current ? "Replace video" : "Upload video"}
        </button>
        {current && (
          <button
            onClick={remove}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold text-destructive hover:bg-muted disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        )}
      </div>

      {progress !== null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-brand-gradient transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="mt-5 border-t border-border pt-4">
        <p className="text-xs font-semibold">Or paste a YouTube link (recommended)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=… or https://youtu.be/…"
              className="w-full rounded-full border border-border bg-muted/40 py-2 pl-8 pr-3 text-xs outline-none focus:border-primary/50 focus:bg-card"
            />
          </div>
          <button
            onClick={saveLink}
            disabled={busy || !link.trim()}
            className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-50"
          >
            Save link
          </button>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          A normal YouTube video link works (set to Unlisted). A direct link to an MP4 or WebM file works too. Make
          sure the video plays when you open the link in a new tab.
        </p>
      </div>
    </section>
  );
}
