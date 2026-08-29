import { Router } from "express";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import {
  createDesk,
  getDesks,
  getMyDesks,
  joinDesk,
  getDeskJoiners,
} from "../controllers/desks.controller.js";

const router = Router();

// IMPORTANT: "/mine" is a literal path and must be declared before any
// "/:id" route so Express doesn't try to treat "mine" as a desk id.
router.get("/mine", requireAuth, getMyDesks);

router.get("/", optionalAuth, getDesks); // public, but personalized (block filtering) when logged in
router.post("/", requireAuth, createDesk); // requires login

router.post("/:id/join", requireAuth, joinDesk);
router.get("/:id/joiners", requireAuth, getDeskJoiners);

export default router;
