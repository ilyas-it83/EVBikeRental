/**
 * Fleet Service Unit Tests
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

import * as fleetService from '../services/fleet.service.js';

function seedStation(id: string, name: string, status: string = 'active') {
  sqlite.prepare(
    'INSERT INTO stations (id, name, address, lat, lng, dock_capacity, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, name, 'Addr', 40.7, -74.0, 20, status);
}

function seedBike(id: string, stationId: string | null, status: string) {
  sqlite.prepare(
    'INSERT INTO bikes (id, serial_number, model, station_id, status, battery_level) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, `SN-${id}`, 'EV-Pro', stationId, status, 80);
}

describe('Fleet Service: getFleetOverview', () => {
  it('empty database returns all zeros', async () => {
    
    const overview = fleetService.getFleetOverview();

    expect(overview.totalBikes).toBe(0);
    expect(overview.totalStations).toBe(0);
    expect(overview.activeBikes).toBe(0);
    expect(overview.availableBikes).toBe(0);
    expect(overview.maintenanceBikes).toBe(0);
    expect(overview.activeRides).toBe(0);
    expect(overview.completedRidesToday).toBe(0);
    expect(overview.revenueToday).toBe(0);
  });

  it('returns correct counts with mixed data', async () => {
    
    seedStation('s1', 'Station A');
    seedStation('s2', 'Station B');
    seedStation('s3', 'Inactive', 'inactive');

    seedBike('b1', 's1', 'available');
    seedBike('b2', 's1', 'available');
    seedBike('b3', 's1', 'in_use');
    seedBike('b4', 's2', 'maintenance');
    seedBike('b5', 's2', 'retired');

    // Active ride
    sqlite.prepare(
      'INSERT INTO rides (id, user_id, bike_id, start_station_id, start_time, status) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('r1', 'u1', 'b3', 's1', new Date().toISOString(), 'active');

    const overview = fleetService.getFleetOverview();
    expect(overview.totalBikes).toBe(5);
    expect(overview.totalStations).toBe(2); // only active
    expect(overview.activeBikes).toBe(1);
    expect(overview.availableBikes).toBe(2);
    expect(overview.maintenanceBikes).toBe(1);
    expect(overview.activeRides).toBe(1);
  });

  it('revenue today counts only today\'s completed payments', async () => {
    
    seedStation('s1', 'Station');
    seedBike('b1', 's1', 'available');

    const now = new Date();
    const todayISO = now.toISOString();

    // Today's completed ride
    sqlite.prepare(
      'INSERT INTO rides (id, user_id, bike_id, start_station_id, end_station_id, start_time, end_time, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run('r1', 'u1', 'b1', 's1', 's1', todayISO, todayISO, 'completed');

    // Today's payment
    sqlite.prepare(
      'INSERT INTO payments (id, user_id, ride_id, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('p1', 'u1', 'r1', 5.50, 'completed', todayISO);

    // Yesterday's payment (should not be counted)
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    sqlite.prepare(
      'INSERT INTO rides (id, user_id, bike_id, start_station_id, start_time, end_time, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run('r2', 'u1', 'b1', 's1', yesterday, yesterday, 'completed');
    sqlite.prepare(
      'INSERT INTO payments (id, user_id, ride_id, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('p2', 'u1', 'r2', 3.00, 'completed', yesterday);

    const overview = fleetService.getFleetOverview();
    expect(overview.revenueToday).toBe(5.50);
  });
});

describe('Fleet Service: getStationDetails', () => {
  it('returns all stations with their bikes', async () => {
    
    seedStation('s1', 'Station A');
    seedStation('s2', 'Station B');
    seedBike('b1', 's1', 'available');
    seedBike('b2', 's1', 'in_use');
    seedBike('b3', 's2', 'available');

    const details = fleetService.getStationDetails();
    expect(details).toHaveLength(2);

    const station1 = details.find((s) => s.id === 's1')!;
    expect(station1.bikes).toHaveLength(2);
    expect(station1.availableBikes).toBe(1);
    expect(station1.totalBikes).toBe(2);
    expect(station1.emptyDocks).toBe(18); // 20 - 2

    const station2 = details.find((s) => s.id === 's2')!;
    expect(station2.bikes).toHaveLength(1);
    expect(station2.availableBikes).toBe(1);
  });

  it('empty database returns empty array', async () => {
    
    expect(fleetService.getStationDetails()).toEqual([]);
  });

  it('includes bike details (id, serialNumber, model, status, batteryLevel)', async () => {
    
    seedStation('s1', 'Station');
    seedBike('b1', 's1', 'available');

    const details = fleetService.getStationDetails();
    const bike = details[0].bikes[0];
    expect(bike).toHaveProperty('id');
    expect(bike).toHaveProperty('serialNumber');
    expect(bike).toHaveProperty('model');
    expect(bike).toHaveProperty('status');
    expect(bike).toHaveProperty('batteryLevel');
  });
});
