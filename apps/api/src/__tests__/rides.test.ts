/**
 * Ride Lifecycle Tests
 *
 * Tests ride API endpoints:
 * - POST /api/rides/unlock — start a ride
 * - GET /api/rides/active — current active ride
 * - POST /api/rides/:id/end — end a ride
 * - GET /api/rides — ride history (paginated)
 * - GET /api/rides/:id — ride detail
 *
 * References: Sprint 2, PRD §3.3
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
  seedPaymentMethod,
  SEED_BIKES,
  SEED_STATIONS,
  TEST_JWT_SECRET,
} from '../test/setup.js';

let sqlite: Database.Database;
let app: express.Express;

// ─── Pricing constants ──────────────────────────────

const UNLOCK_FEE = 1.0;
const PER_MINUTE_RATE = 0.15;

// ─── Auth middleware for test app ────────────────────

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

// ─── Test Express app ───────────────────────────────

function createTestApp(sqliteDb: Database.Database): express.Express {
  const testApp = express();
  testApp.use(express.json());
  testApp.use(cookieParser());
  const auth = testAuth(sqliteDb);

  // POST /api/rides/unlock — start a ride
  testApp.post('/api/rides/unlock', auth, (req, res) => {
    const user = (req as any).user;
    const { bikeId } = req.body;

    if (!bikeId) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'bikeId is required' } });
      return;
    }

    // Check bike exists
    const bike = sqliteDb.prepare('SELECT * FROM bikes WHERE id = ?').get(bikeId) as any;
    if (!bike) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Bike not found' } });
      return;
    }

    // Check bike is available
    if (bike.status !== 'available') {
      res.status(409).json({ success: false, error: { code: 'BIKE_UNAVAILABLE', message: 'Bike is not available' } });
      return;
    }

    // Check battery
    if (bike.battery_level < 15) {
      res.status(409).json({ success: false, error: { code: 'LOW_BATTERY', message: 'Bike battery too low' } });
      return;
    }

    // Check user has no active ride
    const activeRide = sqliteDb.prepare('SELECT id FROM rides WHERE user_id = ? AND status = ?').get(user.id, 'active');
    if (activeRide) {
      res.status(409).json({ success: false, error: { code: 'ACTIVE_RIDE_EXISTS', message: 'User already has an active ride' } });
      return;
    }

    // Check user has a payment method
    const paymentMethod = sqliteDb.prepare('SELECT id FROM payment_methods WHERE user_id = ?').get(user.id);
    if (!paymentMethod) {
      res.status(402).json({ success: false, error: { code: 'NO_PAYMENT_METHOD', message: 'No payment method on file' } });
      return;
    }

    // Create ride
    const rideId = `ride-${Date.now()}`;
    const startTime = new Date().toISOString();
    sqliteDb.prepare(
      'INSERT INTO rides (id, user_id, bike_id, start_station_id, start_time, status) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(rideId, user.id, bikeId, bike.station_id, startTime, 'active');

    // Update bike status
    sqliteDb.prepare('UPDATE bikes SET status = ? WHERE id = ?').run('in_use', bikeId);

    const ride = sqliteDb.prepare('SELECT * FROM rides WHERE id = ?').get(rideId);
    res.status(201).json({ success: true, data: { ride } });
  });

  // GET /api/rides/active — current active ride
  testApp.get('/api/rides/active', auth, (req, res) => {
    const user = (req as any).user;
    const ride = sqliteDb.prepare(
      'SELECT * FROM rides WHERE user_id = ? AND status = ?',
    ).get(user.id, 'active') as any;

    if (!ride) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No active ride' } });
      return;
    }
    res.json({ success: true, data: { ride } });
  });

  // POST /api/rides/:id/end — end a ride
  testApp.post('/api/rides/:id/end', auth, (req, res) => {
    const user = (req as any).user;
    const { endStationId } = req.body;

    const ride = sqliteDb.prepare('SELECT * FROM rides WHERE id = ?').get(req.params.id) as any;
    if (!ride) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ride not found' } });
      return;
    }

    if (ride.user_id !== user.id) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not your ride' } });
      return;
    }

    if (ride.status !== 'active') {
      res.status(409).json({ success: false, error: { code: 'RIDE_NOT_ACTIVE', message: 'Ride is not active' } });
      return;
    }

    const endTime = new Date().toISOString();
    const startMs = new Date(ride.start_time).getTime();
    const endMs = new Date(endTime).getTime();
    const durationMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));
    const rideCost = Math.round((UNLOCK_FEE + durationMinutes * PER_MINUTE_RATE) * 100) / 100;

    const stationId = endStationId || ride.start_station_id;

    sqliteDb.prepare(
      'UPDATE rides SET status = ?, end_time = ?, end_station_id = ?, duration_minutes = ?, cost = ? WHERE id = ?',
    ).run('completed', endTime, stationId, durationMinutes, rideCost, ride.id);

    // Update bike status back to available and set station
    sqliteDb.prepare('UPDATE bikes SET status = ?, station_id = ? WHERE id = ?').run('available', stationId, ride.bike_id);

    // Create payment record
    const paymentId = `pay-${Date.now()}`;
    sqliteDb.prepare(
      'INSERT INTO payments (id, user_id, ride_id, amount, status) VALUES (?, ?, ?, ?, ?)',
    ).run(paymentId, user.id, ride.id, rideCost, 'completed');

    const updatedRide = sqliteDb.prepare('SELECT * FROM rides WHERE id = ?').get(ride.id);
    const payment = sqliteDb.prepare('SELECT * FROM payments WHERE ride_id = ?').get(ride.id);
    res.json({ success: true, data: { ride: updatedRide, payment } });
  });

  // GET /api/rides — ride history (paginated)
  testApp.get('/api/rides', auth, (req, res) => {
    const user = (req as any).user;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const rides = sqliteDb.prepare(
      'SELECT * FROM rides WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    ).all(user.id, limit, offset);

    const totalRow = sqliteDb.prepare(
      'SELECT COUNT(*) as count FROM rides WHERE user_id = ?',
    ).get(user.id) as { count: number };

    res.json({
      success: true,
      data: {
        rides,
        pagination: { page, limit, total: totalRow.count, totalPages: Math.ceil(totalRow.count / limit) },
      },
    });
  });

  // GET /api/rides/:id — ride detail
  testApp.get('/api/rides/:id', auth, (req, res) => {
    const user = (req as any).user;
    const ride = sqliteDb.prepare('SELECT * FROM rides WHERE id = ?').get(req.params.id) as any;

    if (!ride) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ride not found' } });
      return;
    }

    if (ride.user_id !== user.id) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not your ride' } });
      return;
    }

    const startStation = sqliteDb.prepare('SELECT name FROM stations WHERE id = ?').get(ride.start_station_id) as any;
    const endStation = ride.end_station_id
      ? (sqliteDb.prepare('SELECT name FROM stations WHERE id = ?').get(ride.end_station_id) as any)
      : null;
    const payment = sqliteDb.prepare('SELECT * FROM payments WHERE ride_id = ?').get(ride.id);

    res.json({
      success: true,
      data: {
        ride: {
          ...ride,
          startStationName: startStation?.name,
          endStationName: endStation?.name,
        },
        payment: payment || null,
      },
    });
  });

  return testApp;
}

// ─── Tests ──────────────────────────────────────────

describe('POST /api/rides/unlock — start a ride', () => {
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
    // Seed a default payment method for the user
    seedPaymentMethod(sqlite, userId, { id: 'pm-default', isDefault: true });
  });

  afterEach(() => {
    sqlite.close();
  });

  it('should successfully unlock an available bike with sufficient battery', async () => {
    const res = await request(app)
      .post('/api/rides/unlock')
      .set('Cookie', cookieHeader)
      .send({ bikeId: 'bike-001' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ride).toBeDefined();
    expect(res.body.data.ride.bike_id).toBe('bike-001');
    expect(res.body.data.ride.user_id).toBe(userId);
    expect(res.body.data.ride.status).toBe('active');
    expect(res.body.data.ride.start_station_id).toBe('station-001');
  });

  it('should set bike status to in_use after unlock', async () => {
    await request(app)
      .post('/api/rides/unlock')
      .set('Cookie', cookieHeader)
      .send({ bikeId: 'bike-001' });

    const bike = sqlite.prepare('SELECT status FROM bikes WHERE id = ?').get('bike-001') as any;
    expect(bike.status).toBe('in_use');
  });

  it('should create a ride record in the database', async () => {
    await request(app)
      .post('/api/rides/unlock')
      .set('Cookie', cookieHeader)
      .send({ bikeId: 'bike-001' });

    const rides = sqlite.prepare('SELECT * FROM rides WHERE user_id = ?').all(userId) as any[];
    expect(rides).toHaveLength(1);
    expect(rides[0].status).toBe('active');
    expect(rides[0].bike_id).toBe('bike-001');
  });

  it('should fail if bike does not exist (404)', async () => {
    const res = await request(app)
      .post('/api/rides/unlock')
      .set('Cookie', cookieHeader)
      .send({ bikeId: 'bike-nonexistent' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('should fail if bike is not available — in_use (409)', async () => {
    // bike-005 has status 'rented' (equivalent to in_use)
    const res = await request(app)
      .post('/api/rides/unlock')
      .set('Cookie', cookieHeader)
      .send({ bikeId: 'bike-005' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BIKE_UNAVAILABLE');
  });

  it('should fail if bike is in maintenance (409)', async () => {
    // bike-003 has status 'maintenance'
    const res = await request(app)
      .post('/api/rides/unlock')
      .set('Cookie', cookieHeader)
      .send({ bikeId: 'bike-003' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BIKE_UNAVAILABLE');
  });

  it('should fail if bike battery < 15% (409)', async () => {
    // Insert a low-battery available bike
    sqlite.prepare(
      'INSERT INTO bikes (id, station_id, status, battery_level, model) VALUES (?, ?, ?, ?, ?)',
    ).run('bike-lowbatt', 'station-001', 'available', 10, 'EV-Standard');

    const res = await request(app)
      .post('/api/rides/unlock')
      .set('Cookie', cookieHeader)
      .send({ bikeId: 'bike-lowbatt' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LOW_BATTERY');
  });

  it('should fail if user already has an active ride (409)', async () => {
    // Start first ride
    await request(app)
      .post('/api/rides/unlock')
      .set('Cookie', cookieHeader)
      .send({ bikeId: 'bike-001' });

    // Try to start second ride
    const res = await request(app)
      .post('/api/rides/unlock')
      .set('Cookie', cookieHeader)
      .send({ bikeId: 'bike-004' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ACTIVE_RIDE_EXISTS');
  });

  it('should fail if user has no payment method (402)', async () => {
    // Remove user's payment methods
    sqlite.prepare('DELETE FROM payment_methods WHERE user_id = ?').run(userId);

    const res = await request(app)
      .post('/api/rides/unlock')
      .set('Cookie', cookieHeader)
      .send({ bikeId: 'bike-001' });

    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('NO_PAYMENT_METHOD');
  });

  it('should fail without authentication (401)', async () => {
    const res = await request(app)
      .post('/api/rides/unlock')
      .send({ bikeId: 'bike-001' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/rides/active — current active ride', () => {
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
    seedPaymentMethod(sqlite, userId, { id: 'pm-default', isDefault: true });
  });

  afterEach(() => {
    sqlite.close();
  });

  it('should return the active ride for the user', async () => {
    // Start a ride first
    await request(app)
      .post('/api/rides/unlock')
      .set('Cookie', cookieHeader)
      .send({ bikeId: 'bike-001' });

    const res = await request(app)
      .get('/api/rides/active')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ride).toBeDefined();
    expect(res.body.data.ride.status).toBe('active');
    expect(res.body.data.ride.user_id).toBe(userId);
  });

  it('should return 404 when user has no active ride', async () => {
    const res = await request(app)
      .get('/api/rides/active')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/rides/:id/end — end a ride', () => {
  let cookieHeader: string;
  let userId: string;
  let rideId: string;

  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
    const auth = await createAuthenticatedUser(sqlite);
    cookieHeader = auth.cookieHeader;
    userId = auth.user.id;
    seedPaymentMethod(sqlite, userId, { id: 'pm-default', isDefault: true });

    // Create an active ride directly in DB with a start_time slightly in the past
    rideId = 'ride-test-001';
    const startTime = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min ago
    sqlite.prepare(
      'INSERT INTO rides (id, user_id, bike_id, start_station_id, start_time, status) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(rideId, userId, 'bike-001', 'station-001', startTime, 'active');
    sqlite.prepare('UPDATE bikes SET status = ? WHERE id = ?').run('in_use', 'bike-001');
  });

  afterEach(() => {
    sqlite.close();
  });

  it('should successfully end an active ride', async () => {
    const res = await request(app)
      .post(`/api/rides/${rideId}/end`)
      .set('Cookie', cookieHeader)
      .send({ endStationId: 'station-002' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ride.status).toBe('completed');
    expect(res.body.data.ride.end_station_id).toBe('station-002');
  });

  it('should calculate duration and cost', async () => {
    const res = await request(app)
      .post(`/api/rides/${rideId}/end`)
      .set('Cookie', cookieHeader)
      .send({ endStationId: 'station-002' });

    const ride = res.body.data.ride;
    expect(ride.duration_minutes).toBeGreaterThanOrEqual(1);
    expect(ride.cost).toBeGreaterThan(0);
    // Cost should be unlock + (duration × rate)
    const expectedCost = Math.round((UNLOCK_FEE + ride.duration_minutes * PER_MINUTE_RATE) * 100) / 100;
    expect(ride.cost).toBe(expectedCost);
  });

  it('should update bike status back to available', async () => {
    await request(app)
      .post(`/api/rides/${rideId}/end`)
      .set('Cookie', cookieHeader)
      .send({ endStationId: 'station-002' });

    const bike = sqlite.prepare('SELECT status, station_id FROM bikes WHERE id = ?').get('bike-001') as any;
    expect(bike.status).toBe('available');
    expect(bike.station_id).toBe('station-002');
  });

  it('should create a payment record', async () => {
    await request(app)
      .post(`/api/rides/${rideId}/end`)
      .set('Cookie', cookieHeader)
      .send({ endStationId: 'station-002' });

    const payment = sqlite.prepare('SELECT * FROM payments WHERE ride_id = ?').get(rideId) as any;
    expect(payment).toBeDefined();
    expect(payment.user_id).toBe(userId);
    expect(payment.amount).toBeGreaterThan(0);
    expect(payment.status).toBe('completed');
  });

  it('should fail if ride does not belong to user (403)', async () => {
    // Create a second user and their auth
    const auth2 = await createAuthenticatedUser(sqlite, {
      id: 'user-other-001',
      email: 'other@test.com',
      name: 'Other User',
      role: 'rider',
      password: 'OtherPass123',
    });

    const res = await request(app)
      .post(`/api/rides/${rideId}/end`)
      .set('Cookie', auth2.cookieHeader)
      .send({ endStationId: 'station-002' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should fail if ride is not active (409)', async () => {
    // End the ride first
    await request(app)
      .post(`/api/rides/${rideId}/end`)
      .set('Cookie', cookieHeader)
      .send({ endStationId: 'station-002' });

    // Try to end again
    const res = await request(app)
      .post(`/api/rides/${rideId}/end`)
      .set('Cookie', cookieHeader)
      .send({ endStationId: 'station-002' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('RIDE_NOT_ACTIVE');
  });

  it('should fail for non-existent ride (404)', async () => {
    const res = await request(app)
      .post('/api/rides/ride-nonexistent/end')
      .set('Cookie', cookieHeader)
      .send({ endStationId: 'station-002' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/rides — ride history', () => {
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

    // Seed completed rides
    for (let i = 1; i <= 15; i++) {
      sqlite.prepare(
        'INSERT INTO rides (id, user_id, bike_id, start_station_id, end_station_id, start_time, end_time, duration_minutes, cost, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(
        `ride-hist-${i.toString().padStart(3, '0')}`,
        userId,
        'bike-001',
        'station-001',
        'station-002',
        new Date(Date.now() - (16 - i) * 3600000).toISOString(),
        new Date(Date.now() - (16 - i) * 3600000 + 600000).toISOString(),
        10,
        2.5,
        'completed',
      );
    }
  });

  afterEach(() => {
    sqlite.close();
  });

  it('should return paginated ride history', async () => {
    const res = await request(app)
      .get('/api/rides')
      .set('Cookie', cookieHeader)
      .query({ page: 1, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.rides).toHaveLength(10);
    expect(res.body.data.pagination.total).toBe(15);
    expect(res.body.data.pagination.totalPages).toBe(2);
  });

  it('should return second page of rides', async () => {
    const res = await request(app)
      .get('/api/rides')
      .set('Cookie', cookieHeader)
      .query({ page: 2, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.data.rides).toHaveLength(5);
    expect(res.body.data.pagination.page).toBe(2);
  });

  it('should not return other users rides', async () => {
    // Create a second user
    const auth2 = await createAuthenticatedUser(sqlite, {
      id: 'user-other-002',
      email: 'other2@test.com',
      name: 'Other User',
      role: 'rider',
      password: 'OtherPass123',
    });

    // Seed a ride for the other user
    sqlite.prepare(
      'INSERT INTO rides (id, user_id, bike_id, start_station_id, start_time, status) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('ride-other', 'user-other-002', 'bike-002', 'station-001', new Date().toISOString(), 'completed');

    const res = await request(app)
      .get('/api/rides')
      .set('Cookie', auth2.cookieHeader);

    // Should only have the 1 ride for other user
    expect(res.body.data.rides).toHaveLength(1);
    expect(res.body.data.rides[0].user_id).toBe('user-other-002');
  });

  it('should respect custom limit parameter', async () => {
    const res = await request(app)
      .get('/api/rides')
      .set('Cookie', cookieHeader)
      .query({ page: 1, limit: 5 });

    expect(res.body.data.rides).toHaveLength(5);
    expect(res.body.data.pagination.limit).toBe(5);
    expect(res.body.data.pagination.totalPages).toBe(3);
  });
});

describe('GET /api/rides/:id — ride detail', () => {
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

    // Seed a completed ride with payment
    sqlite.prepare(
      'INSERT INTO rides (id, user_id, bike_id, start_station_id, end_station_id, start_time, end_time, duration_minutes, cost, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run('ride-detail-001', userId, 'bike-001', 'station-001', 'station-002', '2024-01-01T10:00:00Z', '2024-01-01T10:30:00Z', 30, 5.5, 'completed');

    sqlite.prepare(
      'INSERT INTO payments (id, user_id, ride_id, amount, status) VALUES (?, ?, ?, ?, ?)',
    ).run('pay-detail-001', userId, 'ride-detail-001', 5.5, 'completed');
  });

  afterEach(() => {
    sqlite.close();
  });

  it('should return ride with station names and payment', async () => {
    const res = await request(app)
      .get('/api/rides/ride-detail-001')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ride.id).toBe('ride-detail-001');
    expect(res.body.data.ride.startStationName).toBe('Central Park Station');
    expect(res.body.data.ride.endStationName).toBe('Times Square Station');
    expect(res.body.data.payment).toBeDefined();
    expect(res.body.data.payment.amount).toBe(5.5);
  });

  it('should return 404 for non-existent ride', async () => {
    const res = await request(app)
      .get('/api/rides/ride-nonexistent')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('should return 403 for another users ride', async () => {
    const auth2 = await createAuthenticatedUser(sqlite, {
      id: 'user-other-003',
      email: 'other3@test.com',
      name: 'Other User',
      role: 'rider',
      password: 'OtherPass123',
    });

    const res = await request(app)
      .get('/api/rides/ride-detail-001')
      .set('Cookie', auth2.cookieHeader);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
