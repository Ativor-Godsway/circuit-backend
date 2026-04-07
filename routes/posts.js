import express from 'express';
import { upload } from '../middleware/uploadMiddleware.js';
import { protect } from '../middleware/authMiddleware.js';
import { getPosts, createPost, likePost, commentPost, deletePost } from '../controllers/postController.js';

const router = express.Router();

router.get('/', getPosts);
router.post('/', protect, upload.single('image'), createPost);
router.put('/:id/like', protect, likePost);
router.post('/:id/comment', protect, commentPost);
router.delete('/:id', protect, deletePost);

export default router;
