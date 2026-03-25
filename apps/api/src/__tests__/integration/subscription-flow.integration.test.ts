import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

const state = vi.hoisted(() => ({ sqlite: null as any }));

vi.mock('../../db/index.js', async () => {
  const Database = (await import('better-sqlite3')).default;
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const schema = await import('../../db/schema.js');
  const { TABLE_SQL } = await import('./helpers.js');

  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(TABLE_SQL);

  state.sqlite = sqlite;
  return { db: drizzle(sqlite, { schema }) };
});

const { default: app } = (await import('../../app.js')) as { default: Express };
const { clearTables, seedUser, seedSubscription, getAuthCookies } =
  await import('./helpers.js');

// Direct service import for discount function coverage
const subscriptionService = await import('../../services/subscription.service.js');

describe('Subscription Flow Integration', () => {
  let userCookies: string;
  let userId: string;

  beforeEach(() => {
    clearTables(state.sqlite);
    const user = seedUser(state.sqlite, { email: 'sub@test.com' });
    userId = user.id;
    userCookies = getAuthCookies(userId);
  });

  afterAll(() => state.sqlite.close());

  // ── Subscribe ───────────────────────────────────────

  it('subscribe to monthly plan → 201', async () => {
    const res = await request(app)
      .post('/api/subscriptions/subscribe')
      .set('Cookie', userCookies)
      .send({ plan: 'monthly' });

    expect(res.status).toBe(201);
    expect(res.body.subscription.plan).toBe('monthly');
    expect(res.body.subscription.status).toBe('active');
    expect(res.body.subscription.userId).toBe(userId);
  });

  it('subscribe to annual plan → 201', async () => {
    const res = await request(app)
      .post('/api/subscriptions/subscribe')
      .set('Cookie', userCookies)
      .send({ plan: 'annual' });

    expect(res.status).toBe(201);
    expect(res.body.subscription.plan).toBe('annual');
  });

  it('subscribe to free plan → 201', async () => {
    const res = await request(app)
      .post('/api/subscriptions/subscribe')
      .set('Cookie', userCookies)
      .send({ plan: 'free' });

    expect(res.status).toBe(201);
    expect(res.body.subscription.plan).toBe('free');
  });

  it('subscribe replaces existing active subscription', async () => {
    // First subscribe to monthly
    await request(app)
      .post('/api/subscriptions/subscribe')
      .set('Cookie', userCookies)
      .send({ plan: 'monthly' });

    // Upgrade to annual
    const res = await request(app)
      .post('/api/subscriptions/subscribe')
      .set('Cookie', userCookies)
      .send({ plan: 'annual' });

    expect(res.status).toBe(201);
    expect(res.body.subscription.plan).toBe('annual');

    // Old subscription should be cancelled
    const rows = state.sqlite
      .prepare('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at')
      .all(userId) as any[];
    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe('cancelled');
    expect(rows[1].status).toBe('active');
  });

  it('subscribe invalid plan → 400', async () => {
    const res = await request(app)
      .post('/api/subscriptions/subscribe')
      .set('Cookie', userCookies)
      .send({ plan: 'premium' });

    expect(res.status).toBe(400);
  });

  // ── Get Current ─────────────────────────────────────

  it('get current subscription', async () => {
    seedSubscription(state.sqlite, userId, 'monthly');

    const res = await request(app)
      .get('/api/subscriptions/current')
      .set('Cookie', userCookies);

    expect(res.status).toBe(200);
    expect(res.body.subscription.plan).toBe('monthly');
  });

  it('get current subscription when none → null', async () => {
    const res = await request(app)
      .get('/api/subscriptions/current')
      .set('Cookie', userCookies);

    expect(res.status).toBe(200);
    expect(res.body.subscription).toBeNull();
  });

  // ── Cancel ──────────────────────────────────────────

  it('cancel active subscription', async () => {
    seedSubscription(state.sqlite, userId, 'monthly');

    const res = await request(app)
      .delete('/api/subscriptions/cancel')
      .set('Cookie', userCookies);

    expect(res.status).toBe(200);
    expect(res.body.subscription.status).toBe('cancelled');
    expect(res.body.message).toBe('Subscription cancelled');
  });

  it('cancel when no active subscription → 404', async () => {
    const res = await request(app)
      .delete('/api/subscriptions/cancel')
      .set('Cookie', userCookies);

    expect(res.status).toBe(404);
  });

  // ── Plans ───────────────────────────────────────────

  it('get plans returns all plan info', async () => {
    const res = await request(app)
      .get('/api/subscriptions/plans')
      .set('Cookie', userCookies);

    expect(res.status).toBe(200);
    expect(res.body.plans).toHaveLength(3);
    const names = res.body.plans.map((p: any) => p.plan);
    expect(names).toContain('free');
    expect(names).toContain('monthly');
    expect(names).toContain('annual');

    const monthly = res.body.plans.find((p: any) => p.plan === 'monthly');
    expect(monthly.price).toBe(9.99);
    expect(monthly.discountPercent).toBe(20);
  });

  // ── Discount (direct service call) ──────────────────

  it('getSubscriptionDiscount returns 1.0 with no subscription', () => {
    const discount = subscriptionService.getSubscriptionDiscount(userId);
    expect(discount).toBe(1.0);
  });

  it('getSubscriptionDiscount returns 0.8 for monthly', () => {
    seedSubscription(state.sqlite, userId, 'monthly');
    const discount = subscriptionService.getSubscriptionDiscount(userId);
    expect(discount).toBe(0.8);
  });

  it('getSubscriptionDiscount returns 0.7 for annual', () => {
    seedSubscription(state.sqlite, userId, 'annual');
    const discount = subscriptionService.getSubscriptionDiscount(userId);
    expect(discount).toBe(0.7);
  });

  it('getSubscriptionDiscount returns 1.0 for free', () => {
    seedSubscription(state.sqlite, userId, 'free');
    const discount = subscriptionService.getSubscriptionDiscount(userId);
    expect(discount).toBe(1.0);
  });

  // ── Auth guard ──────────────────────────────────────

  it('unauthenticated → 401', async () => {
    const res = await request(app).get('/api/subscriptions/current');
    expect(res.status).toBe(401);
  });
});
