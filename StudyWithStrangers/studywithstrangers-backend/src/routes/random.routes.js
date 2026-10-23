import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getConfig,
  join,
  pollRoom,
  postOffer,
  postAnswer,
  leave,
  report,
  block,
} from "../controllers/random.controller.js";

const router = Router();

router.get("/config", requireAuth, getConfig);
router.post("/join", requireAuth, join); // Start and "Next"
router.get("/room/:id", requireAuth, pollRoom);
router.post("/room/:id/offer", requireAuth, postOffer);
router.post("/room/:id/answer", requireAuth, postAnswer);
router.post("/room/:id/leave", requireAuth, leave);
router.post("/room/:id/report", requireAuth, report);
router.post("/room/:id/block", requireAuth, block);

export default router;
