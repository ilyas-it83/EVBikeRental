import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── Users ──────────────────────────────────────────

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
  role: text('role', { enum: ['rider', 'admin'] }).notNull().default('rider'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Stations ───────────────────────────────────────

export const stations = sqliteTable('stations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  lat: real('lat').notNull(),
  lng: real('lng').notNull(),
  dockCapacity: integer('dock_capacity').notNull(),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Bikes ──────────────────────────────────────────

export const bikes = sqliteTable('bikes', {
  id: text('id').primaryKey(),
  serialNumber: text('serial_number').notNull().unique(),
  model: text('model').notNull(),
  stationId: text('station_id').references(() => stations.id),
  status: text('status', { enum: ['available', 'in_use', 'maintenance', 'retired'] }).notNull().default('available'),
  batteryLevel: integer('battery_level').notNull().default(100),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Rides ──────────────────────────────────────────

export const rides = sqliteTable('rides', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  bikeId: text('bike_id').notNull().references(() => bikes.id),
  startStationId: text('start_station_id').notNull().references(() => stations.id),
  endStationId: text('end_station_id').references(() => stations.id),
  startTime: text('start_time').notNull(),
  endTime: text('end_time'),
  durationMinutes: integer('duration_minutes'),
  distanceKm: real('distance_km'),
  cost: real('cost'),
  status: text('status', { enum: ['active', 'completed', 'cancelled'] }).notNull().default('active'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Payments ───────────────────────────────────────

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  rideId: text('ride_id').notNull().references(() => rides.id),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('USD'),
  status: text('status', { enum: ['pending', 'completed', 'failed', 'refunded'] }).notNull().default('pending'),
  method: text('method'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Payment Methods ────────────────────────────────

export const paymentMethods = sqliteTable('payment_methods', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  type: text('type', { enum: ['card', 'wallet'] }).notNull().default('card'),
  last4: text('last4').notNull(),
  brand: text('brand').notNull(),
  expiryMonth: integer('expiry_month').notNull(),
  expiryYear: integer('expiry_year').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Refresh Tokens ─────────────────────────────────

export const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});
