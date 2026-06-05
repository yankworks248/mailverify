import pg from 'pg';
const { Pool } = pg;

export const pool = new Pool({
  host:     process.env.PGHOST     || '127.0.0.1',
  port:     parseInt(process.env.PGPORT || '5433', 10),
  user:     process.env.PGUSER     || 'verifier',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'verifier',
  max: 70,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('[pg pool] idle client error:', err.message);
});

export async function ping() {
  const { rows } = await pool.query('SELECT NOW() AS now');
  return rows[0].now;
}
