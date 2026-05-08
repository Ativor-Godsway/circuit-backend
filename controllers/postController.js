import Post from '../models/Post.js';
import Community from '../models/Community.js';
import { updateStreak } from '../utils/streakUpdater.js';
import { updateCircuitScore } from '../utils/circuitScoreUpdater.js';
import { uploadToCloudinary } from '../middleware/uploadMiddleware.js';

// @desc    Get paginated feed
// @route   GET /api/posts?page=1&limit=10&category=
export const getPosts = async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 10);
  const { category } = req.query;

  const query = category && category !== 'All' ? { category } : {};

  const [total, posts] = await Promise.all([
    Post.countDocuments(query),
    Post.find(query)
      .populate('author',        'name avatar')
      .populate('comments.user', 'name avatar')
      .select('author text image category likes comments createdAt')
      .lean()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  res.json({
    posts,
    total,
    page,
    pages: Math.ceil(total / limit),
    hasMore: page < Math.ceil(total / limit),
  });
};

// @desc    Create post
// @route   POST /api/posts
export const createPost = async (req, res) => {
  const { text, category } = req.body;
  if (!text) return res.status(400).json({ message: 'Post text is required' });

  let image = '';
  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer);
    image = result.secure_url;
  }

  const post = await Post.create({
    author: req.user._id,
    text,
    category: category || 'General',
    image,
  });

  const populated = await post.populate('author', 'name avatar');

  // Update streak for every community the user belongs to
  const communities = await Community.find({ members: req.user._id }, '_id').lean();
  await Promise.all(communities.map((c) => updateStreak(req.user._id, c._id)));

  // Recompute circuit score (non-blocking)
  updateCircuitScore(req.user._id);

  res.status(201).json(populated);
};

// @desc    Like / unlike a post
// @route   PUT /api/posts/:id/like
export const likePost = async (req, res) => {
  const post = await Post.findById(req.params.id).select('likes author');
  if (!post) return res.status(404).json({ message: 'Post not found' });

  const userId = req.user._id;
  const liked  = post.likes.some((id) => id.equals(userId));

  if (liked) {
    post.likes = post.likes.filter((id) => !id.equals(userId));
  } else {
    post.likes.push(userId);
  }

  await post.save();

  // Reactions affect both the liker (participation) and post author (post score)
  updateCircuitScore(userId);
  if (!post.author.equals(userId)) updateCircuitScore(post.author);

  res.json({ likes: post.likes, liked: !liked });
};

// @desc    Comment on a post
// @route   POST /api/posts/:id/comment
export const commentPost = async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ message: 'Comment text is required' });

  const post = await Post.findById(req.params.id).select('author comments');
  if (!post) return res.status(404).json({ message: 'Post not found' });

  post.comments.push({ user: req.user._id, text });
  await post.save();
  await post.populate('comments.user', 'name avatar');

  // Comment affects the commenter (participation/post) and the post author (commentsReceived)
  updateCircuitScore(req.user._id);
  if (!post.author.equals(req.user._id)) updateCircuitScore(post.author);

  res.status(201).json(post.comments[post.comments.length - 1]);
};

// @desc    Delete post (owner only)
// @route   DELETE /api/posts/:id
export const deletePost = async (req, res) => {
  const post = await Post.findById(req.params.id).select('author');
  if (!post) return res.status(404).json({ message: 'Post not found' });

  if (!post.author.equals(req.user._id)) {
    return res.status(403).json({ message: 'Not authorized to delete this post' });
  }

  await post.deleteOne();
  res.json({ message: 'Post deleted' });
};
