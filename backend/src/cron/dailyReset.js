import cron from 'node-cron';
import { resetAllCounters } from '../services/ipPool.js';
import { pool } from '../db/index.js';

export function startDailyResetCron() {
  cron.schedule('0 0 * * *', async () => {
    try {
      const n = await resetAllCounters();
      const { rowCount: cleared } = await pool.query(
        `UPDATE verifications SET next_retry_at = NULL WHERE next_retry_at > NOW()`
      );
      console.log(`[cron] daily reset — ${n} IP rows reset, ${cleared} backoff stamps cleared`);
    } catch (err) {
      console.error('[cron] daily reset failed:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  console.log('[cron] daily reset scheduled at 00:00 IST');
}
