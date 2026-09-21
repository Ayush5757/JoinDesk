import { Router } from "express";
import { getAnnouncement } from "../controllers/settings.controller.js";

const router = Router();

// Public — no login needed to read the current site-wide notice.
// (Setting it is admin-only: PUT /api/admin/announcement.)
router.get("/announcement", getAnnouncement);

export default router;
