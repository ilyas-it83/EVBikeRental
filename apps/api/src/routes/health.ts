import { Router } from 'express';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

export const healthRouter = Router();

const startTime = Date.now();

healthRouter.get('/', (_req, res) => {
  let dbStatus = 'ok';
  try {
    db.run(sql`SELECT 1`);
  } catch {
    dbStatus = 'error';
  }

  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  res.json({
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: uptimeSeconds,
    db: dbStatus,
  });
});
