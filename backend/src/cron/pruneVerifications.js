import cron from 'node-cron';
import { pool } from '../db/index.js';

// Keep the verifications table from bloating to millions of rows: delete old
// completed rows on a schedule. Runs daily, chunked so it never long-locks the
// table, and ONLY when no verification batch is in flight. Set
// VERIFICATION_RETENTION_DAYS<=0 to disable.
const RETENTION_DAYS = parseInt(process.env.VERIFICATION_RETENTION_DAYS || '7', 10);
const BATCH_SIZE     = parseInt(process.env.PRUNE_BATCH_SIZE || '10000', 10);
const BATCH_PAUSE_MS = parseInt(process.env.PRUNE_BATCH_PAUSE_MS || '200', 10);

// Is a verification batch currently active? A bulk job sits in 'pending' (just
// uploaded, not yet picked up) or 'processing' (workers running) while in
// flight. If either exists, the prune defers — it must never run concurrently
// with an active run.
async function hasActiveJob() {
  const { rows } = await pool.query(
    `SELECT EXISTS(
       SELECT 1 FROM bulk_jobs
        WHERE status IN ('pending', 'processing')
     ) AS active`
  );
  return rows[0].active;
}

async function pruneOldVerifications() {
  if (RETENTION_DAYS <= 0) {
    console.log('[cron] prune skipped — retention disabled (VERIFICATION_RETENTION_DAYS<=0)');
    return;
  }

  // Guard 1: don't even start if a batch is running.
  if (await hasActiveJob()) {
    console.log('[cron] prune deferred — a verification batch is active; will retry next cycle');
    return;
  }

  let totalDeleted = 0;
  for (;;) {
    // Guard 2: re-check before every batch so a job that STARTS mid-prune
    // aborts the cleanup immediately rather than running alongside it.
    if (await hasActiveJob()) {
      console.log(
        `[cron] prune aborted mid-run — batch became active (deleted ${totalDeleted} so far); resumes next cycle`
      );
      return;
    }

    const { rowCount } = await pool.query(
      `DELETE FROM verifications
        WHERE id IN (
          SELECT id FROM verifications
           WHERE status = 'done'
             AND verified_at < NOW() - make_interval(days => $1)
           LIMIT $2
        )`,
      [RETENTION_DAYS, BATCH_SIZE]
    );
    totalDeleted += rowCount;
    if (rowCount < BATCH_SIZE) break; // last (partial) batch processed
    await sleep(BATCH_PAUSE_MS);
  }

  console.log(`[cron] prune — deleted ${totalDeleted} done rows older than ${RETENTION_DAYS}d`);
}

export function startPruneCron() {
  // 00:30 IST — just after the 00:00 daily reset, so the two don't overlap.
  cron.schedule('30 0 * * *', () => {
    pruneOldVerifications().catch((err) =>
      console.error('[cron] prune failed:', err.message)
    );
  }, { timezone: 'Asia/Kolkata' });

  console.log(`[cron] prune scheduled at 00:30 IST — retention ${RETENTION_DAYS}d, batch ${BATCH_SIZE}`);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
