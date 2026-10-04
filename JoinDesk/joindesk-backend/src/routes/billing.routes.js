import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getConfig,
  getStatus,
  createOrder,
  verifyPayment,
  webhook,
} from "../controllers/billing.controller.js";

const router = Router();

router.get("/config", getConfig); // public: price / trial / paywall on-off
router.get("/status", requireAuth, getStatus);
router.post("/order", requireAuth, createOrder);
router.post("/verify", requireAuth, verifyPayment);
router.post("/webhook", webhook); // public, but signature-checked

export default router;
