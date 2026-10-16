import { Router } from "express";
import multer from "multer";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import {
  getPublicProfile,
  updateAvatar,
  blockUser,
  unblockUser,
  getMyBlocks,
  markSpecial,
  unmarkSpecial,
  getMySpecial,
  followUser,
  unfollowUser,
  getMyFollowing,
} from "../controllers/users.controller.js";
import { getUserDesks } from "../controllers/desks.controller.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

// IMPORTANT: literal "/me/..." routes must come before "/:id" so Express
// doesn't try to treat "me" as a user id.
router.get("/me/blocks", requireAuth, getMyBlocks);
router.get("/me/special", requireAuth, getMySpecial);
router.get("/me/following", requireAuth, getMyFollowing);
router.patch("/me/avatar", requireAuth, upload.single("avatar"), updateAvatar);

router.get("/:id", optionalAuth, getPublicProfile);
router.get("/:id/desks", optionalAuth, getUserDesks);
router.post("/:id/block", requireAuth, blockUser);
router.post("/:id/unblock", requireAuth, unblockUser);
router.post("/:id/follow", requireAuth, followUser); // anyone can follow a creator to get notified of their desks
router.delete("/:id/follow", requireAuth, unfollowUser);
router.post("/:id/special", requireAuth, markSpecial);
router.delete("/:id/special", requireAuth, unmarkSpecial);

export default router;
