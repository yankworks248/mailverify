import cron from 'node-cron';
import { pool } from '../db/index.js';

const STALE_AFTER_MINUTES = 5;

export function startStaleClaimCron() {
  cron.schedule('* * * * *', async () => {
    try {
      const { rowCount } = await pool.query(
        `UPDATE verifications
            SET status = 'pending', claimed_at = NULL
          WHERE status = 'processing'
            AND claimed_at < NOW() - INTERVAL '${STALE_AFTER_MINUTES} minutes'`
      );
      if (rowCount > 0) {
        console.log(`[cron] stale-claim reset — ${rowCount} rows back to pending`);
      }
    } catch (err) {
      console.error('[cron] stale-claim reset failed:', err.message);
    }
  });

  console.log(`[cron] stale-claim reset scheduled — every minute, threshold ${STALE_AFTER_MINUTES}m`);
}
