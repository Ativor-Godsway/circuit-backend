import express from 'express';
import { register, login, googleAuth, appleAuth, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.post('/register', upload.single('avatar'), register);
router.post('/login', login);
router.post('/google', googleAuth);
router.post('/apple', appleAuth);
router.get('/me', protect, getMe);

export default router;
