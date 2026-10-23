import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getPublicKey, subscribe, unsubscribe } from "../controllers/push.controller.js";

const router = Router();

router.get("/vapid-public-key", getPublicKey); // public, no secret in it
router.post("/subscribe", requireAuth, subscribe);
router.post("/unsubscribe", requireAuth, unsubscribe);

export default router;
