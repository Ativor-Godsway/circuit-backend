import express from 'express';
import { upload } from '../middleware/uploadMiddleware.js';
import { protect, optionalProtect } from '../middleware/authMiddleware.js';
import {
  getUserById,
  updateUser,
  getUserPosts,
  getUserStreaks,
  getUserGoals,
  getSuggestions,
  searchUsers,
  getScoreBreakdown,
  followUser,
  unfollowUser,
  getMyStats,
} from '../controllers/userController.js';
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUserRecruiterThreads,
  getUserRecruiterThread,
  sendUserRecruiterMessage,
} from '../controllers/recruiterController.js';
import { getUserProjects, createProject, updateProject, deleteProject } from '../controllers/projectController.js';
import { getWorkExperience, addWorkExperience, updateWorkExperience, deleteWorkExperience,
  getEducation, addEducation, updateEducation, deleteEducation } from '../controllers/workEducationController.js';

const router = express.Router();

router.get('/suggestions', protect, getSuggestions);
router.get('/search', protect, searchUsers);

router.get('/:id', optionalProtect, getUserById);
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
router.get('/:id/stats', protect, getMyStats);

// Follow / unfollow
router.post('/:id/follow', protect, followUser);
router.delete('/:id/follow', protect, unfollowUser);

// Projects
router.get('/:id/projects', getUserProjects);
router.post('/:id/projects', protect, upload.single('coverImage'), createProject);
router.put('/:id/projects/:projectId', protect, upload.single('coverImage'), updateProject);
router.delete('/:id/projects/:projectId', protect, deleteProject);

// Work experience
router.get('/:id/work', getWorkExperience);
router.post('/:id/work', protect, addWorkExperience);
router.put('/:id/work/:entryId', protect, updateWorkExperience);
router.delete('/:id/work/:entryId', protect, deleteWorkExperience);

// Education
router.get('/:id/education', getEducation);
router.post('/:id/education', protect, addEducation);
router.put('/:id/education/:entryId', protect, updateEducation);
router.delete('/:id/education/:entryId', protect, deleteEducation);

// Notifications
router.get('/me/notifications', protect, getUserNotifications);
router.put('/me/notifications/read-all', protect, markAllNotificationsRead);
router.put('/me/notifications/:id/read', protect, markNotificationRead);

// Recruiter message threads (user side)
router.get('/me/recruiter-threads', protect, getUserRecruiterThreads);
router.get('/me/recruiter-threads/:recruiterId', protect, getUserRecruiterThread);
router.post('/me/recruiter-threads/:recruiterId', protect, sendUserRecruiterMessage);

export default router;
