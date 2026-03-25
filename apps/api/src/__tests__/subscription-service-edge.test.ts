/**
 * Subscription Service Edge-Case Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema.js';

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'rider',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    plan TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'active',
    start_date TEXT NOT NULL,
    end_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

const _dbRef: { current: ReturnType<typeof drizzle> | null } = { current: null };

vi.mock('../db/index.js', () => ({
  get db() { return _dbRef.current; },
}));

let sqlite: InstanceType<typeof Database>;

beforeEach(() => {
  sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.exec(SCHEMA_SQL);
  _dbRef.current = drizzle(sqlite, { schema });
});

afterEach(() => {
  sqlite.close();
  _dbRef.current = null;
});

import * as subscriptionService from '../services/subscription.service.js';

function seedUser(id: string) {
  sqlite.prepare(
    'INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)',
  ).run(id, `${id}@test.com`, 'User', '$2a$12$hash', 'rider');
}

describe('Subscription Service: subscribe', () => {
  it('creates a new subscription', async () => {
    
    seedUser('u1');

    const sub = subscriptionService.subscribe('u1', 'monthly');
    expect(sub.userId).toBe('u1');
    expect(sub.plan).toBe('monthly');
    expect(sub.status).toBe('active');
  });

  it('replaces existing active subscription', async () => {
    
    seedUser('u1');

    const first = subscriptionService.subscribe('u1', 'monthly');
    expect(first.plan).toBe('monthly');
    expect(first.status).toBe('active');

    const second = subscriptionService.subscribe('u1', 'annual');
    expect(second.plan).toBe('annual');
    expect(second.status).toBe('active');

    // First should be cancelled
    const firstRow = sqlite.prepare('SELECT status FROM subscriptions WHERE id = ?').get(first.id) as any;
    expect(firstRow.status).toBe('cancelled');
  });

  it('free plan creates active subscription with free plan', async () => {
    
    seedUser('u1');

    const sub = subscriptionService.subscribe('u1', 'free');
    expect(sub.plan).toBe('free');
    expect(sub.status).toBe('active');
  });
});

describe('Subscription Service: getSubscriptionDiscount', () => {
  it('no subscription → 1.0 (no discount)', async () => {
    
    seedUser('u1');

    expect(subscriptionService.getSubscriptionDiscount('u1')).toBe(1.0);
  });

  it('free plan → 1.0 (0% discount)', async () => {
    
    seedUser('u1');
    subscriptionService.subscribe('u1', 'free');

    expect(subscriptionService.getSubscriptionDiscount('u1')).toBe(1.0);
  });

  it('monthly plan → 0.8 (20% discount)', async () => {
    
    seedUser('u1');
    subscriptionService.subscribe('u1', 'monthly');

    expect(subscriptionService.getSubscriptionDiscount('u1')).toBe(0.8);
  });

  it('annual plan → 0.7 (30% discount)', async () => {
    
    seedUser('u1');
    subscriptionService.subscribe('u1', 'annual');

    expect(subscriptionService.getSubscriptionDiscount('u1')).toBe(0.7);
  });
});

describe('Subscription Service: cancelSubscription', () => {
  it('cancels active subscription', async () => {
    
    seedUser('u1');
    subscriptionService.subscribe('u1', 'monthly');

    const cancelled = subscriptionService.cancelSubscription('u1');
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.endDate).toBeTruthy();
  });

  it('throws 404 when no active subscription (already cancelled)', async () => {
    
    seedUser('u1');
    subscriptionService.subscribe('u1', 'monthly');
    subscriptionService.cancelSubscription('u1');

    try {
      subscriptionService.cancelSubscription('u1');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(404);
      expect(err.error).toContain('No active subscription');
    }
  });

  it('throws 404 when user has no subscription at all', async () => {
    
    seedUser('u1');

    try {
      subscriptionService.cancelSubscription('u1');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(404);
    }
  });
});

describe('Subscription Service: getCurrentSubscription', () => {
  it('returns null when no subscription', async () => {
    
    seedUser('u1');

    expect(subscriptionService.getCurrentSubscription('u1')).toBeNull();
  });

  it('returns active subscription', async () => {
    
    seedUser('u1');
    subscriptionService.subscribe('u1', 'annual');

    const current = subscriptionService.getCurrentSubscription('u1');
    expect(current).not.toBeNull();
    expect(current!.plan).toBe('annual');
    expect(current!.status).toBe('active');
  });
});

describe('Subscription Service: getPlans', () => {
  it('returns all plan configurations', async () => {
    
    const plans = subscriptionService.getPlans();

    expect(plans).toHaveLength(3);
    const names = plans.map((p) => p.plan);
    expect(names).toContain('free');
    expect(names).toContain('monthly');
    expect(names).toContain('annual');

    const free = plans.find((p) => p.plan === 'free')!;
    expect(free.price).toBe(0);
    expect(free.discountPercent).toBe(0);

    const monthly = plans.find((p) => p.plan === 'monthly')!;
    expect(monthly.price).toBe(9.99);
    expect(monthly.discountPercent).toBe(20);

    const annual = plans.find((p) => p.plan === 'annual')!;
    expect(annual.price).toBe(89.99);
    expect(annual.discountPercent).toBe(30);
  });
});
