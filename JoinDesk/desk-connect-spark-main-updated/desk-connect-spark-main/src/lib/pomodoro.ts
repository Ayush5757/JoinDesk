import { api } from "@/lib/api";

/** One background scene of the Focus Timer: a long, relaxing video + the music that suits it. */
export type Scene = {
  id: string;
  title: string;
  category: string;
  kind: "youtube" | "file";
  // a YouTube video id, or a direct https link to an .mp4 / .webm
  source: string;
  // id of one of the built-in music presets (see MUSIC_OPTIONS), or null
  music: string | null;
};

/** The built-in music (generated in the browser, no words). Used by the scene editor. */
export const MUSIC_OPTIONS: { id: string; label: string }[] = [
  { id: "pad-cmaj", label: "Soft Pad" },
  { id: "pad-amin", label: "Warm Pad" },
  { id: "pad-fmaj7", label: "Dreamy Pad" },
  { id: "pad-drone", label: "Deep Drone" },
  { id: "pad-dmin", label: "Twilight Pad" },
  { id: "pad-gmaj", label: "Morning Pad" },
  { id: "pad-emin", label: "Velvet Pad" },
  { id: "noise-rain-light", label: "Rainy Focus" },
  { id: "noise-rain-heavy", label: "Heavy Rain" },
  { id: "noise-waves", label: "Ocean Waves" },
  { id: "noise-wind", label: "Wind Whisper" },
  { id: "noise-brown", label: "Brown Noise Deep" },
  { id: "noise-cafe", label: "Café Hum" },
  { id: "pluck-c", label: "Gentle Chimes" },
  { id: "pluck-d", label: "Wind Chimes" },
  { id: "pluck-g-marimba", label: "Soft Marimba" },
  { id: "pluck-crickets", label: "Night Crickets" },
  { id: "pluck-musicbox", label: "Music Box" },
  { id: "pluck-zen", label: "Zen Bells" },
  { id: "pluck-lullaby", label: "Lullaby Plucks" },
];

export const SCENE_CATEGORIES = ["Nature", "Beach", "City", "Rain", "Study", "Mountains", "Space"];

// Used only if the server can't be reached.
export const FALLBACK_SCENES: Scene[] = [
  { id: "s-beach", title: "Hawaii Beach, Ocean Waves", category: "Beach", kind: "youtube", source: "jTgpgWUYexU", music: "noise-waves" },
  { id: "s-rain", title: "Rainforest, Soft Rain", category: "Nature", kind: "youtube", source: "ubNfkpbxXUs", music: "noise-rain-light" },
  { id: "s-lofi", title: "Lofi Study Room", category: "Study", kind: "youtube", source: "jfKfPfyJRdk", music: "pad-amin" },
];

export async function getScenes(): Promise<Scene[]> {
  try {
    const { scenes } = await api.get<{ scenes: Scene[] }>("/api/pomodoro-scenes");
    return scenes.length ? scenes : FALLBACK_SCENES;
  } catch {
    return FALLBACK_SCENES;
  }
}

/** A tiny preview image that shows instantly while the video loads (or in data-saver mode). */
export function sceneThumb(scene: Scene | null | undefined): string | null {
  return scene && scene.kind === "youtube" ? `https://i.ytimg.com/vi/${scene.source}/hqdefault.jpg` : null;
}
