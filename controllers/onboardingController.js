import User from '../models/User.js';
import Community from '../models/Community.js';
import Follow from '../models/Follow.js';
import PersonalGoal from '../models/PersonalGoal.js';
import { uploadToCloudinary } from '../middleware/uploadMiddleware.js';
import { updateCircuitScore } from '../utils/circuitScoreUpdater.js';
import { updateProfileCompletion } from '../utils/profileCompletion.js';

// @desc    Get community suggestions ordered by interest overlap then memberCount
// @route   GET /api/onboarding/communities?interests=Design,Technology
export const getOnboardingCommunities = async (req, res) => {
  const raw = req.query.interests || '';
  const interests = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const communities = await Community.find({ privacy: 'public' })
    .lean()
    .sort({ createdAt: -1 });

  const scored = communities.map((c) => {
    const cTags = (c.tags || []).map((t) => t.toLowerCase());
    const overlap = interests.filter((i) => cTags.includes(i)).length;
    return { ...c, overlap, memberCount: c.members.length };
  });

  scored.sort((a, b) => b.overlap - a.overlap || b.memberCount - a.memberCount);

  res.json(scored.slice(0, 6));
};

// @desc    Get suggested users to follow during onboarding
//          Priority: members of joined communities → overlapping interests → circuit score desc
// @route   GET /api/onboarding/suggestions?communityIds=id1,id2&interests=Design
export const getOnboardingSuggestions = async (req, res) => {
  const rawIds = (req.query.communityIds || '').split(',').filter(Boolean);
  const interests = (req.query.interests || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Collect candidate users from joined communities
  let memberIds = [];
  if (rawIds.length > 0) {
    const comms = await Community.find({ _id: { $in: rawIds } })
      .select('members')
      .lean();
    memberIds = comms.flatMap((c) => c.members.map(String));
  }

  const currentId = req.user._id.toString();
  const uniqueIds = [...new Set(memberIds)].filter((id) => id !== currentId);

  // Build query: first prefer community members, fall back to all users
  let users = [];

  if (uniqueIds.length >= 8) {
    users = await User.find({ _id: { $in: uniqueIds } })
      .select('name avatar circuitScore circuitTier interests')
      .sort({ circuitScore: -1 })
      .limit(8)
      .lean();
  } else {
    // Top-up with interest-overlapping users
    const topUp = await User.aggregate([
      { $match: { _id: { $ne: req.user._id }, interests: { $in: interests } } },
      { $sort: { circuitScore: -1 } },
      { $limit: 12 },
      { $project: { name: 1, avatar: 1, circuitScore: 1, circuitTier: 1, interests: 1 } },
    ]);

    const seen = new Set(uniqueIds);
    const combined = [
      ...await User.find({ _id: { $in: uniqueIds } })
        .select('name avatar circuitScore circuitTier interests')
        .lean(),
      ...topUp.filter((u) => !seen.has(String(u._id))),
    ].filter((u) => String(u._id) !== currentId);

    combined.sort((a, b) => (b.circuitScore || 0) - (a.circuitScore || 0));
    users = combined.slice(0, 8);
  }

  res.json(users);
};

// @desc    Follow multiple users at once (onboarding step 3)
// @route   POST /api/onboarding/follow
export const followMultiple = async (req, res) => {
  const { userIds } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ message: 'Please provide at least one user to follow' });
  }

  const ops = userIds.map((id) => ({
    updateOne: {
      filter: { follower: req.user._id, following: id },
      update: { $setOnInsert: { follower: req.user._id, following: id } },
      upsert: true,
    },
  }));

  const result = await Follow.bulkWrite(ops, { ordered: false });
  const newFollows = result.upsertedCount || 0;

  // Update follower/following counts non-blocking
  if (newFollows > 0) {
    User.findByIdAndUpdate(req.user._id, { $inc: { followingCount: newFollows } }).catch(() => {});
    User.updateMany({ _id: { $in: userIds } }, { $inc: { followerCount: 1 } }).catch(() => {});
  }

  res.json({ followed: userIds.length });
};

// @desc    Complete onboarding — save step-5 profile data, set onboardingComplete, create goal
// @route   POST /api/onboarding/complete
export const completeOnboarding = async (req, res) => {
  const { bio, location, goalTitle } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (bio !== undefined) user.bio = bio.slice(0, 300);
  if (location !== undefined) user.location = location.slice(0, 100);
  user.onboardingComplete = true;

  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer);
    user.avatar = result.secure_url;
  }

  await user.save();

  // Create personal goal if provided
  if (goalTitle?.trim()) {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);
    await PersonalGoal.create({ user: user._id, title: goalTitle.trim(), deadline });
  }

  // Non-blocking score + completion update
  updateCircuitScore(user._id).catch(() => {});
  updateProfileCompletion(user._id).catch(() => {});

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    bio: user.bio,
    location: user.location,
    onboardingComplete: user.onboardingComplete,
    circuitScore: user.circuitScore,
    circuitTier: user.circuitTier,
    profileCompletion: user.profileCompletion,
  });
};
