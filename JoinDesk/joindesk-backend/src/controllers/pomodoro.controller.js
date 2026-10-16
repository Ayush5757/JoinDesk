import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "../config/supabase.js";

const KEY = "pomodoro_scenes";
const MAX_SCENES = 40;

/**
 * Starting scenes (long, relaxing videos). The admin can replace the whole list from the
 * admin panel (Focus scenes). A YouTube owner can switch off embedding at any time, so
 * this list is only a starting point.
 */
const DEFAULT_SCENES = [
  { id: "s-beach", title: "Hawaii Beach, Ocean Waves", category: "Beach", kind: "youtube", source: "jTgpgWUYexU", music: "noise-waves" },
  { id: "s-rain", title: "Rainforest, Soft Rain", category: "Nature", kind: "youtube", source: "ubNfkpbxXUs", music: "noise-rain-light" },
  { id: "s-lofi", title: "Lofi Study Room", category: "Study", kind: "youtube", source: "jfKfPfyJRdk", music: "pad-amin" },
];

/** A YouTube link, short link, embed link, or the bare 11-character id -> the id (or null). */
export function extractYoutubeId(input) {
  const s = String(input || "").trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

const isVideoUrl = (u) => /^https:\/\/[^\s]+\.(mp4|webm|ogv)(\?[^\s]*)?$/i.test(u);

/** Cleans what the admin sent into the exact shape we store. Returns { scene } or { error }. */
export function cleanScene(raw) {
  const title = String(raw?.title || "").trim().slice(0, 60);
  const category = String(raw?.category || "").trim().slice(0, 20) || "Nature";
  if (!title) return { error: "Every scene needs a title" };

  let kind;
  let source;
  const input = String(raw?.source || "").trim();
  const ytId = extractYoutubeId(input);
  if (ytId) {
    kind = "youtube";
    source = ytId;
  } else if (isVideoUrl(input)) {
    kind = "file";
    source = input;
  } else {
    return { error: `"${title}": paste a YouTube link, or a direct https link to an .mp4 / .webm video` };
  }
  const music = typeof raw?.music === "string" && /^[a-z0-9-]{1,30}$/.test(raw.music) ? raw.music : null;
  const id = typeof raw?.id === "string" && /^[A-Za-z0-9-]{1,40}$/.test(raw.id) ? raw.id : `s-${randomUUID().slice(0, 8)}`;
  return { scene: { id, title, category, kind, source, music } };
}

async function loadScenes() {
  const { data } = await supabaseAdmin.from("site_settings").select("value").eq("key", KEY).maybeSingle();
  if (!data?.value) return DEFAULT_SCENES;
  try {
    const parsed = JSON.parse(data.value);
    return Array.isArray(parsed) ? parsed : DEFAULT_SCENES;
  } catch {
    return DEFAULT_SCENES;
  }
}

/** GET /api/pomodoro-scenes   (public) */
export async function getScenes(req, res) {
  try {
    return res.status(200).json({ scenes: await loadScenes() });
  } catch (err) {
    console.error("getScenes error:", err);
    return res.status(200).json({ scenes: DEFAULT_SCENES });
  }
}

/** PATCH /api/admin/pomodoro-scenes   Body: { scenes: [...] }  (replaces the whole list) */
export async function saveScenes(req, res) {
  try {
    const raw = Array.isArray(req.body?.scenes) ? req.body.scenes : null;
    if (!raw) return res.status(400).json({ error: "scenes must be a list" });
    if (raw.length > MAX_SCENES) return res.status(400).json({ error: `At most ${MAX_SCENES} scenes` });

    const scenes = [];
    for (const item of raw) {
      const { scene, error } = cleanScene(item);
      if (error) return res.status(400).json({ error });
      scenes.push(scene);
    }
    const { error } = await supabaseAdmin.from("site_settings").upsert({
      key: KEY,
      value: JSON.stringify(scenes),
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return res.status(200).json({ scenes });
  } catch (err) {
    console.error("saveScenes error:", err);
    return res.status(500).json({ error: "Failed to save the scenes" });
  }
}
