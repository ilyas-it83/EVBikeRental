/**
 * Payment Service Unit Tests
 *
 * Tests payment.service.ts:
 * - processPayment: creates payment record
 * - processPayment: uses default payment method
 * - refundPayment: marks payment as refunded
 * - refundPayment: non-existent → 404
 * - MockPaymentAdapter: charge, refund, preAuthorize
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
  CREATE TABLE IF NOT EXISTS rides (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    bike_id TEXT NOT NULL,
    start_station_id TEXT NOT NULL,
    end_station_id TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT,
    duration_minutes INTEGER,
    distance_km REAL,
    cost REAL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    ride_id TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'pending',
    method TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS payment_methods (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'card',
    last4 TEXT NOT NULL,
    brand TEXT NOT NULL,
    expiry_month INTEGER NOT NULL,
    expiry_year INTEGER NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
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
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  sqlite.close();
  _dbRef.current = null;
});

import { processPayment, refundPayment, MockPaymentAdapter } from '../services/payment.service.js';

function seedUser(id: string) {
  sqlite.prepare(
    'INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)',
  ).run(id, `${id}@test.com`, 'Test', '$2a$12$hash', 'rider');
}

function seedRide(id: string, userId: string) {
  sqlite.prepare(
    'INSERT INTO rides (id, user_id, bike_id, start_station_id, start_time, status) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, userId, 'b1', 's1', new Date().toISOString(), 'active');
}

function seedPaymentMethod(userId: string, isDefault: boolean = true) {
  sqlite.prepare(
    'INSERT INTO payment_methods (id, user_id, type, last4, brand, expiry_month, expiry_year, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(`pm-${userId}`, userId, 'card', '4242', 'Visa', 12, 2026, isDefault ? 1 : 0);
}

describe('Payment Service: processPayment', () => {
  it('creates a completed payment record', () => {
    seedUser('u1');
    seedRide('r1', 'u1');

    const payment = processPayment('u1', 'r1', 5.50);
    expect(payment.userId).toBe('u1');
    expect(payment.rideId).toBe('r1');
    expect(payment.amount).toBe(5.50);
    expect(payment.status).toBe('completed');
    expect(payment.currency).toBe('USD');
  });

  it('uses default payment method for method field', () => {
    seedUser('u1');
    seedRide('r1', 'u1');
    seedPaymentMethod('u1', true);

    const payment = processPayment('u1', 'r1', 3.00);
    expect(payment.method).toBe('Visa ****4242');
  });

  it('sets method to null when no default payment method', () => {
    seedUser('u1');
    seedRide('r1', 'u1');

    const payment = processPayment('u1', 'r1', 3.00);
    expect(payment.method).toBeNull();
  });
});

describe('Payment Service: refundPayment', () => {
  it('marks payment as refunded', () => {
    seedUser('u1');
    seedRide('r1', 'u1');
    const payment = processPayment('u1', 'r1', 5.00);

    const refunded = refundPayment(payment.id);
    expect(refunded.status).toBe('refunded');
    expect(refunded.amount).toBe(5.00);
  });

  it('throws 404 for non-existent payment', () => {
    try {
      refundPayment('nonexistent');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(404);
      expect(err.error).toContain('Payment not found');
    }
  });
});

describe('MockPaymentAdapter', () => {
  it('charge returns success with transactionId', () => {
    const adapter = new MockPaymentAdapter();
    const result = adapter.charge(10.00, 'USD');
    expect(result.success).toBe(true);
    expect(result.transactionId).toMatch(/^mock_txn_/);
  });

  it('refund returns success', () => {
    const adapter = new MockPaymentAdapter();
    const result = adapter.refund('txn-123', 5.00);
    expect(result.success).toBe(true);
  });

  it('preAuthorize returns success with authId', () => {
    const adapter = new MockPaymentAdapter();
    const result = adapter.preAuthorize(50.00, 'USD');
    expect(result.success).toBe(true);
    expect(result.authId).toMatch(/^mock_auth_/);
  });
});
