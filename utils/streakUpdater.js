import Streak from '../models/Streak.js';
import User from '../models/User.js';

/**
 * Increment streak for a user in a community.
 * Streaks are counted in calendar days (UTC).
 * Implements the Streak Shield: one shield per calendar month that absorbs
 * a missed day without resetting the streak.
 *
 * Returns { streak, shieldUsed } where shieldUsed is true when a shield was consumed.
 */
export const updateStreak = async (userId, communityId) => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  let streak = await Streak.findOne({ user: userId, community: communityId });

  if (!streak) {
    await Streak.create({
      user: userId,
      community: communityId,
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDate: today,
    });
    return { shieldUsed: false };
  }

  // Already active today — nothing to do
  if (streak.lastActiveDate === today) return { streak, shieldUsed: false };

  const last = new Date(streak.lastActiveDate + 'T00:00:00Z');
  const now  = new Date(today + 'T00:00:00Z');
  const diffDays = Math.round((now - last) / (1000 * 60 * 60 * 24));

  let shieldUsed = false;

  if (diffDays === 1) {
    // Consecutive day — extend streak
    streak.currentStreak += 1;
  } else {
    // Gap — check for streak shield
    const user = await User.findById(userId).select('streakShieldAvailable streakShieldUsedMonth');
    const currentMonth = new Date().getUTCMonth();

    if (user?.streakShieldAvailable && user?.streakShieldUsedMonth !== currentMonth) {
      // Consume the shield: preserve streak, update lastActiveDate to today
      shieldUsed = true;
      await User.findByIdAndUpdate(userId, {
        streakShieldAvailable: false,
        streakShieldUsedMonth: currentMonth,
      });
      // Don't increment streak — it was a protected miss
    } else {
      // No shield available — reset streak
      streak.currentStreak = 1;
    }
  }

  streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
  streak.lastActiveDate = today;
  await streak.save();

  return { streak, shieldUsed };
};

/**
 * Reset streaks for users who missed yesterday (called by daily cron).
 * The shield is applied here before resetting, matching the same logic as updateStreak.
 * This handles the case where a user never triggers updateStreak on the missed day.
 */
export const resetInactiveStreaks = async () => {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yDate = yesterday.toISOString().split('T')[0];

  // Find streaks that haven't been active since before yesterday (gap ≥ 2 days)
  const staleStreaks = await Streak.find({
    lastActiveDate: { $lt: yDate },
    currentStreak: { $gt: 0 },
  }).select('user currentStreak lastActiveDate').lean();

  const currentMonth = new Date().getUTCMonth();

  for (const s of staleStreaks) {
    const last = new Date(s.lastActiveDate + 'T00:00:00Z');
    const now  = new Date();
    const diffDays = Math.round((now - last) / (1000 * 60 * 60 * 24));

    // Single missed day — try the shield
    if (diffDays === 1) {
      const user = await User.findById(s.user).select('streakShieldAvailable streakShieldUsedMonth');
      if (user?.streakShieldAvailable && user?.streakShieldUsedMonth !== currentMonth) {
        await User.findByIdAndUpdate(s.user, {
          streakShieldAvailable: false,
          streakShieldUsedMonth: currentMonth,
        });
        continue; // Shield absorbed the miss — don't reset
      }
    }

    await Streak.updateOne({ _id: s._id }, { $set: { currentStreak: 0 } });
  }
};
