/**
 * Reservation API Tests
 *
 * Tests reservation endpoints:
 * - POST /api/reservations — create reservation
 * - DELETE /api/reservations/:id — cancel reservation
 * - GET /api/reservations/active — get active reservation
 * - Auto-expiry after 15 minutes
 * - Reserved bike access control
 *
 * References: Sprint 3, PRD §4.3
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import {
  createTestDb,
  seedTestData,
  createAuthenticatedUser,
  seedReservation,
  TEST_JWT_SECRET,
  SEED_USERS,
  SEED_BIKES,
} from '../test/setup.js';

let sqlite: Database.Database;
let app: express.Express;

// ─── Auth middleware ─────────────────────────────────

function testAuth(sqliteDb: Database.Database) {
  return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const token = req.cookies?.access_token;
    if (!token) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }
    try {
      const payload = jwt.verify(token, TEST_JWT_SECRET) as { sub: string; role: string };
      const user = sqliteDb.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(payload.sub) as any;
      if (!user) { res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not found' } }); return; }
      (req as any).user = user;
      next();
    } catch {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    }
  };
}

// Helper to auto-expire reservations
function expireReservations(sqliteDb: Database.Database) {
  const now = new Date().toISOString();
  const expired = sqliteDb.prepare(
    "SELECT * FROM reservations WHERE status = 'active' AND expires_at < ?",
  ).all(now) as any[];

  for (const res of expired) {
    sqliteDb.prepare("UPDATE reservations SET status = 'expired' WHERE id = ?").run(res.id);
    sqliteDb.prepare("UPDATE bikes SET status = 'available' WHERE id = ? AND status = 'reserved'").run(res.bike_id);
  }
}

// ─── Test Express app ───────────────────────────────

function createTestApp(sqliteDb: Database.Database): express.Express {
  const testApp = express();
  testApp.use(express.json());
  testApp.use(cookieParser());
  const auth = testAuth(sqliteDb);

  // POST /api/reservations — create reservation
  testApp.post('/api/reservations', auth, (req, res) => {
    const user = (req as any).user;
    const { bikeId, stationId } = req.body;

    // Auto-expire stale reservations
    expireReservations(sqliteDb);

    // Check for existing active reservation
    const existing = sqliteDb.prepare(
      "SELECT id FROM reservations WHERE user_id = ? AND status = 'active'",
    ).get(user.id);

    if (existing) {
      res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'You already have an active reservation' } });
      return;
    }

    // Check bike availability
    const bike = sqliteDb.prepare('SELECT * FROM bikes WHERE id = ?').get(bikeId) as any;
    if (!bike || bike.status !== 'available') {
      res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Bike is not available' } });
      return;
    }

    const id = `res-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    sqliteDb.prepare(
      'INSERT INTO reservations (id, user_id, bike_id, station_id, status, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(id, user.id, bikeId, stationId, 'active', expiresAt);

    sqliteDb.prepare("UPDATE bikes SET status = 'reserved' WHERE id = ?").run(bikeId);

    const reservation = sqliteDb.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: { reservation } });
  });

  // DELETE /api/reservations/:id — cancel reservation
  testApp.delete('/api/reservations/:id', auth, (req, res) => {
    const user = (req as any).user;
    const reservation = sqliteDb.prepare(
      "SELECT * FROM reservations WHERE id = ? AND user_id = ? AND status = 'active'",
    ).get(req.params.id, user.id) as any;

    if (!reservation) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Reservation not found' } });
      return;
    }

    sqliteDb.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?").run(req.params.id);
    sqliteDb.prepare("UPDATE bikes SET status = 'available' WHERE id = ?").run(reservation.bike_id);

    res.json({ success: true, data: { cancelled: true } });
  });

  // GET /api/reservations/active — get active reservation
  testApp.get('/api/reservations/active', auth, (req, res) => {
    const user = (req as any).user;

    // Auto-expire stale reservations
    expireReservations(sqliteDb);

    const reservation = sqliteDb.prepare(
      "SELECT * FROM reservations WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
    ).get(user.id) as any;

    res.json({ success: true, data: { reservation: reservation ?? null } });
  });

  // POST /api/rides/unlock — unlock bike (reservation aware)
  testApp.post('/api/rides/unlock', auth, (req, res) => {
    const user = (req as any).user;
    const { bikeId } = req.body;

    const bike = sqliteDb.prepare('SELECT * FROM bikes WHERE id = ?').get(bikeId) as any;
    if (!bike) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Bike not found' } });
      return;
    }

    if (bike.status === 'reserved') {
      // Check if this user has the reservation
      const reservation = sqliteDb.prepare(
        "SELECT * FROM reservations WHERE bike_id = ? AND user_id = ? AND status = 'active'",
      ).get(bikeId, user.id) as any;

      if (!reservation) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Bike is reserved by another user' } });
        return;
      }

      // User has reservation — allow unlock, complete reservation
      sqliteDb.prepare("UPDATE reservations SET status = 'completed' WHERE id = ?").run(reservation.id);
      sqliteDb.prepare("UPDATE bikes SET status = 'in_use' WHERE id = ?").run(bikeId);
      res.json({ success: true, data: { unlocked: true } });
      return;
    }

    if (bike.status !== 'available') {
      res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Bike is not available' } });
      return;
    }

    sqliteDb.prepare("UPDATE bikes SET status = 'in_use' WHERE id = ?").run(bikeId);
    res.json({ success: true, data: { unlocked: true } });
  });

  return testApp;
}

// ─── Tests ──────────────────────────────────────────

describe('POST /api/reservations — create reservation', () => {
  let cookieHeader: string;
  let userId: string;

  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
    const auth = await createAuthenticatedUser(sqlite);
    cookieHeader = auth.cookieHeader;
    userId = auth.user.id;
  });

  afterEach(() => { sqlite.close(); });

  it('should create reservation on available bike', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Cookie', cookieHeader)
      .send({ bikeId: 'bike-001', stationId: 'station-001' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reservation.bike_id).toBe('bike-001');
    expect(res.body.data.reservation.user_id).toBe(userId);
    expect(res.body.data.reservation.status).toBe('active');
    expect(res.body.data.reservation.expires_at).toBeDefined();

    // Bike should be marked as reserved
    const bike = sqlite.prepare('SELECT status FROM bikes WHERE id = ?').get('bike-001') as any;
    expect(bike.status).toBe('reserved');
  });

  it('should fail on unavailable bike', async () => {
    // bike-003 is in maintenance
    const res = await request(app)
      .post('/api/reservations')
      .set('Cookie', cookieHeader)
      .send({ bikeId: 'bike-003', stationId: 'station-001' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('should fail if user already has active reservation', async () => {
    // Create first reservation
    await request(app)
      .post('/api/reservations')
      .set('Cookie', cookieHeader)
      .send({ bikeId: 'bike-001', stationId: 'station-001' });

    // Try to create second reservation
    const res = await request(app)
      .post('/api/reservations')
      .set('Cookie', cookieHeader)
      .send({ bikeId: 'bike-002', stationId: 'station-001' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('already have an active reservation');
  });

  it('should fail on rented bike', async () => {
    // bike-005 is rented
    const res = await request(app)
      .post('/api/reservations')
      .set('Cookie', cookieHeader)
      .send({ bikeId: 'bike-005', stationId: 'station-002' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('should require authentication (401)', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .send({ bikeId: 'bike-001', stationId: 'station-001' });

    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/reservations/:id — cancel reservation', () => {
  let cookieHeader: string;
  let userId: string;

  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
    const auth = await createAuthenticatedUser(sqlite);
    cookieHeader = auth.cookieHeader;
    userId = auth.user.id;
  });

  afterEach(() => { sqlite.close(); });

  it('should cancel reservation and restore bike to available', async () => {
    const { id: resId } = seedReservation(sqlite, userId, 'bike-001', 'station-001');
    sqlite.prepare("UPDATE bikes SET status = 'reserved' WHERE id = 'bike-001'").run();

    const res = await request(app)
      .delete(`/api/reservations/${resId}`)
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.cancelled).toBe(true);

    // Bike should be back to available
    const bike = sqlite.prepare('SELECT status FROM bikes WHERE id = ?').get('bike-001') as any;
    expect(bike.status).toBe('available');

    // Reservation should be cancelled
    const reservation = sqlite.prepare('SELECT status FROM reservations WHERE id = ?').get(resId) as any;
    expect(reservation.status).toBe('cancelled');
  });

  it('should return 404 for non-existent reservation', async () => {
    const res = await request(app)
      .delete('/api/reservations/nonexistent-id')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(404);
  });

  it('should not cancel another user\'s reservation', async () => {
    // Create a reservation for another user
    const otherAuth = await createAuthenticatedUser(sqlite, {
      id: 'user-other-res',
      email: 'other-res@test.com',
      name: 'Other',
      role: 'rider',
      password: 'OtherPass123',
    });
    const { id: resId } = seedReservation(sqlite, 'user-other-res', 'bike-001', 'station-001');

    const res = await request(app)
      .delete(`/api/reservations/${resId}`)
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/reservations/active', () => {
  let cookieHeader: string;
  let userId: string;

  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
    const auth = await createAuthenticatedUser(sqlite);
    cookieHeader = auth.cookieHeader;
    userId = auth.user.id;
  });

  afterEach(() => { sqlite.close(); });

  it('should return active reservation', async () => {
    seedReservation(sqlite, userId, 'bike-001', 'station-001', 15);

    const res = await request(app)
      .get('/api/reservations/active')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.reservation).not.toBeNull();
    expect(res.body.data.reservation.bike_id).toBe('bike-001');
    expect(res.body.data.reservation.status).toBe('active');
  });

  it('should return null when no active reservation', async () => {
    const res = await request(app)
      .get('/api/reservations/active')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.reservation).toBeNull();
  });

  it('should auto-expire reservation after 15 minutes', async () => {
    // Create a reservation that expired 1 minute ago
    seedReservation(sqlite, userId, 'bike-001', 'station-001', -1);

    const res = await request(app)
      .get('/api/reservations/active')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.reservation).toBeNull();

    // Check reservation is marked expired
    const reservations = sqlite.prepare(
      "SELECT status FROM reservations WHERE user_id = ?",
    ).all(userId) as any[];
    expect(reservations[0].status).toBe('expired');
  });

  it('should require authentication (401)', async () => {
    const res = await request(app).get('/api/reservations/active');
    expect(res.status).toBe(401);
  });
});

describe('Reservation auto-expiry', () => {
  let cookieHeader: string;
  let userId: string;

  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
    const auth = await createAuthenticatedUser(sqlite);
    cookieHeader = auth.cookieHeader;
    userId = auth.user.id;
  });

  afterEach(() => { sqlite.close(); });

  it('should auto-expire and restore bike to available', async () => {
    // Create an expired reservation
    seedReservation(sqlite, userId, 'bike-001', 'station-001', -5);
    sqlite.prepare("UPDATE bikes SET status = 'reserved' WHERE id = 'bike-001'").run();

    // Accessing active reservation triggers auto-expire
    await request(app)
      .get('/api/reservations/active')
      .set('Cookie', cookieHeader);

    const bike = sqlite.prepare('SELECT status FROM bikes WHERE id = ?').get('bike-001') as any;
    expect(bike.status).toBe('available');
  });

  it('should allow new reservation after previous expires', async () => {
    // Create an expired reservation
    seedReservation(sqlite, userId, 'bike-001', 'station-001', -1);

    // Should be able to create a new reservation
    const res = await request(app)
      .post('/api/reservations')
      .set('Cookie', cookieHeader)
      .send({ bikeId: 'bike-002', stationId: 'station-001' });

    expect(res.status).toBe(201);
  });
});

describe('Reserved bike unlock access control', () => {
  let riderCookie: string;
  let riderId: string;
  let otherCookie: string;

  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);

    const riderAuth = await createAuthenticatedUser(sqlite);
    riderCookie = riderAuth.cookieHeader;
    riderId = riderAuth.user.id;

    const otherAuth = await createAuthenticatedUser(sqlite, {
      id: 'user-other-unlock',
      email: 'other-unlock@test.com',
      name: 'Other Rider',
      role: 'rider',
      password: 'OtherPass123',
    });
    otherCookie = otherAuth.cookieHeader;
  });

  afterEach(() => { sqlite.close(); });

  it('should not allow another user to unlock reserved bike', async () => {
    // Rider creates reservation
    seedReservation(sqlite, riderId, 'bike-001', 'station-001', 15);
    sqlite.prepare("UPDATE bikes SET status = 'reserved' WHERE id = 'bike-001'").run();

    // Other user tries to unlock
    const res = await request(app)
      .post('/api/rides/unlock')
      .set('Cookie', otherCookie)
      .send({ bikeId: 'bike-001' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should allow reserving user to unlock reserved bike', async () => {
    // Rider creates reservation
    const { id: resId } = seedReservation(sqlite, riderId, 'bike-001', 'station-001', 15);
    sqlite.prepare("UPDATE bikes SET status = 'reserved' WHERE id = 'bike-001'").run();

    // Same user unlocks
    const res = await request(app)
      .post('/api/rides/unlock')
      .set('Cookie', riderCookie)
      .send({ bikeId: 'bike-001' });

    expect(res.status).toBe(200);
    expect(res.body.data.unlocked).toBe(true);

    // Bike should be in_use
    const bike = sqlite.prepare('SELECT status FROM bikes WHERE id = ?').get('bike-001') as any;
    expect(bike.status).toBe('in_use');

    // Reservation should be completed
    const reservation = sqlite.prepare('SELECT status FROM reservations WHERE id = ?').get(resId) as any;
    expect(reservation.status).toBe('completed');
  });
});

describe('One active reservation per user limit', () => {
  let cookieHeader: string;
  let userId: string;

  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
    const auth = await createAuthenticatedUser(sqlite);
    cookieHeader = auth.cookieHeader;
    userId = auth.user.id;
  });

  afterEach(() => { sqlite.close(); });

  it('should enforce one active reservation per user', async () => {
    // Create first reservation
    const first = await request(app)
      .post('/api/reservations')
      .set('Cookie', cookieHeader)
      .send({ bikeId: 'bike-001', stationId: 'station-001' });

    expect(first.status).toBe(201);

    // Second reservation should fail
    const second = await request(app)
      .post('/api/reservations')
      .set('Cookie', cookieHeader)
      .send({ bikeId: 'bike-002', stationId: 'station-001' });

    expect(second.status).toBe(409);
    expect(second.body.error.message).toContain('already have an active reservation');
  });
});
