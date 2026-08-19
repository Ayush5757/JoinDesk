import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { googleLogin, getMe } from "../controllers/auth.controller.js";

const router = Router();

router.post("/google", googleLogin); // public: verifies the Google token itself
router.get("/me", requireAuth, getMe);

export default router;
