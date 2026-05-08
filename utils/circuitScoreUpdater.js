import User from '../models/User.js';
import Post from '../models/Post.js';
import CommunityMessage from '../models/CommunityMessage.js';
import Goal from '../models/Goal.js';
import Streak from '../models/Streak.js';
import Community from '../models/Community.js';
import Application from '../models/Application.js';

// Raw score thresholds that map to component maximums
const PARTICIPATION_SCALE = 500; // raw score → 20 pts
const POST_SCALE = 300;          // raw score → 15 pts

// ── Tier assignment ────────────────────────────────────────────────────────────
export const getTier = (score) => {
  if (score >= 80) return 'Circuit Elite';
  if (score >= 60) return 'Established';
  if (score >= 30) return 'Rising';
  return 'Starter';
};

// ── Streak component (25 pts max) ─────────────────────────────────────────────
// 1–7 days: 1 pt/day; 8–30 days: 7 → 18 pts linear; 31+ days: 25 pts
const streakComponent = (currentStreak) => {
  if (currentStreak <= 0) return 0;
  if (currentStreak <= 7) return currentStreak;
  if (currentStreak <= 30) return 7 + ((currentStreak - 7) / 23) * 11;
  return 25;
};

// ── Full score computation ────────────────────────────────────────────────────
// Returns raw breakdown object (floats, not yet floored).
export const computeScoreBreakdown = async (userId) => {
  const uid = userId.toString();

  // Parallel fetches — group into one Promise.all to minimise round-trips
  const [streaks, ownPosts, msgCount, communitiesCount, postsWithMyLike, postsWithMyComment, applications] =
    await Promise.all([
      Streak.find({ user: userId }).select('currentStreak').lean(),
      Post.find({ author: userId }).select('likes comments').lean(),
      CommunityMessage.countDocuments({ sender: userId }),
      Community.countDocuments({ members: userId }),
      Post.countDocuments({ likes: userId }),
      Post.find({ 'comments.user': userId }).select('comments').lean(),
      Application.find({ user: userId }).populate('opportunity', 'type').lean(),
    ]);

  // ── 1. Streak (25 pts) ───────────────────────────────────────────────────
  const maxCurrentStreak = streaks.reduce((m, s) => Math.max(m, s.currentStreak || 0), 0);
  const streakScore = streakComponent(maxCurrentStreak);

  // ── 2. Goals (25 pts) ────────────────────────────────────────────────────
  const completedGoals = await Goal.find({ status: 'Completed', 'progress.user': userId }).lean();
  let rawGoals = 0;
  for (const goal of completedGoals) {
    const myEntry = goal.progress.find((p) => p.user.toString() === uid);
    if (!myEntry) continue;
    const maxPct = Math.max(...goal.progress.map((p) => p.percent));
    // Top contributor (tied for highest): 5 pts; contributor: 3 pts
    rawGoals += myEntry.percent >= maxPct ? 5 : 3;
  }
  const goalsScore = Math.min(25, rawGoals);

  // ── 3. Participation (20 pts) ─────────────────────────────────────────────
  // reactionsReceived = likes received on own posts
  const reactionsReceived = ownPosts.reduce((s, p) => s + (p.likes?.length || 0), 0);
  // replies = comments made by this user on any post
  const replies = postsWithMyComment.reduce(
    (s, p) => s + p.comments.filter((c) => c.user.toString() === uid).length,
    0,
  );

  const participationRaw =
    msgCount * 1.0 +
    postsWithMyLike * 0.5 +
    reactionsReceived * 1.5 +
    communitiesCount * 3.0 +
    replies * 1.2;

  const participationScore = Math.min(
    20,
    (Math.log1p(participationRaw) / Math.log1p(PARTICIPATION_SCALE)) * 20,
  );

  // ── 4. Posts & Content (15 pts) ───────────────────────────────────────────
  const postsMade = ownPosts.length;
  const commentsReceived = ownPosts.reduce((s, p) => s + (p.comments?.length || 0), 0);

  const postRaw =
    postsMade * 1.0 +
    replies * 0.8 +               // comments_made (same set as replies above)
    reactionsReceived * 1.5 +      // likes received on own posts
    commentsReceived * 2.0;

  const postScore = Math.min(
    15,
    (Math.log1p(postRaw) / Math.log1p(POST_SCALE)) * 15,
  );

  // ── 5. Opportunities Track Record (15 pts, permanent) ─────────────────────
  const challengeApps = applications.filter((a) => a.opportunity?.type === 'challenge');
  const entryPts = Math.min(3, challengeApps.length * 1);
  const winPts   = Math.min(8, challengeApps.filter((a) => a.status === 'accepted').length * 4);
  const gigRatings = applications.filter((a) => a.opportunity?.type === 'gig' && a.rating != null);
  const gigPts = Math.min(12, gigRatings.reduce((s, a) => s + (a.rating / 5) * 3, 0));
  const opportunitiesScore = Math.min(15, entryPts + winPts + gigPts);

  // ── Profile-completeness floor (10 pts) ───────────────────────────────────
  const user = await User.findById(userId).select('avatar bio').lean();
  const profileComplete = !!(user?.avatar && user?.bio?.trim() && communitiesCount > 0);

  const rawTotal = streakScore + goalsScore + participationScore + postScore + opportunitiesScore;
  const floored  = profileComplete ? Math.max(10, Math.floor(rawTotal)) : Math.floor(rawTotal);
  const total    = Math.min(100, floored);

  return {
    streakScore:        Math.round(streakScore * 10) / 10,
    goalsScore,
    participationScore: Math.round(participationScore * 10) / 10,
    postScore:          Math.round(postScore * 10) / 10,
    opportunitiesScore: Math.round(opportunitiesScore * 10) / 10,
    total,
  };
};

// ── Generate improvement tip ───────────────────────────────────────────────────
export const getImprovementTip = (breakdown) => {
  const components = [
    { current: breakdown.streakScore,        max: 25, tip: 'Keep your streak going to earn up to 25 points.' },
    { current: breakdown.goalsScore,         max: 25, tip: 'Complete community goals to earn up to 25 points.' },
    { current: breakdown.participationScore, max: 20, tip: 'Engage more in community discussions to earn up to 20 points.' },
    { current: breakdown.postScore,          max: 15, tip: 'Post content and get reactions to earn up to 15 points.' },
    { current: breakdown.opportunitiesScore, max: 15, tip: 'Apply to and complete Opportunities to earn up to 15 points.' },
  ];
  return components.reduce((best, c) => (c.max - c.current > best.max - best.current ? c : best)).tip;
};

// ── Main update function — call this non-blocking after any score-triggering event ──
export const updateCircuitScore = async (userId) => {
  try {
    const breakdown = await computeScoreBreakdown(userId);
    const tier = getTier(breakdown.total);
    await User.findByIdAndUpdate(userId, {
      circuitScore:      breakdown.total,
      circuitTier:       tier,
      goalsScore:        breakdown.goalsScore,
      opportunitiesScore: breakdown.opportunitiesScore,
    });
    return { ...breakdown, tier };
  } catch {
    // Non-fatal — score update failure should never block user actions
  }
};
