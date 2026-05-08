import cron from 'node-cron';
import User from '../models/User.js';
import Community from '../models/Community.js';
import { resetInactiveStreaks } from './streakUpdater.js';

export const startCronJobs = () => {
  // ── Daily at midnight UTC ─────────────────────────────────────────────────

  // 1. Reset streaks for inactive members (with shield logic)
  cron.schedule('0 0 * * *', async () => {
    console.log('[cron] Running daily streak reset...');
    try {
      await resetInactiveStreaks();
      console.log('[cron] Streak reset complete');
    } catch (err) {
      console.error('[cron] Streak reset error:', err.message);
    }
  });

  // 2. Inactivity decay — runs at 01:00 UTC daily
  // Users inactive for 14+ days lose 1 pt every 7 additional days.
  // Floors: profile-complete users never go below max(10, opportunitiesScore).
  // opportunitiesScore is never decayed (permanent track record).
  cron.schedule('0 1 * * *', async () => {
    console.log('[cron] Running inactivity decay...');
    try {
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

      const inactiveUsers = await User.find({
        lastActivityDate: { $lt: fourteenDaysAgo },
        circuitScore: { $gt: 0 },
      }).select('_id circuitScore opportunitiesScore avatar bio lastActivityDate').lean();

      let decayed = 0;

      for (const u of inactiveUsers) {
        const daysSince = Math.floor((Date.now() - new Date(u.lastActivityDate)) / 86400000);
        // Only decay on day 14, 21, 28, … (every 7 days after the initial 14-day buffer)
        if ((daysSince - 14) % 7 !== 0) continue;

        const communitiesCount = await Community.countDocuments({ members: u._id });
        const profileComplete = !!(u.avatar && u.bio?.trim() && communitiesCount > 0);
        const permanentFloor = Math.max(profileComplete ? 10 : 0, u.opportunitiesScore || 0);

        if (u.circuitScore <= permanentFloor) continue;

        await User.findByIdAndUpdate(u._id, {
          circuitScore: Math.max(permanentFloor, u.circuitScore - 1),
        });
        decayed++;
      }

      console.log(`[cron] Inactivity decay applied to ${decayed} users`);
    } catch (err) {
      console.error('[cron] Inactivity decay error:', err.message);
    }
  });

  // ── Monthly on the 1st at 00:30 UTC — restore streak shields ─────────────
  cron.schedule('30 0 1 * *', async () => {
    console.log('[cron] Resetting monthly streak shields...');
    try {
      const result = await User.updateMany({}, { streakShieldAvailable: true });
      console.log(`[cron] Streak shields reset for ${result.modifiedCount} users`);
    } catch (err) {
      console.error('[cron] Shield reset error:', err.message);
    }
  });
};
