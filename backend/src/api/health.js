import { Router } from 'express';
import { ping } from '../db/index.js';
import { getIpPoolSnapshot } from '../services/ipPool.js';
import { isMockMode } from '../services/reacher.js';

const router = Router();

router.get('/', async (_req, res) => {
  const out = { status: 'ok', time: new Date().toISOString(), mockMode: isMockMode() };

  try { out.dbTime = await ping(); }
  catch (err) {
    console.error('[health] db ping failed:', err);
    out.status = 'degraded';
  }

  try {
    const ips = await getIpPoolSnapshot();
    out.capacity = {
      totalRemaining: ips.reduce((s, r) => s + Math.max(0, r.daily_cap - r.used_today), 0),
      totalCap: ips.reduce((s, r) => s + r.daily_cap, 0),
      activeIps: ips.filter((r) => r.status === 'active').length,
      exhaustedIps: ips.filter((r) => r.status === 'active' && r.used_today >= r.daily_cap).length,
    };
  } catch (err) {
    console.error('[health] ip pool snapshot failed:', err);
  }

  res.json(out);
});

export default router;
