import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createFeedback } from "../controllers/feedback.controller.js";

const router = Router();

router.post("/", requireAuth, createFeedback);

export default router;
