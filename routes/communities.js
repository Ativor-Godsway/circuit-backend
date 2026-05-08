import express from "express";
import { upload } from "../middleware/uploadMiddleware.js";
import { protect, optionalProtect } from "../middleware/authMiddleware.js";
import {
  getCommunities,
  createCommunity,
  getCommunityById,
  joinCommunity,
  leaveCommunity,
  addGoal,
  updateGoalProgress,
  getCommunityGoals,
  getCommunityMembers,
  getCircuitLeaderboard,
  inviteToCommunit,
  getCommunityMessages,
  sendCommunityMessage,
  getCommunityStreaks,
} from "../controllers/communityController.js";

const router = express.Router();

router.get("/", optionalProtect, getCommunities);
router.post("/", protect, upload.single("coverImage"), createCommunity);
router.get("/:id", getCommunityById);
router.post("/:id/join", protect, joinCommunity);
router.post("/:id/leave", protect, leaveCommunity);
router.post("/:id/goals", protect, addGoal);
router.put("/:id/goals/:goalId", protect, updateGoalProgress);
router.get("/:id/goals", protect, getCommunityGoals);
router.get("/:id/members", protect, getCommunityMembers);
router.get("/:id/circuit-leaderboard", protect, getCircuitLeaderboard);
router.post("/:id/invite", protect, inviteToCommunit);
router.get("/:id/messages", protect, getCommunityMessages);
router.post("/:id/messages", protect, upload.single("image"), sendCommunityMessage);
router.get("/:id/streaks", protect, getCommunityStreaks);

export default router;
