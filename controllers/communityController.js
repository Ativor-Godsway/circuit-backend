import Community from '../models/Community.js';
import Goal from '../models/Goal.js';
import Streak from '../models/Streak.js';
import User from '../models/User.js';
import CommunityMessage from '../models/CommunityMessage.js';
import { uploadToCloudinary } from '../middleware/uploadMiddleware.js';
import { updateStreak } from '../utils/streakUpdater.js';
import { updateCircuitScore } from '../utils/circuitScoreUpdater.js';

// @desc    Get all communities — client handles category/search/tab filtering
// @route   GET /api/communities
export const getCommunities = async (req, res) => {
  const { userId } = req.query;
  const query = {};

  if (userId) {
    // Profile page: only communities this user belongs to
    query.members = userId;
  } else {
    // Discover: all public communities (client filters category, search, my-tab)
    query.privacy = 'public';
  }

  const communities = await Community.find(query)
    .populate('admin', 'name avatar')
    .lean()
    .sort({ createdAt: -1 });

  const currentUserId = req.user?._id?.toString() ?? null;

  const result = communities.map((c) => ({
    ...c,
    isMember: currentUserId
      ? c.members.some((m) => m.toString() === currentUserId)
      : false,
    memberCount: c.members.length,
  }));

  // Sort discover by popularity then recency
  if (!userId) {
    result.sort(
      (a, b) =>
        b.memberCount - a.memberCount ||
        new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  res.json(result);
};

// @desc    Create community
// @route   POST /api/communities
export const createCommunity = async (req, res) => {
  const { name, description, category, privacy } = req.body;
  if (!name) return res.status(400).json({ message: 'Community name is required' });

  let coverImage = '';
  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer);
    coverImage = result.secure_url;
  }

  const community = await Community.create({
    name,
    description: description || '',
    category: category || 'General',
    coverImage,
    privacy: privacy || 'public',
    admin: req.user._id,
    members: [req.user._id],
  });

  res.status(201).json(community);
};

// @desc    Get community by ID
// @route   GET /api/communities/:id
export const getCommunityById = async (req, res) => {
  const community = await Community.findById(req.params.id)
    .populate('admin', 'name avatar')
    .populate('members', 'name avatar university');

  if (!community) return res.status(404).json({ message: 'Community not found' });
  res.json(community);
};

// @desc    Join community
// @route   POST /api/communities/:id/join
export const joinCommunity = async (req, res) => {
  let community = await Community.findById(req.params.id);
  if (!community) return res.status(404).json({ message: 'Community not found' });

  if (!community.members.includes(req.user._id)) {
    community.members.push(req.user._id);
    await community.save();
    // Recompute score — joining a community boosts participation component
    updateCircuitScore(req.user._id);
  }

  community = await Community.findById(req.params.id).populate('admin', 'name avatar');
  const obj = community.toObject();
  obj.isMember = true;
  res.json(obj);
};

// @desc    Leave community
// @route   POST /api/communities/:id/leave
export const leaveCommunity = async (req, res) => {
  const community = await Community.findById(req.params.id);
  if (!community) return res.status(404).json({ message: 'Community not found' });

  if (community.admin.equals(req.user._id)) {
    return res.status(400).json({ message: 'Admin cannot leave the community' });
  }

  community.members = community.members.filter((m) => !m.equals(req.user._id));
  await community.save();
  res.json({ message: 'Left community' });
};

// @desc    Add goal (admin only)
// @route   POST /api/communities/:id/goals
export const addGoal = async (req, res) => {
  const community = await Community.findById(req.params.id);
  if (!community) return res.status(404).json({ message: 'Community not found' });

  if (!community.admin.equals(req.user._id)) {
    return res.status(403).json({ message: 'Only the admin can add goals' });
  }

  const { title, description, deadline } = req.body;
  if (!title) return res.status(400).json({ message: 'Goal title is required' });

  const goal = await Goal.create({
    community: community._id,
    title,
    description: description || '',
    deadline: deadline ? new Date(deadline) : undefined,
  });

  res.status(201).json(goal);
};

// @desc    Update goal progress
// @route   PUT /api/communities/:id/goals/:goalId
export const updateGoalProgress = async (req, res) => {
  const goal = await Goal.findById(req.params.goalId);
  if (!goal) return res.status(404).json({ message: 'Goal not found' });

  const { percent, status } = req.body;

  // Update or add the current user's progress entry
  if (percent !== undefined) {
    const idx = goal.progress.findIndex((p) => p.user.equals(req.user._id));
    if (idx >= 0) {
      goal.progress[idx].percent = percent;
    } else {
      goal.progress.push({ user: req.user._id, percent });
    }
  }

  if (status) goal.status = status;

  await goal.save();

  // Recompute circuit score when goal progress changes (non-blocking)
  updateCircuitScore(req.user._id);

  res.json(goal);
};

// @desc    Get community goals
// @route   GET /api/communities/:id/goals
export const getCommunityGoals = async (req, res) => {
  const goals = await Goal.find({ community: req.params.id })
    .populate('progress.user', 'name avatar')
    .sort({ createdAt: -1 });
  res.json(goals);
};

// @desc    Get community members with streaks and circuit scores
// @route   GET /api/communities/:id/members
export const getCommunityMembers = async (req, res) => {
  const community = await Community.findById(req.params.id).populate(
    'members',
    'name avatar university circuitScore circuitTier'
  );
  if (!community) return res.status(404).json({ message: 'Community not found' });

  const streaks = await Streak.find({ community: req.params.id });
  const streakMap = Object.fromEntries(streaks.map((s) => [s.user.toString(), s]));

  const membersWithStreaks = community.members.map((m) => {
    const streak = streakMap[m._id.toString()];
    return {
      _id: m._id,
      name: m.name,
      avatar: m.avatar,
      university: m.university,
      circuitScore: m.circuitScore || 0,
      circuitTier: m.circuitTier || 'Starter',
      isAdmin: community.admin.equals(m._id),
      currentStreak: streak?.currentStreak || 0,
      longestStreak: streak?.longestStreak || 0,
    };
  });

  res.json(membersWithStreaks);
};

// @desc    Circuit Score leaderboard — top 5 members in this community by score
// @route   GET /api/communities/:id/circuit-leaderboard
export const getCircuitLeaderboard = async (req, res) => {
  const community = await Community.findById(req.params.id)
    .populate('members', 'name avatar circuitScore circuitTier university')
    .lean();

  if (!community) return res.status(404).json({ message: 'Community not found' });

  const top5 = [...community.members]
    .sort((a, b) => (b.circuitScore || 0) - (a.circuitScore || 0))
    .slice(0, 5)
    .map((m) => ({
      _id: m._id,
      name: m.name,
      avatar: m.avatar,
      university: m.university,
      circuitScore: m.circuitScore || 0,
      circuitTier: m.circuitTier || 'Starter',
    }));

  res.json(top5);
};

// @desc    Invite user to community by email or username
// @route   POST /api/communities/:id/invite
export const inviteToCommunit = async (req, res) => {
  const community = await Community.findById(req.params.id);
  if (!community) return res.status(404).json({ message: 'Community not found' });

  if (!community.admin.equals(req.user._id)) {
    return res.status(403).json({ message: 'Only the admin can invite members' });
  }

  const { email, username } = req.body;
  const invitee = await User.findOne(email ? { email } : { name: username });
  if (!invitee) return res.status(404).json({ message: 'User not found' });

  if (community.members.includes(invitee._id)) {
    return res.status(400).json({ message: 'User is already a member' });
  }

  community.members.push(invitee._id);
  await community.save();
  res.json({ message: 'User added to community' });
};

// @desc    Get community chat messages (paginated)
// @route   GET /api/communities/:id/messages?page=1&limit=30
export const getCommunityMessages = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  const skip = (page - 1) * limit;

  const total = await CommunityMessage.countDocuments({ community: req.params.id });
  const messages = await CommunityMessage.find({ community: req.params.id })
    .populate('sender', '_id name avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // Return oldest-first for rendering
  res.json({ messages: messages.reverse(), total, page, hasMore: skip + limit < total });
};

// @desc    Send community chat message (REST fallback + socket broadcast)
// @route   POST /api/communities/:id/messages
export const sendCommunityMessage = async (req, res) => {
  const { text } = req.body;
  let image = '';

  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer);
    image = result.secure_url;
  }

  if (!text?.trim() && !image) {
    return res.status(400).json({ message: 'Message must have text or image' });
  }

  const msg = await CommunityMessage.create({
    community: req.params.id,
    sender: req.user._id,
    text: text?.trim() || '',
    image,
  });

  const populated = await msg.populate('sender', '_id name avatar');
  await updateStreak(req.user._id, req.params.id);

  // Emit via socket if available
  const io = req.app.get('io');
  if (io) {
    io.to(`community:${req.params.id}`).emit('receiveCommunityMessage', populated);
  }

  res.status(201).json(populated);
};

// @desc    Get community streak leaderboard
// @route   GET /api/communities/:id/streaks
export const getCommunityStreaks = async (req, res) => {
  const streaks = await Streak.find({ community: req.params.id })
    .populate('user', 'name avatar')
    .sort({ currentStreak: -1 });
  res.json(streaks);
};
