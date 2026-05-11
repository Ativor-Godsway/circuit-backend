import express from 'express';
import { upload } from '../middleware/uploadMiddleware.js';
import { protect } from '../middleware/authMiddleware.js';
import {
  getOnboardingCommunities,
  getOnboardingSuggestions,
  followMultiple,
  completeOnboarding,
} from '../controllers/onboardingController.js';

const router = express.Router();

router.get('/communities', protect, getOnboardingCommunities);
router.get('/suggestions', protect, getOnboardingSuggestions);
router.post('/follow', protect, followMultiple);
router.post('/complete', protect, upload.single('avatar'), completeOnboarding);

export default router;
