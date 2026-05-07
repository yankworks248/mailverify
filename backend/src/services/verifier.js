import { pool } from '../db/index.js';
import { preFilter } from './preFilter.js';
import { pickAvailableIp, rollbackIpUsage } from './ipPool.js';
import { probeEmail, classifyVerdict } from './reacher.js';

export async function verifySingle(emailRaw, opts = {}) {
  const { bulkJobId = null, verificationId = null } = opts;
  const start = Date.now();
  const email = String(emailRaw || '').trim().toLowerCase();

  const pre = await preFilter(email);
  if (pre.skip) {
    const durationMs = Date.now() - start;
    const saved = await persist({
      verificationId, email, bulkJobId,
      verdict: pre.verdict, reason: pre.reason,
      ip: null, raw: null, durationMs,
    });
    return { id: saved.id, email, verdict: pre.verdict, reason: pre.reason,
             ipUsed: null, durationMs, stage: 'prefilter' };
  }

  const ip = await pickAvailableIp();
  if (!ip) {
    const durationMs = Date.now() - start;
    if (verificationId) {
      await pool.query(`UPDATE verifications SET status='pending' WHERE id=$1`, [verificationId]);
    }
    return { id: verificationId, email, verdict: 'unknown', reason: 'capacity_exhausted',
             ipUsed: null, durationMs, stage: 'ip_pick', error: 'no_ip_available' };
  }

  let raw, classified;
  try {
    raw = await probeEmail(email, ip);
    classified = classifyVerdict(raw, pre.isRole);
  } catch (err) {
    await rollbackIpUsage(ip.id);
    const durationMs = Date.now() - start;
    const saved = await persist({
      verificationId, email, bulkJobId,
      verdict: 'unknown', reason: `probe_error:${err.message}`.slice(0, 500),
      ip: ip.ip, raw: null, durationMs,
    });
    return { id: saved.id, email, verdict: 'unknown', reason: saved.reason,
             ipUsed: ip.ip, durationMs, stage: 'probe', error: err.message };
  }

  const durationMs = Date.now() - start;
  const saved = await persist({
    verificationId, email, bulkJobId,
    verdict: classified.verdict, reason: classified.reason,
    ip: ip.ip, raw, durationMs,
  });

  return { id: saved.id, email, verdict: classified.verdict, reason: classified.reason,
           ipUsed: ip.ip, durationMs, stage: 'complete' };
}

async function persist({ verificationId, email, bulkJobId, verdict, reason, ip, raw, durationMs }) {
  if (verificationId) {
    const { rows } = await pool.query(
      `UPDATE verifications
         SET verdict=$1, reason=$2, ip_used=$3, raw_result=$4, duration_ms=$5,
             status='done', verified_at=NOW()
       WHERE id=$6
       RETURNING id`,
      [verdict, reason, ip, raw ? JSON.stringify(raw) : null, durationMs, verificationId]
    );
    return { id: rows[0]?.id ?? verificationId, reason };
  }
  const { rows } = await pool.query(
    `INSERT INTO verifications
       (email, bulk_job_id, verdict, reason, ip_used, raw_result, duration_ms, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'done')
     RETURNING id`,
    [email, bulkJobId, verdict, reason, ip, raw ? JSON.stringify(raw) : null, durationMs]
  );
  return { id: rows[0].id, reason };
}
