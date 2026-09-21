import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import {
  unlockAdmin,
  listDesks,
  createDesk,
  moveSpecialDesk,
  setSpecialDeskPosition,
  listUsers,
  blockUserAdmin,
  unblockUserAdmin,
  listFeedback,
  updateFeedbackStatus,
  setAnnouncement,
} from "../controllers/admin.controller.js";

const router = Router();

// Unlocking needs a normal login (requireAuth) plus the admin password.
router.post("/unlock", requireAuth, unlockAdmin);

// Everything else needs the short-lived admin token from /unlock.
// Editing/deleting a desk reuses PATCH/DELETE /api/desks/:id (see
// desks.routes.js) — that controller already grants admins full access
// when it sees an isAdmin token, so it isn't duplicated here.
router.get("/desks", requireAdmin, listDesks);
router.post("/desks", requireAdmin, createDesk);
// Special-desk manual ordering (Admin Panel "move up/down" arrows and
// "jump to position" input) — only meaningful for is_special desks.
router.patch("/desks/:id/move", requireAdmin, moveSpecialDesk);
router.patch("/desks/:id/position", requireAdmin, setSpecialDeskPosition);

router.get("/users", requireAdmin, listUsers);
router.post("/users/:id/block", requireAdmin, blockUserAdmin);
router.post("/users/:id/unblock", requireAdmin, unblockUserAdmin);

router.get("/feedback", requireAdmin, listFeedback);
router.patch("/feedback/:id/status", requireAdmin, updateFeedbackStatus);

// Site-wide announcement banner (Admin Panel "Notice" tab). Reading it is
// public — see GET /api/announcement in settings.routes.js.
router.patch("/announcement", requireAdmin, setAnnouncement);

export default router;
