import { pool } from '../db/index.js';
import { verifySingle } from './verifier.js';

const POLL_MS     = parseInt(process.env.WORKER_POLL_MS || '2000', 10);
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '4', 10);

// Idle backoff: when there's nothing to do, workers wait progressively longer
// (starting at IDLE_MIN_MS, growing to IDLE_MAX_MS) instead of hammering the
// claim query. They snap back to fast polling the instant work appears.
const IDLE_MIN_MS = parseInt(process.env.WORKER_IDLE_MIN_MS || String(POLL_MS), 10);
const IDLE_MAX_MS = parseInt(process.env.WORKER_IDLE_MAX_MS || '20000', 10);
// One shared "is there any pending work?" check, memoized for this long, so an
// empty queue costs ~1 cheap EXISTS per cycle instead of CONCURRENCY claim queries.
const GATE_TTL_MS = parseInt(process.env.WORKER_GATE_TTL_MS || '1000', 10);

let running = false;
let stopRequested = false;
let stoppedResolver = null;
let stoppedPromise = Promise.resolve();

/* ----------------------------- pending gate ----------------------------- */
// Shared, memoized EXISTS check. Concurrent idle workers reuse one in-flight
// query (and its cached result for GATE_TTL_MS) rather than each firing their
// own claim against the (potentially huge) verifications table.
let gatePromise = null;
let gateExpiresAt = 0;

function pendingGate() {
  const now = Date.now();
  if (gatePromise && now < gateExpiresAt) return gatePromise;
  gateExpiresAt = now + GATE_TTL_MS;
  gatePromise = pool
    .query(
      `SELECT EXISTS(
         SELECT 1 FROM verifications
          WHERE status = 'pending'
            AND (next_retry_at IS NULL OR next_retry_at <= NOW())
       ) AS has_pending`
    )
    .then((r) => r.rows[0].has_pending)
    .catch(() => true); // on error, assume work exists so we never stall the queue
  return gatePromise;
}

/* ------------------------------- wake-up -------------------------------- */
// Interruptible idle sleep so a freshly enqueued job wakes idle workers
// immediately instead of waiting out their (up to IDLE_MAX_MS) backoff.
let wakeResolvers = [];

function idleSleep(ms) {
  return new Promise((resolve) => {
    const wake = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(() => {
      const i = wakeResolvers.indexOf(wake);
      if (i >= 0) wakeResolvers.splice(i, 1);
      resolve();
    }, ms);
    wakeResolvers.push(wake);
  });
}

// Called when new work is enqueued (see api/verify.js). Marks the gate as
// "has pending" without a round-trip and wakes every sleeping worker.
export function notifyWork() {
  gatePromise = Promise.resolve(true);
  gateExpiresAt = Date.now() + GATE_TTL_MS;
  const resolvers = wakeResolvers;
  wakeResolvers = [];
  for (const r of resolvers) r();
}

/* ------------------------------- claiming ------------------------------- */
async function claimBatch(limit) {
  const { rows } = await pool.query(
    `WITH next AS (
       SELECT id FROM verifications
       WHERE status = 'pending'
         AND (next_retry_at IS NULL OR next_retry_at <= NOW())
       ORDER BY id
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE verifications v
        SET status = 'processing',
            claimed_at = NOW()
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

async function workerLoop(workerId) {
  let idleDelay = IDLE_MIN_MS;
  while (!stopRequested) {
    // Cheap shared gate first — avoids CONCURRENCY claim queries when idle.
    let hasPending;
    try {
      hasPending = await pendingGate();
    } catch (_) {
      hasPending = true; // never stall on a transient gate error
    }
    if (!hasPending) {
      await idleSleep(idleDelay);
      idleDelay = Math.min(Math.floor(idleDelay * 1.5), IDLE_MAX_MS);
      continue;
    }

    let batch;
    try {
      batch = await claimBatch(1);
    } catch (err) {
      console.error(`[worker ${workerId}] claim error:`, err.message);
      await idleSleep(idleDelay);
      idleDelay = Math.min(Math.floor(idleDelay * 1.5), IDLE_MAX_MS);
      continue;
    }
    if (batch.length === 0) {
      // Lost the race for the last rows (or gate was momentarily stale): back off.
      await idleSleep(idleDelay);
      idleDelay = Math.min(Math.floor(idleDelay * 1.5), IDLE_MAX_MS);
      continue;
    }

    // Got work — snap back to fast polling for the rest of the job.
    idleDelay = IDLE_MIN_MS;
    try {
      await processOne(batch[0]);
    } catch (err) {
      console.error(`[worker ${workerId}] process error:`, err.message);
    }
  }
}

export function startWorker() {
  if (running) return;
  running = true;
  stopRequested = false;
  stoppedPromise = new Promise((resolve) => { stoppedResolver = resolve; });
  console.log(
    `[worker] started — ${CONCURRENCY} persistent workers, ` +
    `poll=${POLL_MS}ms, idle backoff ${IDLE_MIN_MS}-${IDLE_MAX_MS}ms`
  );
  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(workerLoop(i));
  }
  Promise.all(workers).then(() => {
    running = false;
    console.log('[worker] stopped');
    if (stoppedResolver) stoppedResolver();
  });
}


export function stopWorker() {
  stopRequested = true;
  // Wake any sleeping workers so they observe stopRequested and exit promptly.
  const resolvers = wakeResolvers;
  wakeResolvers = [];
  for (const r of resolvers) r();
  return stoppedPromise;
}
