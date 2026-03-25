/**
 * Reservation Service Edge-Case Unit Tests
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
  CREATE TABLE IF NOT EXISTS reservations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    bike_id TEXT NOT NULL,
    station_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    expires_at TEXT NOT NULL,
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

import * as reservationService from '../services/reservation.service.js';

function seedUser(id: string) {
  sqlite.prepare(
    'INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)',
  ).run(id, `${id}@test.com`, 'User', '$2a$12$hash', 'rider');
}

function seedStation(id: string) {
  sqlite.prepare(
    'INSERT INTO stations (id, name, address, lat, lng, dock_capacity, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, `Station ${id}`, 'Addr', 40.7, -74.0, 20, 'active');
}

function seedBike(id: string, stationId: string, status: string = 'available') {
  sqlite.prepare(
    'INSERT INTO bikes (id, serial_number, model, station_id, status, battery_level) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, `SN-${id}`, 'EV-Pro', stationId, status, 100);
}

describe('Reservation Service: reserveBike', () => {
  it('creates a reservation and marks bike as reserved', async () => {
    
    seedUser('u1');
    seedStation('s1');
    seedBike('b1', 's1');

    const res = reservationService.reserveBike('u1', 'b1', 's1');
    expect(res.userId).toBe('u1');
    expect(res.bikeId).toBe('b1');
    expect(res.status).toBe('active');
    expect(res.expiresAt).toBeTruthy();

    // Bike should be reserved
    const bike = sqlite.prepare('SELECT status FROM bikes WHERE id = ?').get('b1') as any;
    expect(bike.status).toBe('reserved');
  });

  it('bike not at station → 400', async () => {
    
    seedUser('u1');
    seedStation('s1');
    seedStation('s2');
    seedBike('b1', 's2');

    try {
      reservationService.reserveBike('u1', 'b1', 's1');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(400);
    }
  });

  it('bike not available → 400', async () => {
    
    seedUser('u1');
    seedStation('s1');
    seedBike('b1', 's1', 'in_use');

    try {
      reservationService.reserveBike('u1', 'b1', 's1');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(400);
    }
  });

  it('user already has active reservation → 400', async () => {
    
    seedUser('u1');
    seedStation('s1');
    seedBike('b1', 's1');
    seedBike('b2', 's1');

    reservationService.reserveBike('u1', 'b1', 's1');

    try {
      reservationService.reserveBike('u1', 'b2', 's1');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(400);
      expect(err.error).toContain('active reservation');
    }
  });

  it('non-existent bike → 404', async () => {
    
    seedUser('u1');
    seedStation('s1');

    try {
      reservationService.reserveBike('u1', 'nonexistent', 's1');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(404);
    }
  });
});

describe('Reservation Service: expireReservations', () => {
  it('bulk expires multiple past reservations', async () => {
    
    seedStation('s1');
    seedBike('b1', 's1', 'reserved');
    seedBike('b2', 's1', 'reserved');

    const pastTime = new Date(Date.now() - 60000).toISOString();
    sqlite.prepare(
      'INSERT INTO reservations (id, user_id, bike_id, station_id, status, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('r1', 'u1', 'b1', 's1', 'active', pastTime);
    sqlite.prepare(
      'INSERT INTO reservations (id, user_id, bike_id, station_id, status, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('r2', 'u2', 'b2', 's1', 'active', pastTime);

    vi.spyOn(console, 'log').mockImplementation(() => {});
    reservationService.expireReservations();

    const r1 = sqlite.prepare('SELECT status FROM reservations WHERE id = ?').get('r1') as any;
    const r2 = sqlite.prepare('SELECT status FROM reservations WHERE id = ?').get('r2') as any;
    expect(r1.status).toBe('expired');
    expect(r2.status).toBe('expired');

    // Bikes should be available again
    const b1 = sqlite.prepare('SELECT status FROM bikes WHERE id = ?').get('b1') as any;
    const b2 = sqlite.prepare('SELECT status FROM bikes WHERE id = ?').get('b2') as any;
    expect(b1.status).toBe('available');
    expect(b2.status).toBe('available');
  });

  it('does not expire future reservations', async () => {
    
    seedStation('s1');
    seedBike('b1', 's1', 'reserved');

    const futureTime = new Date(Date.now() + 600000).toISOString();
    sqlite.prepare(
      'INSERT INTO reservations (id, user_id, bike_id, station_id, status, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('r1', 'u1', 'b1', 's1', 'active', futureTime);

    reservationService.expireReservations();

    const r1 = sqlite.prepare('SELECT status FROM reservations WHERE id = ?').get('r1') as any;
    expect(r1.status).toBe('active');
  });
});

describe('Reservation Service: getActiveReservation', () => {
  it('returns null when no active reservation', async () => {
    
    seedUser('u1');

    expect(reservationService.getActiveReservation('u1')).toBeNull();
  });

  it('auto-expires past reservation and returns null', async () => {
    
    seedStation('s1');
    seedBike('b1', 's1', 'reserved');

    const pastTime = new Date(Date.now() - 60000).toISOString();
    sqlite.prepare(
      'INSERT INTO reservations (id, user_id, bike_id, station_id, status, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('r1', 'u1', 'b1', 's1', 'active', pastTime);

    const result = reservationService.getActiveReservation('u1');
    expect(result).toBeNull();

    // Reservation should be expired
    const r1 = sqlite.prepare('SELECT status FROM reservations WHERE id = ?').get('r1') as any;
    expect(r1.status).toBe('expired');

    // Bike should be available
    const b1 = sqlite.prepare('SELECT status FROM bikes WHERE id = ?').get('b1') as any;
    expect(b1.status).toBe('available');
  });

  it('returns active future reservation', async () => {
    
    seedUser('u1');
    seedStation('s1');
    seedBike('b1', 's1');

    const res = reservationService.reserveBike('u1', 'b1', 's1');
    const active = reservationService.getActiveReservation('u1');
    expect(active).not.toBeNull();
    expect(active!.id).toBe(res.id);
  });
});

describe('Reservation Service: cancelReservation', () => {
  it('wrong user → 403', async () => {
    
    seedUser('u1');
    seedUser('u2');
    seedStation('s1');
    seedBike('b1', 's1');

    const res = reservationService.reserveBike('u1', 'b1', 's1');

    try {
      reservationService.cancelReservation(res.id, 'u2');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(403);
    }
  });

  it('already expired/cancelled → 400', async () => {
    
    seedStation('s1');
    seedBike('b1', 's1');

    sqlite.prepare(
      'INSERT INTO reservations (id, user_id, bike_id, station_id, status, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('r1', 'u1', 'b1', 's1', 'expired', new Date().toISOString());

    try {
      reservationService.cancelReservation('r1', 'u1');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(400);
      expect(err.error).toContain('not active');
    }
  });

  it('cancels reservation and restores bike to available', async () => {
    
    seedUser('u1');
    seedStation('s1');
    seedBike('b1', 's1');

    const res = reservationService.reserveBike('u1', 'b1', 's1');
    const cancelled = reservationService.cancelReservation(res.id, 'u1');
    expect(cancelled.status).toBe('cancelled');

    const bike = sqlite.prepare('SELECT status FROM bikes WHERE id = ?').get('b1') as any;
    expect(bike.status).toBe('available');
  });

  it('non-existent reservation → 404', async () => {
    

    try {
      reservationService.cancelReservation('nonexistent', 'u1');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(404);
    }
  });
});
