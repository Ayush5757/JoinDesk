import { Router } from "express";
import crypto from "node:crypto";
import "dotenv/config";
import { notifyExpiredDesks } from "../services/deskExpiry.js";

const router = Router();

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/**
 * GET/POST /api/cron/desk-expiry
 * For schedulers (cron-job.org, Vercel Cron, GitHub Actions...). Send the header
 *   Authorization: Bearer <CRON_SECRET>
 * Without CRON_SECRET set in .env this endpoint is switched off.
 */
async function deskExpiry(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(404).json({ error: "Not found" });

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !safeEqual(token, secret)) return res.status(401).json({ error: "Unauthorized" });

  const announced = await notifyExpiredDesks();
  return res.status(200).json({ ok: true, announced });
}

router.get("/desk-expiry", deskExpiry);
router.post("/desk-expiry", deskExpiry);

export default router;
