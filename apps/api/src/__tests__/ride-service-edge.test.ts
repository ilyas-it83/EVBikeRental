/**
 * Ride Service Edge-Case Unit Tests
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
  CREATE TABLE IF NOT EXISTS stations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    dock_capacity INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS bikes (
    id TEXT PRIMARY KEY,
    serial_number TEXT UNIQUE NOT NULL,
    model TEXT NOT NULL,
    station_id TEXT REFERENCES stations(id),
    status TEXT NOT NULL DEFAULT 'available',
    battery_level INTEGER NOT NULL DEFAULT 100,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
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

vi.mock('../websocket.js', () => ({
  broadcastStationUpdate: vi.fn(),
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

import * as rideService from '../services/ride.service.js';

function seedUser(id: string) {
  sqlite.prepare(
    'INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)',
  ).run(id, `${id}@test.com`, 'Test User', '$2a$12$hash', 'rider');
}

function seedStation(id: string) {
  sqlite.prepare(
    'INSERT INTO stations (id, name, address, lat, lng, dock_capacity, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, `Station ${id}`, 'Addr', 40.7, -74.0, 20, 'active');
}

function seedBike(id: string, stationId: string, status: string = 'available', battery: number = 100) {
  sqlite.prepare(
    'INSERT INTO bikes (id, serial_number, model, station_id, status, battery_level) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, `SN-${id}`, 'EV-Pro', stationId, status, battery);
}

function seedPaymentMethod(userId: string) {
  sqlite.prepare(
    'INSERT INTO payment_methods (id, user_id, type, last4, brand, expiry_month, expiry_year, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(`pm-${userId}`, userId, 'card', '4242', 'Visa', 12, 2026, 1);
}

describe('Ride Service: startRide edge cases', () => {
  it('battery exactly 15% → succeeds', async () => {
    
    seedUser('u1');
    seedStation('s1');
    seedBike('b1', 's1', 'available', 15);
    seedPaymentMethod('u1');

    const ride = rideService.startRide('u1', 'b1', 's1');
    expect(ride.status).toBe('active');
    expect(ride.bikeId).toBe('b1');
  });

  it('battery 14% → fails with error', async () => {
    
    seedUser('u1');
    seedStation('s1');
    seedBike('b1', 's1', 'available', 14);
    seedPaymentMethod('u1');

    try {
      rideService.startRide('u1', 'b1', 's1');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(400);
      expect(err.error).toContain('battery');
    }
  });

  it('bike not at station → error', async () => {
    
    seedUser('u1');
    seedStation('s1');
    seedStation('s2');
    seedBike('b1', 's2');
    seedPaymentMethod('u1');

    try {
      rideService.startRide('u1', 'b1', 's1');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(400);
    }
  });

  it('user already has active ride → error', async () => {
    
    seedUser('u1');
    seedStation('s1');
    seedBike('b1', 's1');
    seedBike('b2', 's1');
    seedPaymentMethod('u1');

    rideService.startRide('u1', 'b1', 's1');

    // Re-seed b2 as available at station since b1 is now gone
    try {
      rideService.startRide('u1', 'b2', 's1');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(400);
      expect(err.error).toContain('active ride');
    }
  });

  it('no payment method → error', async () => {
    
    seedUser('u1');
    seedStation('s1');
    seedBike('b1', 's1');

    try {
      rideService.startRide('u1', 'b1', 's1');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(400);
      expect(err.error).toContain('payment method');
    }
  });
});

describe('Ride Service: endRide edge cases', () => {
  it('enforces minimum 1 minute duration', async () => {
    
    seedUser('u1');
    seedStation('s1');
    seedStation('s2');
    seedBike('b1', 's1');
    seedPaymentMethod('u1');

    const ride = rideService.startRide('u1', 'b1', 's1');
    // End immediately
    const ended = rideService.endRide(ride.id, 'u1', 's2');
    expect(ended.durationMinutes).toBeGreaterThanOrEqual(1);
  });

  it('creates payment record with correct amount', async () => {
    
    seedUser('u1');
    seedStation('s1');
    seedStation('s2');
    seedBike('b1', 's1');
    seedPaymentMethod('u1');

    const ride = rideService.startRide('u1', 'b1', 's1');
    const ended = rideService.endRide(ride.id, 'u1', 's2');

    expect(ended.payment).not.toBeNull();
    expect(ended.payment!.amount).toBeGreaterThan(0);
    expect(ended.payment!.status).toBe('completed');
    expect(ended.cost).toBe(ended.payment!.amount);
  });

  it('other user cannot end ride → 403', async () => {
    
    seedUser('u1');
    seedUser('u2');
    seedStation('s1');
    seedBike('b1', 's1');
    seedPaymentMethod('u1');

    const ride = rideService.startRide('u1', 'b1', 's1');

    try {
      rideService.endRide(ride.id, 'u2', 's1');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(403);
    }
  });

  it('non-existent ride → 404', async () => {
    
    try {
      rideService.endRide('nonexistent', 'u1', 's1');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(404);
    }
  });
});

describe('Ride Service: getRideHistory', () => {
  it('empty history returns empty array', async () => {
    
    seedUser('u1');

    const result = rideService.getRideHistory('u1');
    expect(result.rides).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(0);
  });

  it('pagination with page 2 limit 2', async () => {
    
    seedUser('u1');
    seedStation('s1');
    seedStation('s2');
    seedPaymentMethod('u1');

    // Create 5 rides
    for (let i = 1; i <= 5; i++) {
      seedBike(`b${i}`, 's1');
      const ride = rideService.startRide('u1', `b${i}`, 's1');
      rideService.endRide(ride.id, 'u1', 's2');
    }

    const page2 = rideService.getRideHistory('u1', 2, 2);
    expect(page2.rides).toHaveLength(2);
    expect(page2.page).toBe(2);
    expect(page2.total).toBe(5);
    expect(page2.totalPages).toBe(3);
  });
});

describe('Ride Service: getRideById', () => {
  it('other user\'s ride → 403', async () => {
    
    seedUser('u1');
    seedUser('u2');
    seedStation('s1');
    seedBike('b1', 's1');
    seedPaymentMethod('u1');

    const ride = rideService.startRide('u1', 'b1', 's1');

    try {
      rideService.getRideById(ride.id, 'u2');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(403);
    }
  });

  it('non-existent ride → 404', async () => {
    
    try {
      rideService.getRideById('nonexistent', 'u1');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(404);
    }
  });

  it('own ride returns enriched data', async () => {
    
    seedUser('u1');
    seedStation('s1');
    seedBike('b1', 's1');
    seedPaymentMethod('u1');

    const ride = rideService.startRide('u1', 'b1', 's1');
    const result = rideService.getRideById(ride.id, 'u1');
    expect(result.id).toBe(ride.id);
    expect(result.startStationName).toBeTruthy();
  });
});

describe('Ride Service: getActiveRide', () => {
  it('returns null when no active ride', () => {
    seedUser('u1');

    const result = rideService.getActiveRide('u1');
    expect(result).toBeNull();
  });

  it('returns the active ride with enriched data', () => {
    seedUser('u1');
    seedStation('s1');
    seedBike('b1', 's1');
    seedPaymentMethod('u1');

    const started = rideService.startRide('u1', 'b1', 's1');
    const active = rideService.getActiveRide('u1');
    expect(active).not.toBeNull();
    expect(active!.id).toBe(started.id);
    expect(active!.startStationName).toBeTruthy();
  });
});

describe('Ride Service: endRide additional edge cases', () => {
  it('endRide on already completed ride → 400', () => {
    seedUser('u1');
    seedStation('s1');
    seedStation('s2');
    seedBike('b1', 's1');
    seedPaymentMethod('u1');

    const ride = rideService.startRide('u1', 'b1', 's1');
    rideService.endRide(ride.id, 'u1', 's2');

    try {
      rideService.endRide(ride.id, 'u1', 's2');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(400);
      expect(err.error).toContain('not active');
    }
  });

  it('endRide with non-existent end station → 404', () => {
    seedUser('u1');
    seedStation('s1');
    seedBike('b1', 's1');
    seedPaymentMethod('u1');

    const ride = rideService.startRide('u1', 'b1', 's1');

    try {
      rideService.endRide(ride.id, 'u1', 'nonexistent-station');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(404);
      expect(err.error).toContain('End station not found');
    }
  });
});
