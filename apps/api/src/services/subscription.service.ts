import { db } from '../db/index.js';
import { subscriptions } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

const PLAN_CONFIG = {
  free: { price: 0, interval: null as null, discountPercent: 0 },
  monthly: { price: 9.99, interval: 'month' as const, discountPercent: 20 },
  annual: { price: 89.99, interval: 'year' as const, discountPercent: 30 },
} as const;

export function subscribe(userId: string, plan: 'free' | 'monthly' | 'annual') {
  // Cancel any existing active subscription
  const existing = db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')))
    .get();

  if (existing) {
    db.update(subscriptions)
      .set({ status: 'cancelled', endDate: new Date().toISOString() })
      .where(eq(subscriptions.id, existing.id))
      .run();
  }

  const id = crypto.randomUUID();
  const now = new Date();
  const startDate = now.toISOString();

  db.insert(subscriptions)
    .values({ id, userId, plan, status: 'active', startDate })
    .run();

  return db.select().from(subscriptions).where(eq(subscriptions.id, id)).get()!;
}

export function cancelSubscription(userId: string) {
  const sub = db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')))
    .get();

  if (!sub) {
    throw { status: 404, error: 'No active subscription found' };
  }

  db.update(subscriptions)
    .set({ status: 'cancelled', endDate: new Date().toISOString() })
    .where(eq(subscriptions.id, sub.id))
    .run();

  return db.select().from(subscriptions).where(eq(subscriptions.id, sub.id)).get()!;
}

export function getCurrentSubscription(userId: string) {
  return (
    db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')))
      .get() ?? null
  );
}

export function getSubscriptionDiscount(userId: string): number {
  const sub = getCurrentSubscription(userId);
  if (!sub) return 1.0;
  const config = PLAN_CONFIG[sub.plan as keyof typeof PLAN_CONFIG];
  return config ? 1 - config.discountPercent / 100 : 1.0;
}

export function getPlans() {
  return Object.entries(PLAN_CONFIG).map(([plan, config]) => ({
    plan,
    name: plan.charAt(0).toUpperCase() + plan.slice(1),
    price: config.price,
    interval: config.interval,
    discountPercent: config.discountPercent,
  }));
}
