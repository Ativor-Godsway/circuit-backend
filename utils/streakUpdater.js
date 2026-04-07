import Streak from '../models/Streak.js';

/**
 * Increment streak for a user in a community.
 * - Streaks are counted in calendar days (UTC).
 * - Called when the user posts or sends a community message.
 */
export const updateStreak = async (userId, communityId) => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  let streak = await Streak.findOne({ user: userId, community: communityId });

  if (!streak) {
    // First activity — create a new streak record
    streak = await Streak.create({
      user: userId,
      community: communityId,
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDate: today,
    });
    return streak;
  }

  // Already active today — no change needed
  if (streak.lastActiveDate === today) return streak;

  const last = new Date(streak.lastActiveDate + 'T00:00:00Z');
  const now = new Date(today + 'T00:00:00Z');
  const diffDays = Math.round((now - last) / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    // Consecutive day — extend streak
    streak.currentStreak += 1;
  } else {
    // Gap — reset streak
    streak.currentStreak = 1;
  }

  streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
  streak.lastActiveDate = today;

  await streak.save();
  return streak;
};

/**
 * Reset streaks for users who missed yesterday.
 * Called daily by the cron job.
 */
export const resetInactiveStreaks = async () => {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yDate = yesterday.toISOString().split('T')[0];

  // Find all streaks where lastActiveDate is not today or yesterday
  await Streak.updateMany(
    { lastActiveDate: { $lt: yDate } },
    { $set: { currentStreak: 0 } }
  );
};
