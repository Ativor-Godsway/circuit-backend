import cron from 'node-cron';
import { resetInactiveStreaks } from './streakUpdater.js';

export const startCronJobs = () => {
  // Run every day at midnight UTC — reset streaks for inactive members
  cron.schedule('0 0 * * *', async () => {
    console.log('[cron] Running daily streak reset...');
    try {
      await resetInactiveStreaks();
      console.log('[cron] Streak reset complete');
    } catch (err) {
      console.error('[cron] Streak reset error:', err.message);
    }
  });
};
