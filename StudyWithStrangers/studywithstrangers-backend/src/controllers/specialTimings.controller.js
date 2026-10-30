import { getTimings, saveTimings } from "../services/specialTimings.js";

/** GET /api/special-timings (public). Never blocks the site: on any problem it just returns "no timings". */
export async function getPublicTimings(req, res) {
  try {
    res.setHeader?.("Cache-Control", "public, max-age=30, s-maxage=30, stale-while-revalidate=120");
    return res.status(200).json(await getTimings());
  } catch (err) {
    console.error("getPublicTimings error:", err);
    return res.status(200).json({ all: [], byDesk: {} });
  }
}

/** GET /api/admin/special-timings */
export async function adminGetTimings(req, res) {
  try {
    return res.status(200).json(await getTimings());
  } catch (err) {
    console.error("adminGetTimings error:", err);
    return res.status(500).json({ error: "Failed to load the timings" });
  }
}

/** PUT /api/admin/special-timings  { all: [{start,end}], byDesk: { [deskId]: [{start,end}] } } */
export async function adminSaveTimings(req, res) {
  try {
    const saved = await saveTimings(req.body);
    if (!saved) {
      return res
        .status(400)
        .json({ error: "Each timing needs a valid start and end time (and they can't be the same). Max 12 per list." });
    }
    return res.status(200).json(saved);
  } catch (err) {
    console.error("adminSaveTimings error:", err);
    return res.status(500).json({ error: "Failed to save the timings" });
  }
}
