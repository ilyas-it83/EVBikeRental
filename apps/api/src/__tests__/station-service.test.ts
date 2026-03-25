/**
 * Station Service Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema.js';

const SCHEMA_SQL = `
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

import * as stationService from '../services/station.service.js';

function seedStation(id: string, name: string, lat: number, lng: number, capacity: number = 10, status: string = 'active') {
  sqlite.prepare(
    'INSERT INTO stations (id, name, address, lat, lng, dock_capacity, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, name, `${name} Address`, lat, lng, capacity, status);
}

function seedBike(id: string, stationId: string | null, status: string = 'available', battery: number = 100) {
  sqlite.prepare(
    'INSERT INTO bikes (id, serial_number, model, station_id, status, battery_level) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, `SN-${id}`, 'EV-Standard', stationId, status, battery);
}

describe('Station Service: listStations', () => {
  it('returns all active stations', async () => {
    
    seedStation('s1', 'Active 1', 40.7, -74.0);
    seedStation('s2', 'Active 2', 40.8, -74.0);
    seedStation('s3', 'Inactive', 40.9, -74.0, 10, 'inactive');

    const result = stationService.listStations();
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.name)).toContain('Active 1');
    expect(result.map((s) => s.name)).toContain('Active 2');
    expect(result.map((s) => s.name)).not.toContain('Inactive');
  });

  it('returns empty array when no stations exist', async () => {
    
    const result = stationService.listStations();
    expect(result).toEqual([]);
  });

  it('with coordinates, filters by default 10km radius and sorts by distance', async () => {
    
    // Times Square
    seedStation('s-ts', 'Times Square', 40.758896, -73.98513);
    // Central Park (~3km from TS)
    seedStation('s-cp', 'Central Park', 40.785091, -73.968285);
    // Brooklyn Bridge (~6km from TS)
    seedStation('s-bb', 'Brooklyn Bridge', 40.706086, -73.996864);
    // Far away station (~15km from TS - outside default 10km)
    seedStation('s-far', 'Far Station', 40.9, -73.8);

    const result = stationService.listStations(40.758896, -73.98513);
    // Should exclude s-far (>10km)
    expect(result.length).toBeLessThanOrEqual(3);
    // Should be sorted by distance
    for (let i = 1; i < result.length; i++) {
      expect(result[i].distance).toBeGreaterThanOrEqual(result[i - 1].distance);
    }
    // Times Square should be first (distance ~0)
    expect(result[0].name).toBe('Times Square');
    expect(result[0].distance).toBeLessThan(0.01);
  });

  it('with coordinates and custom radius, filters correctly', async () => {
    
    seedStation('s1', 'Near', 40.758, -73.985);
    seedStation('s2', 'Far', 40.706, -73.997); // ~6km away

    const result = stationService.listStations(40.758896, -73.98513, 2);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Near');
  });

  it('counts available bikes correctly', async () => {
    
    seedStation('s1', 'Station A', 40.7, -74.0, 10);
    seedBike('b1', 's1', 'available');
    seedBike('b2', 's1', 'available');
    seedBike('b3', 's1', 'in_use');
    seedBike('b4', 's1', 'maintenance');

    const result = stationService.listStations();
    expect(result[0].availableBikes).toBe(2);
    expect(result[0].emptyDocks).toBe(6); // 10 - 4 total bikes
  });

  it('station with no bikes shows 0 available and full docks', async () => {
    
    seedStation('s1', 'Empty Station', 40.7, -74.0, 15);

    const result = stationService.listStations();
    expect(result[0].availableBikes).toBe(0);
    expect(result[0].emptyDocks).toBe(15);
  });
});

describe('Station Service: getStationById', () => {
  it('returns station detail with bikes array', async () => {
    
    seedStation('s1', 'Test Station', 40.7, -74.0, 20);
    seedBike('b1', 's1', 'available', 95);
    seedBike('b2', 's1', 'maintenance', 10);

    const result = stationService.getStationById('s1');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Test Station');
    expect(result!.bikes).toHaveLength(2);
    expect(result!.availableBikes).toBe(1);
    expect(result!.emptyDocks).toBe(18); // 20 - 2
    expect(result!.bikes[0]).toHaveProperty('id');
    expect(result!.bikes[0]).toHaveProperty('model');
    expect(result!.bikes[0]).toHaveProperty('batteryLevel');
    expect(result!.bikes[0]).toHaveProperty('status');
  });

  it('returns null for non-existent station', async () => {
    
    expect(stationService.getStationById('nonexistent')).toBeNull();
  });

  it('returns station with empty bikes array when no bikes', async () => {
    
    seedStation('s1', 'No Bikes', 40.7, -74.0, 10);

    const result = stationService.getStationById('s1');
    expect(result).not.toBeNull();
    expect(result!.bikes).toEqual([]);
    expect(result!.availableBikes).toBe(0);
    expect(result!.emptyDocks).toBe(10);
  });
});
