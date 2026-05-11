import User from '../models/User.js';
import Post from '../models/Post.js';
import Streak from '../models/Streak.js';
import Goal from '../models/Goal.js';
import Follow from '../models/Follow.js';
import { uploadToCloudinary } from '../middleware/uploadMiddleware.js';
import { computeScoreBreakdown, getImprovementTip, getTier } from '../utils/circuitScoreUpdater.js';
import { updateProfileCompletion } from '../utils/profileCompletion.js';

// @desc    Get user by ID
// @route   GET /api/users/:id
export const getUserById = async (req, res) => {
  const user = await User.findById(req.params.id).select('-password').lean();
  if (!user) return res.status(404).json({ message: 'User not found' });

  // Attach isFollowing if viewer is logged in
  let isFollowing = false;
  if (req.user) {
    const follow = await Follow.findOne({ follower: req.user._id, following: user._id }).lean();
    isFollowing = !!follow;
  }

  res.json({ ...user, isFollowing });
};

// @desc    Update user profile (own only)
// @route   PUT /api/users/:id
export const updateUser = async (req, res) => {
  if (req.user._id.toString() !== req.params.id) {
    return res.status(403).json({ message: 'Not authorized to update this profile' });
  }

  const { name, bio, university, interests, discoverable, location, skills } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (name) user.name = name;
  if (bio !== undefined) user.bio = bio;
  if (university !== undefined) user.university = university;
  if (location !== undefined) user.location = location;
  if (discoverable !== undefined) user.discoverable = discoverable === 'true' || discoverable === true;

  if (interests !== undefined) {
    try { user.interests = JSON.parse(interests); } catch { user.interests = []; }
  }
  if (skills !== undefined) {
    try { user.skills = JSON.parse(skills); } catch { user.skills = []; }
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
  updateProfileCompletion(user._id).catch(() => {});

  res.json({
    _id: updated._id,
    name: updated.name,
    email: updated.email,
    avatar: updated.avatar,
    coverPhoto: updated.coverPhoto,
    bio: updated.bio,
    university: updated.university,
    location: updated.location,
    interests: updated.interests,
    skills: updated.skills,
    discoverable: updated.discoverable,
    onboardingComplete: updated.onboardingComplete,
    circuitScore: updated.circuitScore,
    circuitTier: updated.circuitTier,
    profileCompletion: updated.profileCompletion,
  });
};

// @desc    Get posts by user
// @route   GET /api/users/:id/posts
export const getUserPosts = async (req, res) => {
  const posts = await Post.find({ author: req.params.id })
    .populate('author', 'name avatar circuitTier circuitScore')
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
    { $project: { name: 1, avatar: 1, university: 1, circuitTier: 1, circuitScore: 1 } },
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
    .select('name avatar university circuitTier circuitScore')
    .limit(10);

  res.json(users);
};

// @desc    Follow a user
// @route   POST /api/users/:id/follow
export const followUser = async (req, res) => {
  const targetId = req.params.id;
  if (targetId === req.user._id.toString()) {
    return res.status(400).json({ message: 'You cannot follow yourself' });
  }

  const target = await User.findById(targetId).select('_id');
  if (!target) return res.status(404).json({ message: 'User not found' });

  try {
    await Follow.create({ follower: req.user._id, following: targetId });
    User.findByIdAndUpdate(req.user._id, { $inc: { followingCount: 1 } }).catch(() => {});
    User.findByIdAndUpdate(targetId, { $inc: { followerCount: 1 } }).catch(() => {});
    res.json({ isFollowing: true });
  } catch (err) {
    if (err.code === 11000) return res.json({ isFollowing: true }); // already following
    throw err;
  }
};

// @desc    Unfollow a user
// @route   DELETE /api/users/:id/follow
export const unfollowUser = async (req, res) => {
  const result = await Follow.findOneAndDelete({ follower: req.user._id, following: req.params.id });
  if (result) {
    User.findByIdAndUpdate(req.user._id, { $inc: { followingCount: -1 } }).catch(() => {});
    User.findByIdAndUpdate(req.params.id, { $inc: { followerCount: -1 } }).catch(() => {});
  }
  res.json({ isFollowing: false });
};

// @desc    Get follow stats for own profile (private)
// @route   GET /api/users/:id/stats
export const getMyStats = async (req, res) => {
  if (req.user._id.toString() !== req.params.id) {
    return res.status(403).json({ message: 'Stats are private' });
  }

  const [user, postCount, followerCount, followingCount] = await Promise.all([
    User.findById(req.params.id).select('followerCount followingCount').lean(),
    Post.countDocuments({ author: req.params.id }),
    Follow.countDocuments({ following: req.params.id }),
    Follow.countDocuments({ follower: req.params.id }),
  ]);

  res.json({
    posts: postCount,
    followers: followerCount,
    following: followingCount,
  });
};
