import express from 'express';
import { upload } from '../middleware/uploadMiddleware.js';
import { protect } from '../middleware/authMiddleware.js';
import {
  getUserById,
  updateUser,
  getUserPosts,
  getUserStreaks,
  getUserGoals,
  getSuggestions,
  searchUsers,
} from '../controllers/userController.js';

const router = express.Router();

router.get('/suggestions', protect, getSuggestions);
router.get('/search', protect, searchUsers);
router.get('/:id', getUserById);
router.put(
  '/:id',
  protect,
  upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'coverPhoto', maxCount: 1 }]),
  updateUser
);
router.get('/:id/posts', getUserPosts);
router.get('/:id/streaks', getUserStreaks);
router.get('/:id/goals', getUserGoals);

export default router;
