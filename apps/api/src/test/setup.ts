/**
 * Backend test setup & utilities
 *
 * Provides helpers for:
 * - Creating an in-memory SQLite test database with schema
 * - Seeding test data (users, stations, bikes)
 * - Creating authenticated test users (returns JWT cookies)
 * - Getting a supertest agent for the Express app
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { afterEach, beforeEach } from 'vitest';

// ─── Constants ──────────────────────────────────────

export const TEST_JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
export const TEST_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-only';

// ─── Types ──────────────────────────────────────────

export interface TestUser {
  id: string;
  email: string;
  name: string;
  role: string;
  passwordHash: string;
}

export interface TestStation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  capacity: number;
}

export interface TestBike {
  id: string;
  stationId: string | null;
  status: string;
  batteryLevel: number;
  model: string;
}

// ─── Database Schema ────────────────────────────────

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
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    address TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 10,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bikes (
    id TEXT PRIMARY KEY,
    station_id TEXT REFERENCES stations(id),
    status TEXT NOT NULL DEFAULT 'available',
    battery_level INTEGER NOT NULL DEFAULT 100,
    model TEXT NOT NULL DEFAULT 'EV-Standard',
    last_maintenance_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rides (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    bike_id TEXT NOT NULL REFERENCES bikes(id),
    start_station_id TEXT NOT NULL REFERENCES stations(id),
    end_station_id TEXT REFERENCES stations(id),
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
    user_id TEXT NOT NULL REFERENCES users(id),
    ride_id TEXT NOT NULL REFERENCES rides(id),
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'pending',
    method TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS payment_methods (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    type TEXT NOT NULL DEFAULT 'card',
    last4 TEXT NOT NULL,
    brand TEXT NOT NULL,
    expiry_month INTEGER NOT NULL,
    expiry_year INTEGER NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

// ─── Database Helpers ───────────────────────────────

export function createTestDb(): { db: ReturnType<typeof drizzle>; sqlite: InstanceType<typeof Database> } {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(SCHEMA_SQL);
  const db = drizzle(sqlite);
  return { db, sqlite };
}

// ─── Seed Data ──────────────────────────────────────

export const SEED_USERS = {
  rider: {
    id: 'user-rider-001',
    email: 'rider@test.com',
    name: 'Test Rider',
    password: 'SecurePass123',
    role: 'rider',
  },
  admin: {
    id: 'user-admin-001',
    email: 'admin@test.com',
    name: 'Test Admin',
    password: 'AdminPass456',
    role: 'admin',
  },
} as const;

export const SEED_STATIONS = [
  {
    id: 'station-001',
    name: 'Central Park Station',
    latitude: 40.785091,
    longitude: -73.968285,
    address: '100 Central Park West, New York',
    capacity: 20,
  },
  {
    id: 'station-002',
    name: 'Times Square Station',
    latitude: 40.758896,
    longitude: -73.98513,
    address: 'Times Square, New York',
    capacity: 15,
  },
  {
    id: 'station-003',
    name: 'Brooklyn Bridge Station',
    latitude: 40.706086,
    longitude: -73.996864,
    address: 'Brooklyn Bridge, New York',
    capacity: 10,
  },
] as const;

export const SEED_BIKES = [
  { id: 'bike-001', stationId: 'station-001', status: 'available', batteryLevel: 95, model: 'EV-Pro' },
  { id: 'bike-002', stationId: 'station-001', status: 'available', batteryLevel: 80, model: 'EV-Standard' },
  { id: 'bike-003', stationId: 'station-001', status: 'maintenance', batteryLevel: 10, model: 'EV-Standard' },
  { id: 'bike-004', stationId: 'station-002', status: 'available', batteryLevel: 60, model: 'EV-Pro' },
  { id: 'bike-005', stationId: 'station-002', status: 'rented', batteryLevel: 45, model: 'EV-Standard' },
  { id: 'bike-006', stationId: 'station-003', status: 'available', batteryLevel: 100, model: 'EV-Pro' },
] as const;

export async function seedTestData(sqlite: Database.Database) {
  // Seed users with hashed passwords
  for (const user of Object.values(SEED_USERS)) {
    const hash = await bcrypt.hash(user.password, 10);
    sqlite
      .prepare(
        'INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      )
      .run(user.id, user.email, user.name, hash, user.role);
  }

  // Seed stations
  for (const station of SEED_STATIONS) {
    sqlite
      .prepare(
        'INSERT INTO stations (id, name, latitude, longitude, address, capacity) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(station.id, station.name, station.latitude, station.longitude, station.address, station.capacity);
  }

  // Seed bikes
  for (const bike of SEED_BIKES) {
    sqlite
      .prepare(
        'INSERT INTO bikes (id, station_id, status, battery_level, model) VALUES (?, ?, ?, ?, ?)',
      )
      .run(bike.id, bike.stationId, bike.status, bike.batteryLevel, bike.model);
  }
}

// ─── Auth Helpers ───────────────────────────────────

export function generateAccessToken(userId: string, role: string = 'rider'): string {
  return jwt.sign({ sub: userId, role }, TEST_JWT_SECRET, { expiresIn: '15m' });
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'refresh' }, TEST_REFRESH_SECRET, { expiresIn: '30d' });
}

export function generateExpiredToken(userId: string): string {
  return jwt.sign({ sub: userId, role: 'rider' }, TEST_JWT_SECRET, { expiresIn: '0s' });
}

export interface AuthCookies {
  accessToken: string;
  refreshToken: string;
  cookieHeader: string;
}

export async function createAuthenticatedUser(
  sqlite: Database.Database,
  overrides: Partial<typeof SEED_USERS.rider> = {},
): Promise<AuthCookies & { user: typeof SEED_USERS.rider }> {
  const user = { ...SEED_USERS.rider, ...overrides };

  // Check if user already exists
  const existing = sqlite.prepare('SELECT id FROM users WHERE id = ?').get(user.id);
  if (!existing) {
    const hash = await bcrypt.hash(user.password, 10);
    sqlite
      .prepare('INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(user.id, user.email, user.name, hash, user.role);
  }

  const accessToken = generateAccessToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id);

  // Store refresh token in DB
  sqlite
    .prepare('INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)')
    .run(
      `rt-${Date.now()}`,
      user.id,
      refreshToken,
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    );

  return {
    user,
    accessToken,
    refreshToken,
    cookieHeader: `access_token=${accessToken}; refresh_token=${refreshToken}`,
  };
}

// ─── Haversine Distance (for testing geospatial queries) ────

// ─── Payment Method Helpers ─────────────────────────

export function seedPaymentMethod(
  sqlite: Database.Database,
  userId: string,
  overrides: {
    id?: string;
    last4?: string;
    brand?: string;
    expiryMonth?: number;
    expiryYear?: number;
    isDefault?: boolean;
  } = {},
): { id: string } {
  const id = overrides.id ?? `pm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  sqlite
    .prepare(
      'INSERT INTO payment_methods (id, user_id, type, last4, brand, expiry_month, expiry_year, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      id,
      userId,
      'card',
      overrides.last4 ?? '4242',
      overrides.brand ?? 'Visa',
      overrides.expiryMonth ?? 12,
      overrides.expiryYear ?? 2026,
      overrides.isDefault ? 1 : 0,
    );
  return { id };
}

// ─── Haversine Distance (for testing geospatial queries) ────

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
