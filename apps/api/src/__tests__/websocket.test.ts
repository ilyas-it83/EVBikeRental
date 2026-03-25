/**
 * WebSocket Unit Tests
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

import { broadcastStationUpdate } from '../websocket.js';

function seedStation(id: string, capacity: number = 10) {
  sqlite.prepare(
    'INSERT INTO stations (id, name, address, lat, lng, dock_capacity, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, `Station ${id}`, 'Addr', 40.7, -74.0, capacity, 'active');
}

function seedBike(id: string, stationId: string, status: string = 'available') {
  sqlite.prepare(
    'INSERT INTO bikes (id, serial_number, model, station_id, status, battery_level) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, `SN-${id}`, 'EV-Pro', stationId, status, 100);
}

describe('WebSocket: broadcastStationUpdate', () => {
  it('does not throw when wss is null (no server setup)', () => {
    expect(() => broadcastStationUpdate('s1')).not.toThrow();
  });

  it('does not throw for non-existent station', () => {
    expect(() => broadcastStationUpdate('nonexistent')).not.toThrow();
  });

  it('handles station with bikes without error', () => {
    seedStation('s1', 10);
    seedBike('b1', 's1', 'available');
    seedBike('b2', 's1', 'in_use');

    // No wss set up, so it just returns silently
    expect(() => broadcastStationUpdate('s1')).not.toThrow();
  });
});
