import { db } from '../db/index.js';
import { disputes, rides } from '../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import crypto from 'crypto';

// ─── Types ──────────────────────────────────────────

type DisputeReason = 'overcharge' | 'bike_issue' | 'wrong_station' | 'other';
type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'rejected';

// ─── Public API ─────────────────────────────────────

export function createDispute(
  userId: string,
  rideId: string,
  reason: DisputeReason,
  description: string,
): typeof disputes.$inferSelect {
  // Validate the ride exists and belongs to the user
  const ride = db.select().from(rides).where(eq(rides.id, rideId)).get();
  if (!ride) {
    throw { status: 404, error: 'Ride not found' };
  }
  if (ride.userId !== userId) {
    throw { status: 403, error: 'Not your ride' };
  }
  if (ride.status !== 'completed') {
    throw { status: 400, error: 'Can only dispute completed rides' };
  }

  // Check for existing open dispute on this ride
  const existing = db
    .select()
    .from(disputes)
    .where(and(eq(disputes.rideId, rideId), eq(disputes.userId, userId)))
    .get();
  if (existing) {
    throw { status: 409, error: 'A dispute already exists for this ride' };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.insert(disputes)
    .values({ id, userId, rideId, reason, description, status: 'open', createdAt: now, updatedAt: now })
    .run();

  return db.select().from(disputes).where(eq(disputes.id, id)).get()!;
}

export function getUserDisputes(
  userId: string,
  page: number = 1,
  limit: number = 20,
): { disputes: (typeof disputes.$inferSelect)[]; total: number; page: number; totalPages: number } {
  const offset = (page - 1) * limit;

  const total = db
    .select({ count: sql<number>`count(*)` })
    .from(disputes)
    .where(eq(disputes.userId, userId))
    .get()!.count;

  const rows = db
    .select()
    .from(disputes)
    .where(eq(disputes.userId, userId))
    .orderBy(desc(disputes.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return { disputes: rows, total, page, totalPages: Math.ceil(total / limit) };
}

export function getDisputeById(disputeId: string, userId: string): typeof disputes.$inferSelect {
  const dispute = db.select().from(disputes).where(eq(disputes.id, disputeId)).get();
  if (!dispute) {
    throw { status: 404, error: 'Dispute not found' };
  }
  if (dispute.userId !== userId) {
    throw { status: 403, error: 'Not your dispute' };
  }
  return dispute;
}

export function listAllDisputes(
  page: number = 1,
  limit: number = 20,
  status?: DisputeStatus,
): { disputes: (typeof disputes.$inferSelect)[]; total: number; page: number; totalPages: number } {
  const offset = (page - 1) * limit;

  const condition = status ? eq(disputes.status, status) : undefined;

  const total = db
    .select({ count: sql<number>`count(*)` })
    .from(disputes)
    .where(condition)
    .get()!.count;

  const rows = db
    .select()
    .from(disputes)
    .where(condition)
    .orderBy(desc(disputes.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return { disputes: rows, total, page, totalPages: Math.ceil(total / limit) };
}

export function updateDisputeStatus(
  disputeId: string,
  status: DisputeStatus,
  resolution?: string,
): typeof disputes.$inferSelect {
  const dispute = db.select().from(disputes).where(eq(disputes.id, disputeId)).get();
  if (!dispute) {
    throw { status: 404, error: 'Dispute not found' };
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { status, updatedAt: now };
  if (resolution !== undefined) {
    updates.resolution = resolution;
  }

  db.update(disputes).set(updates).where(eq(disputes.id, disputeId)).run();

  return db.select().from(disputes).where(eq(disputes.id, disputeId)).get()!;
}
