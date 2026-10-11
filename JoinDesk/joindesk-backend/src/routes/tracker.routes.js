import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getState,
  startSession,
  pauseSession,
  endSession,
  createGoal,
  continueGoal,
  saveGoalProgress,
  getHistory,
  getReport,
} from "../controllers/tracker.controller.js";

const router = Router();

router.get("/state", requireAuth, getState);
router.post("/session/start", requireAuth, startSession); // also "resume" and "let's go"
router.post("/session/pause", requireAuth, pauseSession);
router.post("/session/end", requireAuth, endSession);

router.post("/goals", requireAuth, createGoal);
router.post("/goals/:id/continue", requireAuth, continueGoal);
router.post("/goals/:id/progress", requireAuth, saveGoalProgress);

router.get("/history", requireAuth, getHistory);
router.get("/report", requireAuth, getReport);

export default router;
