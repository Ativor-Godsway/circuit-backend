import User from '../models/User.js';
import Post from '../models/Post.js';
import Streak from '../models/Streak.js';
import Goal from '../models/Goal.js';
import { uploadToCloudinary } from '../middleware/uploadMiddleware.js';
import { computeScoreBreakdown, getImprovementTip, getTier } from '../utils/circuitScoreUpdater.js';

// @desc    Get user by ID
// @route   GET /api/users/:id
export const getUserById = async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
};

// @desc    Update user profile (own only)
// @route   PUT /api/users/:id
export const updateUser = async (req, res) => {
  if (req.user._id.toString() !== req.params.id) {
    return res.status(403).json({ message: 'Not authorized to update this profile' });
  }

  const { name, bio, university, interests, discoverable } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (name) user.name = name;
  if (bio !== undefined) user.bio = bio;
  if (university !== undefined) user.university = university;
  if (discoverable !== undefined) user.discoverable = discoverable === 'true' || discoverable === true;

  if (interests !== undefined) {
    try {
      user.interests = JSON.parse(interests);
    } catch {
      user.interests = [];
    }
  }

  if (req.files?.avatar?.[0]) {
    const result = await uploadToCloudinary(req.files.avatar[0].buffer);
    user.avatar = result.secure_url;
  }
  if (req.files?.coverPhoto?.[0]) {
    const result = await uploadToCloudinary(req.files.coverPhoto[0].buffer);
    user.coverPhoto = result.secure_url;
  }

  const updated = await user.save();
  res.json({
    _id: updated._id,
    name: updated.name,
    email: updated.email,
    avatar: updated.avatar,
    coverPhoto: updated.coverPhoto,
    bio: updated.bio,
    university: updated.university,
    interests: updated.interests,
    discoverable: updated.discoverable,
  });
};

// @desc    Get posts by user
// @route   GET /api/users/:id/posts
export const getUserPosts = async (req, res) => {
  const posts = await Post.find({ author: req.params.id })
    .populate('author', 'name avatar')
    .sort({ createdAt: -1 })
    .limit(50);
  res.json(posts);
};

// @desc    Get user's streaks across all communities
// @route   GET /api/users/:id/streaks
export const getUserStreaks = async (req, res) => {
  const streaks = await Streak.find({ user: req.params.id })
    .populate('community', 'name coverImage')
    .sort({ longestStreak: -1 });
  res.json(streaks);
};

// @desc    Get goals the user is participating in
// @route   GET /api/users/:id/goals
export const getUserGoals = async (req, res) => {
  const userId = req.params.id;
  const goals = await Goal.find({ 'progress.user': userId })
    .populate('community', 'name')
    .sort({ createdAt: -1 })
    .limit(20);

  const result = goals.map((goal) => {
    const userProgress = goal.progress.find((p) => p.user.toString() === userId);
    return {
      _id: goal._id,
      title: goal.title,
      description: goal.description,
      deadline: goal.deadline,
      status: goal.status,
      community: goal.community,
      userPercent: userProgress?.percent || 0,
    };
  });

  res.json(result);
};

// @desc    Suggest users (random sample excluding current user)
// @route   GET /api/users/suggestions
export const getSuggestions = async (req, res) => {
  const users = await User.aggregate([
    { $match: { _id: { $ne: req.user._id } } },
    { $sample: { size: 10 } },
    { $project: { name: 1, avatar: 1, university: 1 } },
  ]);
  res.json(users);
};

// @desc    Circuit Score breakdown — visible only to the profile owner
// @route   GET /api/users/:id/score-breakdown
export const getScoreBreakdown = async (req, res) => {
  if (req.user._id.toString() !== req.params.id) {
    return res.status(403).json({ message: 'Score breakdown is only visible to the profile owner' });
  }

  const breakdown = await computeScoreBreakdown(req.params.id);
  const tier = getTier(breakdown.total);
  const tip  = getImprovementTip(breakdown);

  res.json({ ...breakdown, tier, tip });
};

// @desc    Search users by name (excludes current user)
// @route   GET /api/users/search?q=term
export const searchUsers = async (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) return res.json([]);

  const users = await User.find({
    _id: { $ne: req.user._id },
    name: { $regex: q.trim(), $options: 'i' },
  })
    .select('name avatar university')
    .limit(10);

  res.json(users);
};
