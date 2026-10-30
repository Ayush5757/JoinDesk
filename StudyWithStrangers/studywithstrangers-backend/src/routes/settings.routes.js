import { Router } from "express";
import { getAnnouncement } from "../controllers/settings.controller.js";
import { getScenes } from "../controllers/pomodoro.controller.js";
import { getPublicMedia } from "../controllers/siteMedia.controller.js";
import { getPublicTimings } from "../controllers/specialTimings.controller.js";

const router = Router();

// Public — no login needed to read the current site-wide notice.
// (Setting it is admin-only: PUT /api/admin/announcement.)
router.get("/announcement", getAnnouncement);
// Public: the background videos of the Focus Timer (managed in the admin panel).
router.get("/pomodoro-scenes", getScenes);
// Public: the intro video new visitors watch, and the help video in Suggestions & Complaints.
router.get("/site-media", getPublicMedia);
// Public: the "most popular study times" shown when joining a Special desk.
router.get("/special-timings", getPublicTimings);

export default router;
