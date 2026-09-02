import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import {
  unlockAdmin,
  listDesks,
  createDesk,
  listUsers,
  blockUserAdmin,
  unblockUserAdmin,
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

router.get("/users", requireAdmin, listUsers);
router.post("/users/:id/block", requireAdmin, blockUserAdmin);
router.post("/users/:id/unblock", requireAdmin, unblockUserAdmin);

export default router;
