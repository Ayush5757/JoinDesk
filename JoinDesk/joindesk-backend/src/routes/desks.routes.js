import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createDesk, getDesks } from "../controllers/desks.controller.js";

const router = Router();

router.get("/", getDesks); // public
router.post("/", requireAuth, createDesk); // requires login

export default router;
