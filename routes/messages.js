import express from 'express';
import { upload } from '../middleware/uploadMiddleware.js';
import { protect } from '../middleware/authMiddleware.js';
import {
  getConversations,
  getUnreadCount,
  getMessages,
  sendMessage,
  markAsRead,
} from '../controllers/messageController.js';

const router = express.Router();

router.get('/conversations', protect, getConversations);
router.get('/unread-count', protect, getUnreadCount);
router.get('/:userId', protect, getMessages);
router.post('/:userId', protect, upload.single('image'), sendMessage);
router.put('/:userId/read', protect, markAsRead);

export default router;
