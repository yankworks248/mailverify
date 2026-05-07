import { pool } from '../db/index.js';

export async function pickAvailableIp() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      SELECT id, ip, hostname, socks5_port
      FROM ip_pool
      WHERE status = 'active' AND used_today < daily_cap
      ORDER BY used_today ASC, id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }
    await client.query(
      'UPDATE ip_pool SET used_today = used_today + 1 WHERE id = $1',
      [rows[0].id]
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function rollbackIpUsage(ipId) {
  await pool.query(
    'UPDATE ip_pool SET used_today = GREATEST(used_today - 1, 0) WHERE id = $1',
    [ipId]
  );
}

export async function getIpPoolSnapshot() {
  const { rows } = await pool.query(`
    SELECT id, host(ip)::text AS ip, hostname, socks5_port,
           used_today, daily_cap, status, last_reset_at
    FROM ip_pool
    ORDER BY ip
  `);
  return rows;
}

export async function resetAllCounters() {
  const { rowCount } = await pool.query(
    `UPDATE ip_pool SET used_today = 0, last_reset_at = NOW()`
  );
  return rowCount;
}
