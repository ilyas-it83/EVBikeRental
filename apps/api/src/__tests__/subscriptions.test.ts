/**
 * Subscription API Tests
 *
 * Tests subscription endpoints:
 * - GET /api/subscriptions/plans — list available plans
 * - POST /api/subscriptions — subscribe to a plan
 * - DELETE /api/subscriptions — cancel subscription
 * - GET /api/subscriptions/current — get active subscription
 * - Discount calculations per plan
 *
 * References: Sprint 3, PRD §4.2
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import {
  createTestDb,
  seedTestData,
  createAuthenticatedUser,
  seedSubscription,
  TEST_JWT_SECRET,
  SEED_USERS,
} from '../test/setup.js';

let sqlite: Database.Database;
let app: express.Express;

// ─── Auth middleware ─────────────────────────────────

function testAuth(sqliteDb: Database.Database) {
  return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const token = req.cookies?.access_token;
    if (!token) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }
    try {
      const payload = jwt.verify(token, TEST_JWT_SECRET) as { sub: string; role: string };
      const user = sqliteDb.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(payload.sub) as any;
      if (!user) { res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not found' } }); return; }
      (req as any).user = user;
      next();
    } catch {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    }
  };
}

// ─── Plans data ─────────────────────────────────────

const PLANS = [
  { id: 'free', name: 'Free', price: 0, interval: null, discount: 0 },
  { id: 'monthly', name: 'Monthly', price: 14.99, interval: 'month', discount: 0.20 },
  { id: 'annual', name: 'Annual', price: 119.99, interval: 'year', discount: 0.30 },
];

// ─── Test Express app ───────────────────────────────

function createTestApp(sqliteDb: Database.Database): express.Express {
  const testApp = express();
  testApp.use(express.json());
  testApp.use(cookieParser());
  const auth = testAuth(sqliteDb);

  // GET /api/subscriptions/plans — public
  testApp.get('/api/subscriptions/plans', (_req, res) => {
    res.json({ success: true, data: { plans: PLANS } });
  });

  // GET /api/subscriptions/current — requires auth
  testApp.get('/api/subscriptions/current', auth, (req, res) => {
    const user = (req as any).user;
    const sub = sqliteDb.prepare(
      "SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
    ).get(user.id) as any;

    if (!sub) {
      res.json({ success: true, data: { subscription: null } });
      return;
    }

    const plan = PLANS.find((p) => p.id === sub.plan);
    res.json({ success: true, data: { subscription: { ...sub, discount: plan?.discount ?? 0 } } });
  });

  // POST /api/subscriptions — subscribe to a plan
  testApp.post('/api/subscriptions', auth, (req, res) => {
    const user = (req as any).user;
    const { plan } = req.body;

    if (!plan || !PLANS.find((p) => p.id === plan)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid plan' } });
      return;
    }

    // Cancel existing active subscription
    sqliteDb.prepare(
      "UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ? AND status = 'active'",
    ).run(user.id);

    const id = `sub-${Date.now()}`;
    const startDate = new Date().toISOString();
    const planData = PLANS.find((p) => p.id === plan)!;
    const endDate = planData.interval === 'year'
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : planData.interval === 'month'
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null;

    sqliteDb.prepare(
      'INSERT INTO subscriptions (id, user_id, plan, status, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(id, user.id, plan, 'active', startDate, endDate);

    const sub = sqliteDb.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: { subscription: { ...sub as any, discount: planData.discount } } });
  });

  // DELETE /api/subscriptions — cancel active subscription
  testApp.delete('/api/subscriptions', auth, (req, res) => {
    const user = (req as any).user;
    const sub = sqliteDb.prepare(
      "SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
    ).get(user.id) as any;

    if (!sub) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No active subscription' } });
      return;
    }

    sqliteDb.prepare("UPDATE subscriptions SET status = 'cancelled' WHERE id = ?").run(sub.id);
    res.json({ success: true, data: { cancelled: true } });
  });

  // GET /api/subscriptions/discount — get discount for current plan
  testApp.get('/api/subscriptions/discount', auth, (req, res) => {
    const user = (req as any).user;
    const sub = sqliteDb.prepare(
      "SELECT plan FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
    ).get(user.id) as any;

    const plan = sub ? PLANS.find((p) => p.id === sub.plan) : PLANS.find((p) => p.id === 'free');
    res.json({ success: true, data: { discount: plan?.discount ?? 0 } });
  });

  return testApp;
}

// ─── Tests ──────────────────────────────────────────

describe('GET /api/subscriptions/plans', () => {
  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
  });

  afterEach(() => { sqlite.close(); });

  it('should return 3 plans with correct pricing', async () => {
    const res = await request(app).get('/api/subscriptions/plans');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.plans).toHaveLength(3);

    const free = res.body.data.plans.find((p: any) => p.id === 'free');
    const monthly = res.body.data.plans.find((p: any) => p.id === 'monthly');
    const annual = res.body.data.plans.find((p: any) => p.id === 'annual');

    expect(free.price).toBe(0);
    expect(monthly.price).toBe(14.99);
    expect(annual.price).toBe(119.99);
  });
});

describe('POST /api/subscriptions — subscribe', () => {
  let cookieHeader: string;
  let userId: string;

  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
    const auth = await createAuthenticatedUser(sqlite);
    cookieHeader = auth.cookieHeader;
    userId = auth.user.id;
  });

  afterEach(() => { sqlite.close(); });

  it('should subscribe to monthly plan', async () => {
    const res = await request(app)
      .post('/api/subscriptions')
      .set('Cookie', cookieHeader)
      .send({ plan: 'monthly' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.subscription.plan).toBe('monthly');
    expect(res.body.data.subscription.status).toBe('active');
    expect(res.body.data.subscription.user_id).toBe(userId);
    expect(res.body.data.subscription.discount).toBe(0.20);
  });

  it('should subscribe to annual plan', async () => {
    const res = await request(app)
      .post('/api/subscriptions')
      .set('Cookie', cookieHeader)
      .send({ plan: 'annual' });

    expect(res.status).toBe(201);
    expect(res.body.data.subscription.plan).toBe('annual');
    expect(res.body.data.subscription.discount).toBe(0.30);
  });

  it('should replace existing active subscription', async () => {
    // Subscribe to monthly first
    await request(app)
      .post('/api/subscriptions')
      .set('Cookie', cookieHeader)
      .send({ plan: 'monthly' });

    // Upgrade to annual
    const res = await request(app)
      .post('/api/subscriptions')
      .set('Cookie', cookieHeader)
      .send({ plan: 'annual' });

    expect(res.status).toBe(201);
    expect(res.body.data.subscription.plan).toBe('annual');

    // Old subscription should be cancelled
    const subs = sqlite.prepare(
      "SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC",
    ).all(userId) as any[];
    const activeSubs = subs.filter((s) => s.status === 'active');
    expect(activeSubs).toHaveLength(1);
    expect(activeSubs[0].plan).toBe('annual');
  });

  it('should reject invalid plan', async () => {
    const res = await request(app)
      .post('/api/subscriptions')
      .set('Cookie', cookieHeader)
      .send({ plan: 'ultra-premium' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should require authentication (401)', async () => {
    const res = await request(app)
      .post('/api/subscriptions')
      .send({ plan: 'monthly' });

    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/subscriptions — cancel', () => {
  let cookieHeader: string;
  let userId: string;

  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
    const auth = await createAuthenticatedUser(sqlite);
    cookieHeader = auth.cookieHeader;
    userId = auth.user.id;
  });

  afterEach(() => { sqlite.close(); });

  it('should cancel active subscription', async () => {
    seedSubscription(sqlite, userId, 'monthly');

    const res = await request(app)
      .delete('/api/subscriptions')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.cancelled).toBe(true);

    const sub = sqlite.prepare(
      "SELECT status FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
    ).get(userId) as any;
    expect(sub.status).toBe('cancelled');
  });

  it('should return 404 when no active subscription', async () => {
    const res = await request(app)
      .delete('/api/subscriptions')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/subscriptions/current', () => {
  let cookieHeader: string;
  let userId: string;

  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
    const auth = await createAuthenticatedUser(sqlite);
    cookieHeader = auth.cookieHeader;
    userId = auth.user.id;
  });

  afterEach(() => { sqlite.close(); });

  it('should return active subscription', async () => {
    seedSubscription(sqlite, userId, 'monthly');

    const res = await request(app)
      .get('/api/subscriptions/current')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.subscription).not.toBeNull();
    expect(res.body.data.subscription.plan).toBe('monthly');
    expect(res.body.data.subscription.status).toBe('active');
    expect(res.body.data.subscription.discount).toBe(0.20);
  });

  it('should return null when no active subscription', async () => {
    const res = await request(app)
      .get('/api/subscriptions/current')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.subscription).toBeNull();
  });

  it('should require authentication (401)', async () => {
    const res = await request(app).get('/api/subscriptions/current');
    expect(res.status).toBe(401);
  });
});

describe('Subscription discounts', () => {
  let cookieHeader: string;
  let userId: string;

  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
    const auth = await createAuthenticatedUser(sqlite);
    cookieHeader = auth.cookieHeader;
    userId = auth.user.id;
  });

  afterEach(() => { sqlite.close(); });

  it('should return 0% discount for free plan (no subscription)', async () => {
    const res = await request(app)
      .get('/api/subscriptions/discount')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.discount).toBe(0);
  });

  it('should return 20% discount for monthly plan', async () => {
    seedSubscription(sqlite, userId, 'monthly');

    const res = await request(app)
      .get('/api/subscriptions/discount')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.discount).toBe(0.20);
  });

  it('should return 30% discount for annual plan', async () => {
    seedSubscription(sqlite, userId, 'annual');

    const res = await request(app)
      .get('/api/subscriptions/discount')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.discount).toBe(0.30);
  });
});
