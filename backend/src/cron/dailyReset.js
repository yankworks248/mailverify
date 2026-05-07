import cron from 'node-cron';
import { resetAllCounters } from '../services/ipPool.js';

export function startDailyResetCron() {
  cron.schedule('0 0 * * *', async () => {
    try {
      const n = await resetAllCounters();
      console.log(`[cron] daily reset — ${n} IP rows reset`);
    } catch (err) {
      console.error('[cron] daily reset failed:', err.message);
    }
  }, { timezone: 'UTC' });

  console.log('[cron] daily reset scheduled at 00:00 UTC');
}
