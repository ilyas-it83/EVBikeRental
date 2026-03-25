import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const JWT_SECRET = 'change-me-in-production';

export const TABLE_SQL = `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'rider',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE stations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    dock_capacity INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE bikes (
    id TEXT PRIMARY KEY,
    serial_number TEXT UNIQUE NOT NULL,
    model TEXT NOT NULL,
    station_id TEXT REFERENCES stations(id),
    status TEXT NOT NULL DEFAULT 'available',
    battery_level INTEGER NOT NULL DEFAULT 100,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE rides (
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
  CREATE TABLE payments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    ride_id TEXT NOT NULL REFERENCES rides(id),
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'pending',
    method TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE payment_methods (
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
  CREATE TABLE subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    plan TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'active',
    start_date TEXT NOT NULL,
    end_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE reservations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    bike_id TEXT NOT NULL REFERENCES bikes(id),
    station_id TEXT NOT NULL REFERENCES stations(id),
    status TEXT NOT NULL DEFAULT 'active',
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

export function clearTables(sqlite: any) {
  sqlite.exec(`
    DELETE FROM payments;
    DELETE FROM rides;
    DELETE FROM reservations;
    DELETE FROM refresh_tokens;
    DELETE FROM payment_methods;
    DELETE FROM subscriptions;
    DELETE FROM bikes;
    DELETE FROM stations;
    DELETE FROM users;
  `);
}

export function seedUser(
  sqlite: any,
  overrides: Partial<{
    id: string;
    email: string;
    name: string;
    password: string;
    role: string;
    phone: string | null;
  }> = {},
) {
  const id = overrides.id ?? crypto.randomUUID();
  const email = overrides.email ?? 'test@test.com';
  const name = overrides.name ?? 'Test User';
  const password = overrides.password ?? 'Password123';
  const role = overrides.role ?? 'rider';
  const phone = overrides.phone ?? null;
  const passwordHash = bcrypt.hashSync(password, 4); // low rounds for speed

  sqlite
    .prepare(
      'INSERT INTO users (id, email, password_hash, name, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(id, email, passwordHash, name, phone, role);

  return { id, email, name, role, phone, password };
}

export function seedStation(
  sqlite: any,
  overrides: Partial<{
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    dockCapacity: number;
    status: string;
  }> = {},
) {
  const id = overrides.id ?? crypto.randomUUID();
  const name = overrides.name ?? 'Test Station';
  const address = overrides.address ?? '123 Test St';
  const lat = overrides.lat ?? 40.7128;
  const lng = overrides.lng ?? -74.006;
  const dockCapacity = overrides.dockCapacity ?? 20;
  const status = overrides.status ?? 'active';

  sqlite
    .prepare(
      'INSERT INTO stations (id, name, address, lat, lng, dock_capacity, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(id, name, address, lat, lng, dockCapacity, status);

  return { id, name, address, lat, lng, dockCapacity, status };
}

export function seedBike(
  sqlite: any,
  stationId: string,
  overrides: Partial<{
    id: string;
    serialNumber: string;
    model: string;
    status: string;
    batteryLevel: number;
  }> = {},
) {
  const id = overrides.id ?? crypto.randomUUID();
  const serialNumber = overrides.serialNumber ?? `SN-${id.slice(0, 8)}`;
  const model = overrides.model ?? 'EV-Pro';
  const status = overrides.status ?? 'available';
  const batteryLevel = overrides.batteryLevel ?? 95;

  sqlite
    .prepare(
      'INSERT INTO bikes (id, serial_number, model, station_id, status, battery_level) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(id, serialNumber, model, stationId, status, batteryLevel);

  return { id, serialNumber, model, stationId, status, batteryLevel };
}

export function seedPaymentMethod(
  sqlite: any,
  userId: string,
  overrides: Partial<{
    id: string;
    last4: string;
    brand: string;
    expiryMonth: number;
    expiryYear: number;
    isDefault: boolean;
  }> = {},
) {
  const id = overrides.id ?? crypto.randomUUID();
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

export function seedRide(
  sqlite: any,
  userId: string,
  bikeId: string,
  startStationId: string,
  overrides: Partial<{
    id: string;
    endStationId: string;
    status: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    cost: number;
  }> = {},
) {
  const id = overrides.id ?? crypto.randomUUID();
  const status = overrides.status ?? 'active';
  const startTime = overrides.startTime ?? new Date().toISOString();

  sqlite
    .prepare(
      'INSERT INTO rides (id, user_id, bike_id, start_station_id, end_station_id, start_time, end_time, duration_minutes, cost, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      id,
      userId,
      bikeId,
      startStationId,
      overrides.endStationId ?? null,
      startTime,
      overrides.endTime ?? null,
      overrides.durationMinutes ?? null,
      overrides.cost ?? null,
      status,
    );
  return { id, status, startTime };
}

export function seedRefreshToken(
  sqlite: any,
  userId: string,
  overrides: Partial<{ id: string; token: string; expiresAt: string }> = {},
) {
  const id = overrides.id ?? crypto.randomUUID();
  const token = overrides.token ?? crypto.randomBytes(64).toString('hex');
  const expiresAt =
    overrides.expiresAt ??
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  sqlite
    .prepare(
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
    )
    .run(id, userId, token, expiresAt);
  return { id, token, expiresAt };
}

export function seedSubscription(
  sqlite: any,
  userId: string,
  plan: string = 'monthly',
  overrides: Partial<{ id: string; status: string }> = {},
) {
  const id = overrides.id ?? crypto.randomUUID();
  sqlite
    .prepare(
      'INSERT INTO subscriptions (id, user_id, plan, status, start_date) VALUES (?, ?, ?, ?, ?)',
    )
    .run(id, userId, plan, overrides.status ?? 'active', new Date().toISOString());
  return { id };
}

export function getAuthCookies(userId: string, role: string = 'rider'): string {
  const token = jwt.sign({ sub: userId, role }, JWT_SECRET, { expiresIn: '15m' });
  return `access_token=${token}`;
}

export function getExpiredAuthCookies(userId: string): string {
  const token = jwt.sign({ sub: userId, role: 'rider' }, JWT_SECRET, { expiresIn: '0s' });
  return `access_token=${token}`;
}
