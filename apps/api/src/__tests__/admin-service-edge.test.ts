/**
 * Admin Service Edge-Case Unit Tests
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

import * as adminService from '../services/admin.service.js';

function seedStation(id: string, status: string = 'active') {
  sqlite.prepare(
    'INSERT INTO stations (id, name, address, lat, lng, dock_capacity, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, `Station ${id}`, 'Address', 40.7, -74.0, 20, status);
}

function seedBike(id: string, stationId: string, status: string = 'available', battery: number = 100) {
  sqlite.prepare(
    'INSERT INTO bikes (id, serial_number, model, station_id, status, battery_level) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, `SN-${id}`, 'EV-Pro', stationId, status, battery);
}

function seedUser(id: string, role: string = 'rider') {
  sqlite.prepare(
    'INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)',
  ).run(id, `${id}@test.com`, `User ${id}`, '$2a$12$hash', role);
}

describe('Admin Service: Station Management', () => {
  it('createStation generates a UUID', async () => {
    
    const station = adminService.createStation({
      name: 'New Station',
      address: '123 Main St',
      lat: 40.7128,
      lng: -74.006,
      dockCapacity: 15,
    });

    expect(station.id).toBeTruthy();
    expect(station.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(station.name).toBe('New Station');
    expect(station.status).toBe('active');
  });

  it('deleteStation fails when active bikes (in_use) are at station', async () => {
    
    seedStation('s1');
    seedBike('b1', 's1', 'in_use');

    try {
      adminService.deleteStation('s1');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(400);
      expect(err.error).toContain('active bikes');
    }
  });

  it('deleteStation succeeds when no in_use bikes', async () => {
    
    seedStation('s1');
    seedBike('b1', 's1', 'available');

    const result = adminService.deleteStation('s1');
    expect(result.status).toBe('inactive');
  });

  it('deleteStation throws 404 for non-existent station', async () => {
    
    try {
      adminService.deleteStation('nonexistent');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(404);
    }
  });

  it('updateStation modifies fields', async () => {
    
    seedStation('s1');

    const updated = adminService.updateStation('s1', { name: 'Updated Name' });
    expect(updated.name).toBe('Updated Name');
  });

  it('listAllStations returns all stations including inactive', async () => {
    
    seedStation('s1', 'active');
    seedStation('s2', 'inactive');

    const all = adminService.listAllStations();
    expect(all).toHaveLength(2);
  });
});

describe('Admin Service: Bike Management', () => {
  it('createBike with invalid stationId → 404 error', async () => {
    
    try {
      adminService.createBike({
        serialNumber: 'SN-NEW',
        model: 'EV-Pro',
        stationId: 'nonexistent-station',
      });
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(404);
      expect(err.error).toContain('Station not found');
    }
  });

  it('createBike with valid station succeeds', async () => {
    
    seedStation('s1');

    const bike = adminService.createBike({
      serialNumber: 'SN-NEW',
      model: 'EV-Pro',
      stationId: 's1',
      batteryLevel: 80,
    });

    expect(bike.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(bike.model).toBe('EV-Pro');
    expect(bike.status).toBe('available');
    expect(bike.batteryLevel).toBe(80);
  });

  it('deleteBike in_use → error', async () => {
    
    seedStation('s1');
    seedBike('b1', 's1', 'in_use');

    try {
      adminService.deleteBike('b1');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(400);
      expect(err.error).toContain('in use');
    }
  });

  it('deleteBike available → marks as retired', async () => {
    
    seedStation('s1');
    seedBike('b1', 's1', 'available');

    const result = adminService.deleteBike('b1');
    expect(result.status).toBe('retired');
  });

  it('deleteBike maintenance → marks as retired', async () => {
    
    seedStation('s1');
    seedBike('b1', 's1', 'maintenance');

    const result = adminService.deleteBike('b1');
    expect(result.status).toBe('retired');
  });

  it('deleteBike already retired → still succeeds (idempotent)', async () => {
    
    seedStation('s1');
    seedBike('b1', 's1', 'retired');

    const result = adminService.deleteBike('b1');
    expect(result.status).toBe('retired');
  });

  it('listBikes filter by lowBattery (< 20%)', async () => {
    
    seedStation('s1');
    seedBike('b1', 's1', 'available', 95);
    seedBike('b2', 's1', 'available', 19); // low
    seedBike('b3', 's1', 'available', 5);  // low
    seedBike('b4', 's1', 'available', 20); // NOT low (threshold is <20)

    const lowBikes = adminService.listAllBikes({ lowBattery: true });
    expect(lowBikes).toHaveLength(2);
    expect(lowBikes.every((b) => b.batteryLevel < 20)).toBe(true);
  });

  it('listBikes filter by stationId', async () => {
    
    seedStation('s1');
    seedStation('s2');
    seedBike('b1', 's1');
    seedBike('b2', 's2');

    const result = adminService.listAllBikes({ stationId: 's1' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b1');
  });

  it('listBikes filter by status', async () => {
    
    seedStation('s1');
    seedBike('b1', 's1', 'available');
    seedBike('b2', 's1', 'maintenance');

    const result = adminService.listAllBikes({ status: 'maintenance' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b2');
  });
});

describe('Admin Service: User Management', () => {
  it('listUsers pagination math correct', async () => {
    
    for (let i = 0; i < 7; i++) {
      seedUser(`u${i}`);
    }

    const page1 = adminService.listUsers(1, 3);
    expect(page1.users).toHaveLength(3);
    expect(page1.total).toBe(7);
    expect(page1.page).toBe(1);
    expect(page1.totalPages).toBe(3); // ceil(7/3)

    const page3 = adminService.listUsers(3, 3);
    expect(page3.users).toHaveLength(1); // remaining
    expect(page3.page).toBe(3);
  });

  it('updateUserRole rider → admin', async () => {
    
    seedUser('u1', 'rider');

    const updated = adminService.updateUserRole('u1', 'admin');
    expect(updated.role).toBe('admin');
    expect(updated).not.toHaveProperty('passwordHash');
  });

  it('updateUserRole admin → rider', async () => {
    
    seedUser('u1', 'admin');

    const updated = adminService.updateUserRole('u1', 'rider');
    expect(updated.role).toBe('rider');
  });

  it('updateUserRole non-existent user → 404', async () => {
    
    try {
      adminService.updateUserRole('nonexistent', 'admin');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(404);
    }
  });

  it('suspendUser returns suspended info', async () => {
    
    seedUser('u1');

    const result = adminService.suspendUser('u1');
    expect(result.suspended).toBe(true);
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('suspendUser non-existent → 404', () => {
    try {
      adminService.suspendUser('nonexistent');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(404);
    }
  });
});

describe('Admin Service: updateBike', () => {
  it('updates bike fields', () => {
    seedStation('s1');
    seedBike('b1', 's1', 'available', 50);

    const updated = adminService.updateBike('b1', { batteryLevel: 100 });
    expect(updated.batteryLevel).toBe(100);
  });

  it('non-existent bike → 404', () => {
    try {
      adminService.updateBike('nonexistent', { batteryLevel: 100 });
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(404);
    }
  });

  it('deleteBike non-existent → 404', () => {
    try {
      adminService.deleteBike('nonexistent');
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(404);
    }
  });

  it('updateStation non-existent → 404', () => {
    try {
      adminService.updateStation('nonexistent', { name: 'X' });
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.status).toBe(404);
    }
  });
});
