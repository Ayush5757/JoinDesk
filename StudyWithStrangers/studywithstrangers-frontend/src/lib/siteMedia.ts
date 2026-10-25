import { useEffect, useState } from "react";
import { api, AUTH_TOKEN_KEY } from "@/lib/api";
import { adminApi } from "@/lib/adminApi";

export type SiteMedia = {
  /** The video every first-time visitor must watch. `version` rises when the admin asks everyone to watch again. */
  intro: { url: string; version: number } | null;
  /** The optional help video inside Suggestions & Complaints. */
  feedback: { url: string } | null;
};

const EMPTY: SiteMedia = { intro: null, feedback: null };

let cache: SiteMedia | null = null;
let inflight: Promise<SiteMedia> | null = null;
const listeners = new Set<(m: SiteMedia) => void>();

/** Loads the videos once and shares the result with everything that needs it. Never throws. */
export function fetchSiteMedia(force = false): Promise<SiteMedia> {
  if (cache && !force) return Promise.resolve(cache);
  if (inflight && !force) return inflight;
  inflight = api
    .getQuiet<SiteMedia>("/api/site-media")
    .catch(() => EMPTY)
    .then((m) => {
      cache = m;
      inflight = null;
      listeners.forEach((fn) => fn(m));
      return m;
    });
  return inflight;
}

/** Call after the admin changes a video so the rest of the app picks it up. */
export function refreshSiteMedia() {
  return fetchSiteMedia(true);
}

export function useSiteMedia() {
  const [media, setMedia] = useState<SiteMedia | null>(cache);
  useEffect(() => {
    listeners.add(setMedia);
    void fetchSiteMedia().then(setMedia);
    return () => {
      listeners.delete(setMedia);
    };
  }, []);
  return { media, loaded: media !== null };
}

// ---------------------------------------------------------------- "already watched" (saved on the account)
/** Which welcome-video version this signed-in user has finished. null = unknown or not signed in (never blocks). */
export async function fetchIntroSeenVersion(): Promise<number | null> {
  if (!localStorage.getItem(AUTH_TOKEN_KEY)) return null;
  try {
    const { seenVersion } = await api.getQuiet<{ seenVersion: number | null }>("/api/users/me/intro");
    return seenVersion;
  } catch {
    return null;
  }
}

/** Saves, on the account, that the user finished the welcome video. */
export const postIntroSeen = () => api.post<{ seenVersion: number }>("/api/users/me/intro-seen");

// ---------------------------------------------------------------- admin
export type AdminMediaSlot = { url: string; path: string | null; version: number; updatedAt: string } | null;
export type AdminMedia = {
  intro: AdminMediaSlot;
  feedback: AdminMediaSlot;
  limits: { maxMb: number; types: string[] };
};
export type MediaSlotName = "intro" | "feedback";

export const adminGetMedia = () => adminApi.get<AdminMedia>("/api/admin/media");

export const adminSaveMedia = (
  slot: MediaSlotName,
  body: { url: string; path?: string | null; forceRewatch?: boolean },
) => adminApi.put<Record<string, AdminMediaSlot>>(`/api/admin/media/${slot}`, body);

export const adminDeleteMedia = (slot: MediaSlotName) => adminApi.delete<{ ok: true }>(`/api/admin/media/${slot}`);

/**
 * Uploads a video straight from the browser to storage (so it isn't limited by the API's request size), with a
 * progress callback. Returns the public URL and the storage path to save.
 */
export async function adminUploadVideo(
  slot: MediaSlotName,
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ url: string; path: string }> {
  const target = await adminApi.post<{ signedUrl: string; path: string; publicUrl: string }>(
    "/api/admin/media/upload-url",
    { slot, contentType: file.type, size: file.size },
  );

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", target.signedUrl);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status}). Is the video under the size limit?`));
    xhr.onerror = () => reject(new Error("Upload failed. Check your internet and try again."));
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    xhr.send(form);
  });

  return { url: target.publicUrl, path: target.path };
}
