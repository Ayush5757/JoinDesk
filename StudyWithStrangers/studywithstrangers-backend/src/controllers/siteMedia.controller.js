import {
  MEDIA_SLOTS,
  MAX_VIDEO_MB,
  ALLOWED_VIDEO_TYPES,
  MEDIA_BUCKET,
  getMedia,
  saveMedia,
  clearMedia,
  createUploadTarget,
} from "../services/siteMedia.js";

const validSlot = (s) => MEDIA_SLOTS.includes(s);

/** What the public site needs: just the URL (and the intro's version). */
const toPublic = (m) => ({
  intro: m.intro ? { url: m.intro.url, version: m.intro.version || 1 } : null,
  feedback: m.feedback ? { url: m.feedback.url } : null,
});

/** GET /api/site-media (public) */
export async function getPublicMedia(req, res) {
  try {
    res.setHeader?.("Cache-Control", "public, max-age=30, s-maxage=30, stale-while-revalidate=120");
    return res.status(200).json(toPublic(await getMedia()));
  } catch (err) {
    console.error("getPublicMedia error:", err);
    // Never block the site because of this: behave as if there are no videos.
    return res.status(200).json({ intro: null, feedback: null });
  }
}

/** GET /api/admin/media (admin) - same, plus storage details so the panel can show what's live. */
export async function adminGetMedia(req, res) {
  try {
    const m = await getMedia();
    return res.status(200).json({ ...m, limits: { maxMb: MAX_VIDEO_MB, types: ALLOWED_VIDEO_TYPES } });
  } catch (err) {
    console.error("adminGetMedia error:", err);
    return res.status(500).json({ error: "Failed to load the videos" });
  }
}

/** POST /api/admin/media/upload-url  { slot, contentType, size } */
export async function adminCreateUploadUrl(req, res) {
  try {
    const { slot, contentType, size } = req.body || {};
    if (!validSlot(slot)) return res.status(400).json({ error: "Unknown video slot" });
    if (!ALLOWED_VIDEO_TYPES.includes(contentType)) {
      return res.status(400).json({ error: "Use an MP4 or WebM video (MP4 / H.264 works everywhere)." });
    }
    if (Number(size) > MAX_VIDEO_MB * 1024 * 1024) {
      return res.status(400).json({ error: `That file is too big. Keep it under ${MAX_VIDEO_MB} MB.` });
    }
    const target = await createUploadTarget(slot, contentType);
    return res.status(200).json({ ...target, bucket: MEDIA_BUCKET });
  } catch (err) {
    console.error("adminCreateUploadUrl error:", err);
    return res.status(500).json({ error: "Couldn't prepare the upload" });
  }
}

/** PUT /api/admin/media/:slot  { url, path?, forceRewatch? } */
export async function adminSaveMedia(req, res) {
  try {
    const { slot } = req.params;
    if (!validSlot(slot)) return res.status(400).json({ error: "Unknown video slot" });

    const url = typeof req.body?.url === "string" ? req.body.url.trim() : "";
    if (!/^https:\/\/\S+$/i.test(url)) {
      return res.status(400).json({ error: "The video link must start with https://" });
    }
    const path = typeof req.body?.path === "string" && req.body.path ? req.body.path : null;
    const saved = await saveMedia(slot, { url, path, forceRewatch: Boolean(req.body?.forceRewatch) });
    return res.status(200).json({ [slot]: saved });
  } catch (err) {
    console.error("adminSaveMedia error:", err);
    return res.status(500).json({ error: "Failed to save the video" });
  }
}

/** DELETE /api/admin/media/:slot */
export async function adminDeleteMedia(req, res) {
  try {
    const { slot } = req.params;
    if (!validSlot(slot)) return res.status(400).json({ error: "Unknown video slot" });
    await clearMedia(slot);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("adminDeleteMedia error:", err);
    return res.status(500).json({ error: "Failed to remove the video" });
  }
}
