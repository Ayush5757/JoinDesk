import { Router } from "express";
import { getAnnouncement } from "../controllers/settings.controller.js";
import { getScenes } from "../controllers/pomodoro.controller.js";

const router = Router();

// Public — no login needed to read the current site-wide notice.
// (Setting it is admin-only: PUT /api/admin/announcement.)
router.get("/announcement", getAnnouncement);
// Public: the background videos of the Focus Timer (managed in the admin panel).
router.get("/pomodoro-scenes", getScenes);

export default router;
