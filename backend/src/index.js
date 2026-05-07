import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { ping, pool } from './db/index.js';
import { isMockMode } from './services/reacher.js';
import { startWorker, stopWorker } from './services/bulkProcessor.js';
import { startDailyResetCron } from './cron/dailyReset.js';

import verifyRouter from './api/verify.js';
import jobsRouter   from './api/jobs.js';
import healthRouter from './api/health.js';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '1mb' }));

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use('/api/verify', verifyRouter);
app.use('/api/jobs',   jobsRouter);
app.use('/api/health', healthRouter);

app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '127.0.0.1';

let server;

(async () => {
  try {
    const t = await ping();
    console.log(`[startup] DB connected — ${t}`);
  } catch (err) {
    console.error('[startup] DB connection failed:', err.message);
    console.error('  → Is Postgres running? Try:  docker compose -f docker-compose.dev.yml up -d');
    process.exit(1);
  }

  startWorker();
  startDailyResetCron();

  server = app.listen(PORT, HOST, () => {
    console.log(`[startup] mailverify listening on http://${HOST}:${PORT}`);
    if (isMockMode()) {
      console.log('[startup] MOCK_REACHER=true — using simulated probes');
    }
  });
})();

async function shutdown(signal) {
  console.log(`[shutdown] ${signal} received`);
  stopWorker();
  if (server) server.close();
  try { await pool.end(); } catch (_) {}
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
