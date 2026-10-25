import "dotenv/config";
import { supabaseAdmin } from "../config/supabase.js";

/**
 * Admin-managed videos, stored in site_settings as JSON text under one key per slot:
 *   intro    - the video every first-time visitor must watch before using the site
 *   feedback - the (optional) help video inside "Suggestions & Complaints"
 *
 * Value shape: { url, path, version, updatedAt }
 *   path    - object path inside the storage bucket, or null if the admin pasted an external URL
 *   version - only matters for "intro". People who already watched version N are not asked again
 *             until the admin republishes with "make everyone watch again" (which raises it).
 */
export const MEDIA_SLOTS = ["intro", "feedback"];
export const MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "site-media";
export const MAX_VIDEO_MB = Number(process.env.MEDIA_MAX_MB) > 0 ? Number(process.env.MEDIA_MAX_MB) : 50;
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

const keyFor = (slot) => `${slot}_video`;

function parseRaw(raw) {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

// A removed video leaves a "tombstone" (empty url) behind so the version counter keeps counting up instead of
// restarting at 1. Otherwise "make everyone watch again" would stop working after a remove + re-upload.
const isLive = (v) => Boolean(v && typeof v.url === "string" && v.url);

async function readAll() {
  const keys = MEDIA_SLOTS.map(keyFor);
  const { data, error } = await supabaseAdmin.from("site_settings").select("key, value").in("key", keys);
  if (error) throw error;
  const out = {};
  for (const slot of MEDIA_SLOTS) {
    out[slot] = parseRaw((data || []).find((r) => r.key === keyFor(slot))?.value);
  }
  return out;
}

export async function getMedia() {
  const raw = await readAll();
  const out = {};
  for (const slot of MEDIA_SLOTS) out[slot] = isLive(raw[slot]) ? raw[slot] : null;
  return out;
}

async function removeObject(path) {
  if (!path) return;
  try {
    await supabaseAdmin.storage.from(MEDIA_BUCKET).remove([path]);
  } catch (err) {
    console.error("siteMedia removeObject (non-fatal):", err);
  }
}

export async function saveMedia(slot, { url, path = null, forceRewatch = false }) {
  const raw = (await readAll())[slot];
  const current = isLive(raw) ? raw : null;
  const lastVersion = raw?.version || 0;
  const version = slot === "intro" ? (lastVersion ? (forceRewatch ? lastVersion + 1 : lastVersion) : 1) : 1;

  const value = { url, path, version, updatedAt: new Date().toISOString() };
  const { error } = await supabaseAdmin.from("site_settings").upsert({
    key: keyFor(slot),
    value: JSON.stringify(value),
    updated_at: value.updatedAt,
  });
  if (error) throw error;

  // The old file is no longer used by anything, so free the space.
  if (current?.path && current.path !== path) await removeObject(current.path);
  return value;
}

export async function clearMedia(slot) {
  const raw = (await readAll())[slot];
  const current = isLive(raw) ? raw : null;
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("site_settings").upsert({
    key: keyFor(slot),
    value: JSON.stringify({ url: "", path: null, version: raw?.version || 0, updatedAt: now }),
    updated_at: now,
  });
  if (error) throw error;
  if (current?.path) await removeObject(current.path);
}

let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  const { error } = await supabaseAdmin.storage.createBucket(MEDIA_BUCKET, { public: true });
  // "already exists" is the normal case after the first call.
  if (error && !/already exists|duplicate/i.test(error.message || "")) throw error;
  bucketReady = true;
}

/** A one-time URL the admin's browser can upload straight to storage (bypasses the API size limit). */
export async function createUploadTarget(slot, contentType) {
  await ensureBucket();
  const ext = contentType === "video/webm" ? "webm" : contentType === "video/quicktime" ? "mov" : "mp4";
  const path = `${slot}/${Date.now()}.${ext}`;
  const { data, error } = await supabaseAdmin.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  const { data: pub } = supabaseAdmin.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return { signedUrl: data.signedUrl, path, publicUrl: pub.publicUrl };
}
