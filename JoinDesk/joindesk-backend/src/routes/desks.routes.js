import { Router } from "express";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import {
  createDesk,
  getDesks,
  getSpecialDesks,
  getMyDesks,
  joinDesk,
  getDeskJoiners,
  updateDesk,
  deleteDesk,
} from "../controllers/desks.controller.js";

const router = Router();

// IMPORTANT: literal paths ("/mine", "/special") must be declared before
// any "/:id" route so Express doesn't try to treat them as a desk id.
router.get("/mine", requireAuth, getMyDesks);
router.get("/special", optionalAuth, getSpecialDesks); // public: the "Special Desks" row + page

router.get("/", optionalAuth, getDesks); // public, but personalized (block filtering) when logged in
router.post("/", requireAuth, createDesk); // requires login

router.post("/:id/join", requireAuth, joinDesk);
router.get("/:id/joiners", requireAuth, getDeskJoiners);
router.patch("/:id", requireAuth, updateDesk); // creator (or admin) edits topic/description/link
router.delete("/:id", requireAuth, deleteDesk); // creator (or admin) deletes their desk

export default router;
