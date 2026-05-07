import { pool } from '../db/index.js';
import { verifySingle } from './verifier.js';

const POLL_MS     = parseInt(process.env.WORKER_POLL_MS || '2000', 10);
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '4', 10);

let running = false;
let stopRequested = false;

async function claimBatch(limit) {
  const { rows } = await pool.query(
    `WITH next AS (
       SELECT id FROM verifications
       WHERE status = 'pending'
       ORDER BY id
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE verifications v
        SET status = 'processing'
       FROM next
      WHERE v.id = next.id
     RETURNING v.id, v.email, v.bulk_job_id`,
    [limit]
  );
  return rows;
}

async function markJobStarted(jobId) {
  await pool.query(
    `UPDATE bulk_jobs
        SET status = 'processing', started_at = COALESCE(started_at, NOW())
      WHERE id = $1 AND status = 'pending'`,
    [jobId]
  );
}

async function refreshJobCounts(jobId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'done')                                AS processed,
       COUNT(*) FILTER (WHERE verdict = 'valid')                              AS valid,
       COUNT(*) FILTER (WHERE verdict = 'invalid')                            AS invalid,
       COUNT(*) FILTER (WHERE verdict = 'risky')                              AS risky,
       COUNT(*) FILTER (WHERE verdict = 'unknown')                            AS unknown,
       COUNT(*)                                                               AS total
     FROM verifications
     WHERE bulk_job_id = $1`,
    [jobId]
  );
  const c = rows[0];
  const allDone = Number(c.processed) === Number(c.total);

  await pool.query(
    `UPDATE bulk_jobs
        SET processed_count = $2, valid_count = $3, invalid_count = $4,
            risky_count = $5, unknown_count = $6,
            status = CASE WHEN $7 THEN 'completed' ELSE status END,
            completed_at = CASE WHEN $7 THEN NOW() ELSE completed_at END
      WHERE id = $1`,
    [jobId, c.processed, c.valid, c.invalid, c.risky, c.unknown, allDone]
  );
}

async function processOne(row) {
  if (row.bulk_job_id) await markJobStarted(row.bulk_job_id);

  try {
    await verifySingle(row.email, {
      bulkJobId: row.bulk_job_id,
      verificationId: row.id,
    });
  } catch (err) {
    console.error(`[worker] verify failed id=${row.id}:`, err.message);
    await pool.query(
      `UPDATE verifications SET status='failed', reason=$2 WHERE id=$1`,
      [row.id, `worker_error:${err.message}`.slice(0, 500)]
    );
  }

  if (row.bulk_job_id) {
    try { await refreshJobCounts(row.bulk_job_id); } catch (_) {}
  }
}

async function tick() {
  const batch = await claimBatch(CONCURRENCY);
  if (batch.length === 0) return 0;
  await Promise.all(batch.map(processOne));
  return batch.length;
}

export function startWorker() {
  if (running) return;
  running = true;
  stopRequested = false;
  console.log(`[worker] started — concurrency=${CONCURRENCY}, poll=${POLL_MS}ms`);

  (async function loop() {
    while (!stopRequested) {
      try {
        const n = await tick();
        if (n === 0) await sleep(POLL_MS);
      } catch (err) {
        console.error('[worker] tick error:', err.message);
        await sleep(POLL_MS);
      }
    }
    running = false;
    console.log('[worker] stopped');
  })();
}

export function stopWorker() {
  stopRequested = true;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
