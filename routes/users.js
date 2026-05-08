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
  getScoreBreakdown,
} from '../controllers/userController.js';
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUserRecruiterThreads,
  getUserRecruiterThread,
  sendUserRecruiterMessage,
} from '../controllers/recruiterController.js';

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
router.get('/:id/score-breakdown', protect, getScoreBreakdown);

// Notifications
router.get('/me/notifications', protect, getUserNotifications);
router.put('/me/notifications/read-all', protect, markAllNotificationsRead);
router.put('/me/notifications/:id/read', protect, markNotificationRead);

// Recruiter message threads (user side)
router.get('/me/recruiter-threads', protect, getUserRecruiterThreads);
router.get('/me/recruiter-threads/:recruiterId', protect, getUserRecruiterThread);
router.post('/me/recruiter-threads/:recruiterId', protect, sendUserRecruiterMessage);

export default router;
