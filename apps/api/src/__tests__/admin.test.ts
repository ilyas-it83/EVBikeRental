/**
 * Admin API Tests
 *
 * Tests admin endpoints:
 * - RBAC: 403 for non-admin, 401 without auth
 * - Station CRUD: create, update, delete, list
 * - Bike CRUD: create, update status/station, delete, list with filters
 * - User management: list, role update, suspend
 * - Fleet overview: counts and revenue
 *
 * References: Sprint 3, PRD §4.1
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
  generateAccessToken,
  TEST_JWT_SECRET,
  SEED_USERS,
  SEED_STATIONS,
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

function requireAdmin(sqliteDb: Database.Database) {
  const auth = testAuth(sqliteDb);
  return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    auth(req, res, () => {
      if ((req as any).user?.role !== 'admin') {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
        return;
      }
      next();
    });
  };
}

// ─── Test Express app ───────────────────────────────

function createTestApp(sqliteDb: Database.Database): express.Express {
  const testApp = express();
  testApp.use(express.json());
  testApp.use(cookieParser());
  const admin = requireAdmin(sqliteDb);

  // ── Station CRUD ──

  testApp.get('/api/admin/stations', admin, (req, res) => {
    const stations = sqliteDb.prepare('SELECT * FROM stations').all();
    res.json({ success: true, data: { stations } });
  });

  testApp.post('/api/admin/stations', admin, (req, res) => {
    const { name, latitude, longitude, address, capacity } = req.body;
    if (!name || latitude == null || longitude == null || !address) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } });
      return;
    }
    const id = `station-${Date.now()}`;
    sqliteDb.prepare(
      'INSERT INTO stations (id, name, latitude, longitude, address, capacity, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(id, name, latitude, longitude, address, capacity ?? 10, 'active');
    const station = sqliteDb.prepare('SELECT * FROM stations WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: { station } });
  });

  testApp.put('/api/admin/stations/:id', admin, (req, res) => {
    const existing = sqliteDb.prepare('SELECT * FROM stations WHERE id = ?').get(req.params.id) as any;
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Station not found' } });
      return;
    }
    const { name, latitude, longitude, address, capacity } = req.body;
    sqliteDb.prepare(
      'UPDATE stations SET name = COALESCE(?, name), latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude), address = COALESCE(?, address), capacity = COALESCE(?, capacity) WHERE id = ?',
    ).run(name ?? null, latitude ?? null, longitude ?? null, address ?? null, capacity ?? null, req.params.id);
    const updated = sqliteDb.prepare('SELECT * FROM stations WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: { station: updated } });
  });

  testApp.delete('/api/admin/stations/:id', admin, (req, res) => {
    const inUse = sqliteDb.prepare(
      "SELECT COUNT(*) as count FROM bikes WHERE station_id = ? AND status = 'in_use'",
    ).get(req.params.id) as { count: number };
    if (inUse.count > 0) {
      res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Station has bikes in use' } });
      return;
    }
    sqliteDb.prepare("UPDATE stations SET status = 'inactive' WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { deactivated: true } });
  });

  // ── Bike CRUD ──

  testApp.get('/api/admin/bikes', admin, (req, res) => {
    let query = 'SELECT * FROM bikes WHERE 1=1';
    const params: any[] = [];
    if (req.query.stationId) { query += ' AND station_id = ?'; params.push(req.query.stationId); }
    if (req.query.status) { query += ' AND status = ?'; params.push(req.query.status); }
    if (req.query.lowBattery === 'true') { query += ' AND battery_level < 20'; }
    const bikes = sqliteDb.prepare(query).all(...params);
    res.json({ success: true, data: { bikes } });
  });

  testApp.post('/api/admin/bikes', admin, (req, res) => {
    const { stationId, model, batteryLevel } = req.body;
    if (stationId) {
      const station = sqliteDb.prepare('SELECT id FROM stations WHERE id = ?').get(stationId);
      if (!station) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid stationId' } });
        return;
      }
    }
    const id = `bike-${Date.now()}`;
    sqliteDb.prepare(
      'INSERT INTO bikes (id, station_id, status, battery_level, model) VALUES (?, ?, ?, ?, ?)',
    ).run(id, stationId ?? null, 'available', batteryLevel ?? 100, model ?? 'EV-Standard');
    const bike = sqliteDb.prepare('SELECT * FROM bikes WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: { bike } });
  });

  testApp.put('/api/admin/bikes/:id', admin, (req, res) => {
    const existing = sqliteDb.prepare('SELECT * FROM bikes WHERE id = ?').get(req.params.id) as any;
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Bike not found' } });
      return;
    }
    const { status, stationId, batteryLevel } = req.body;
    sqliteDb.prepare(
      'UPDATE bikes SET status = COALESCE(?, status), station_id = COALESCE(?, station_id), battery_level = COALESCE(?, battery_level) WHERE id = ?',
    ).run(status ?? null, stationId ?? null, batteryLevel ?? null, req.params.id);
    const updated = sqliteDb.prepare('SELECT * FROM bikes WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: { bike: updated } });
  });

  testApp.delete('/api/admin/bikes/:id', admin, (req, res) => {
    const bike = sqliteDb.prepare('SELECT * FROM bikes WHERE id = ?').get(req.params.id) as any;
    if (!bike) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Bike not found' } });
      return;
    }
    if (bike.status === 'in_use') {
      res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Bike is currently in use' } });
      return;
    }
    sqliteDb.prepare("UPDATE bikes SET status = 'retired' WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { retired: true } });
  });

  // ── User Management ──

  testApp.get('/api/admin/users', admin, (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const total = (sqliteDb.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
    const users = sqliteDb.prepare('SELECT id, email, name, role, created_at FROM users LIMIT ? OFFSET ?').all(limit, offset);
    res.json({ success: true, data: { users, total, page, limit } });
  });

  testApp.put('/api/admin/users/:id/role', admin, (req, res) => {
    const { role } = req.body;
    if (!['rider', 'admin'].includes(role)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid role' } });
      return;
    }
    const user = sqliteDb.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as any;
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }
    sqliteDb.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
    const updated = sqliteDb.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: { user: updated } });
  });

  testApp.put('/api/admin/users/:id/suspend', admin, (req, res) => {
    const user = sqliteDb.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as any;
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }
    sqliteDb.prepare("UPDATE users SET role = 'suspended' WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { suspended: true } });
  });

  // ── Fleet Overview ──

  testApp.get('/api/admin/fleet', admin, (req, res) => {
    const totalBikes = (sqliteDb.prepare('SELECT COUNT(*) as count FROM bikes').get() as { count: number }).count;
    const activeBikes = (sqliteDb.prepare("SELECT COUNT(*) as count FROM bikes WHERE status = 'available'").get() as { count: number }).count;
    const inUseBikes = (sqliteDb.prepare("SELECT COUNT(*) as count FROM bikes WHERE status = 'in_use'").get() as { count: number }).count;
    const maintenanceBikes = (sqliteDb.prepare("SELECT COUNT(*) as count FROM bikes WHERE status = 'maintenance'").get() as { count: number }).count;

    const today = new Date().toISOString().split('T')[0];
    const revenueRow = sqliteDb.prepare(
      "SELECT COALESCE(SUM(cost), 0) as revenue FROM rides WHERE status = 'completed' AND start_time >= ?",
    ).get(today) as { revenue: number };

    res.json({
      success: true,
      data: {
        fleet: {
          totalBikes,
          activeBikes,
          inUseBikes,
          maintenanceBikes,
          revenueToday: revenueRow.revenue,
        },
      },
    });
  });

  return testApp;
}

// ─── Tests ──────────────────────────────────────────

describe('Admin RBAC', () => {
  let adminCookie: string;
  let riderCookie: string;

  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
    // Use generateAccessToken directly to avoid refresh token ID collision
    const adminToken = generateAccessToken(SEED_USERS.admin.id, 'admin');
    adminCookie = `access_token=${adminToken}`;
    const riderToken = generateAccessToken(SEED_USERS.rider.id, 'rider');
    riderCookie = `access_token=${riderToken}`;
  });

  afterEach(() => { sqlite.close(); });

  it('should return 403 for non-admin user on all admin endpoints', async () => {
    const endpoints = [
      { method: 'get', url: '/api/admin/stations' },
      { method: 'post', url: '/api/admin/stations' },
      { method: 'get', url: '/api/admin/bikes' },
      { method: 'get', url: '/api/admin/users' },
      { method: 'get', url: '/api/admin/fleet' },
    ];

    for (const ep of endpoints) {
      const res = await (request(app) as any)[ep.method](ep.url).set('Cookie', riderCookie);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
  });

  it('should return 401 without authentication on all admin endpoints', async () => {
    const endpoints = [
      { method: 'get', url: '/api/admin/stations' },
      { method: 'post', url: '/api/admin/stations' },
      { method: 'get', url: '/api/admin/bikes' },
      { method: 'get', url: '/api/admin/users' },
      { method: 'get', url: '/api/admin/fleet' },
    ];

    for (const ep of endpoints) {
      const res = await (request(app) as any)[ep.method](ep.url);
      expect(res.status).toBe(401);
    }
  });
});

describe('Admin Station CRUD', () => {
  let adminCookie: string;

  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
    const auth = await createAuthenticatedUser(sqlite, {
      id: SEED_USERS.admin.id,
      email: SEED_USERS.admin.email,
      name: SEED_USERS.admin.name,
      role: 'admin',
      password: SEED_USERS.admin.password,
    });
    adminCookie = auth.cookieHeader;
  });

  afterEach(() => { sqlite.close(); });

  it('should create a station with valid data', async () => {
    const res = await request(app)
      .post('/api/admin/stations')
      .set('Cookie', adminCookie)
      .send({ name: 'New Station', latitude: 40.73, longitude: -73.99, address: '123 Test St', capacity: 25 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.station.name).toBe('New Station');
    expect(res.body.data.station.capacity).toBe(25);
  });

  it('should fail creating station with missing fields', async () => {
    const res = await request(app)
      .post('/api/admin/stations')
      .set('Cookie', adminCookie)
      .send({ name: 'Incomplete Station' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should update station', async () => {
    const res = await request(app)
      .put('/api/admin/stations/station-001')
      .set('Cookie', adminCookie)
      .send({ name: 'Updated Central Park', capacity: 30 });

    expect(res.status).toBe(200);
    expect(res.body.data.station.name).toBe('Updated Central Park');
    expect(res.body.data.station.capacity).toBe(30);
  });

  it('should deactivate station', async () => {
    const res = await request(app)
      .delete('/api/admin/stations/station-003')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.deactivated).toBe(true);

    const station = sqlite.prepare('SELECT status FROM stations WHERE id = ?').get('station-003') as any;
    expect(station.status).toBe('inactive');
  });

  it('should fail deleting station with bikes in_use', async () => {
    // Set a bike at station-001 to in_use
    sqlite.prepare("UPDATE bikes SET status = 'in_use' WHERE id = 'bike-001'").run();

    const res = await request(app)
      .delete('/api/admin/stations/station-001')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('should list all stations including inactive', async () => {
    // Deactivate one station
    sqlite.prepare("UPDATE stations SET status = 'inactive' WHERE id = 'station-003'").run();

    const res = await request(app)
      .get('/api/admin/stations')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.stations).toHaveLength(3);
    const inactive = res.body.data.stations.find((s: any) => s.id === 'station-003');
    expect(inactive.status).toBe('inactive');
  });
});

describe('Admin Bike CRUD', () => {
  let adminCookie: string;

  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
    const auth = await createAuthenticatedUser(sqlite, {
      id: SEED_USERS.admin.id,
      email: SEED_USERS.admin.email,
      name: SEED_USERS.admin.name,
      role: 'admin',
      password: SEED_USERS.admin.password,
    });
    adminCookie = auth.cookieHeader;
  });

  afterEach(() => { sqlite.close(); });

  it('should create a bike with valid data', async () => {
    const res = await request(app)
      .post('/api/admin/bikes')
      .set('Cookie', adminCookie)
      .send({ stationId: 'station-001', model: 'EV-Premium', batteryLevel: 100 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.bike.model).toBe('EV-Premium');
    expect(res.body.data.bike.station_id).toBe('station-001');
    expect(res.body.data.bike.status).toBe('available');
  });

  it('should fail creating bike with invalid stationId', async () => {
    const res = await request(app)
      .post('/api/admin/bikes')
      .set('Cookie', adminCookie)
      .send({ stationId: 'nonexistent-station', model: 'EV-Pro' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should update bike status', async () => {
    const res = await request(app)
      .put('/api/admin/bikes/bike-003')
      .set('Cookie', adminCookie)
      .send({ status: 'available' });

    expect(res.status).toBe(200);
    expect(res.body.data.bike.status).toBe('available');
  });

  it('should update bike station assignment', async () => {
    const res = await request(app)
      .put('/api/admin/bikes/bike-001')
      .set('Cookie', adminCookie)
      .send({ stationId: 'station-002' });

    expect(res.status).toBe(200);
    expect(res.body.data.bike.station_id).toBe('station-002');
  });

  it('should retire bike', async () => {
    const res = await request(app)
      .delete('/api/admin/bikes/bike-003')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.retired).toBe(true);

    const bike = sqlite.prepare('SELECT status FROM bikes WHERE id = ?').get('bike-003') as any;
    expect(bike.status).toBe('retired');
  });

  it('should fail deleting bike that is in_use', async () => {
    sqlite.prepare("UPDATE bikes SET status = 'in_use' WHERE id = 'bike-001'").run();

    const res = await request(app)
      .delete('/api/admin/bikes/bike-001')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('should list bikes with stationId filter', async () => {
    const res = await request(app)
      .get('/api/admin/bikes')
      .query({ stationId: 'station-001' })
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    for (const bike of res.body.data.bikes) {
      expect(bike.station_id).toBe('station-001');
    }
    expect(res.body.data.bikes.length).toBe(3);
  });

  it('should list bikes with status filter', async () => {
    const res = await request(app)
      .get('/api/admin/bikes')
      .query({ status: 'available' })
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    for (const bike of res.body.data.bikes) {
      expect(bike.status).toBe('available');
    }
  });

  it('should list bikes with lowBattery filter', async () => {
    const res = await request(app)
      .get('/api/admin/bikes')
      .query({ lowBattery: 'true' })
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    for (const bike of res.body.data.bikes) {
      expect(bike.battery_level).toBeLessThan(20);
    }
    // bike-003 has battery 10
    expect(res.body.data.bikes.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Admin User Management', () => {
  let adminCookie: string;

  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
    const auth = await createAuthenticatedUser(sqlite, {
      id: SEED_USERS.admin.id,
      email: SEED_USERS.admin.email,
      name: SEED_USERS.admin.name,
      role: 'admin',
      password: SEED_USERS.admin.password,
    });
    adminCookie = auth.cookieHeader;
  });

  afterEach(() => { sqlite.close(); });

  it('should list users with pagination', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .query({ page: 1, limit: 10 })
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.users).toBeDefined();
    expect(res.body.data.total).toBeGreaterThanOrEqual(2);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.limit).toBe(10);
  });

  it('should update user role from rider to admin', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${SEED_USERS.rider.id}/role`)
      .set('Cookie', adminCookie)
      .send({ role: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('admin');
  });

  it('should update user role from admin to rider', async () => {
    // Create another admin
    await createAuthenticatedUser(sqlite, {
      id: 'user-admin-002',
      email: 'admin2@test.com',
      name: 'Admin Two',
      role: 'admin',
      password: 'Admin2Pass',
    });

    const res = await request(app)
      .put('/api/admin/users/user-admin-002/role')
      .set('Cookie', adminCookie)
      .send({ role: 'rider' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('rider');
  });

  it('should suspend user', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${SEED_USERS.rider.id}/suspend`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.suspended).toBe(true);

    const user = sqlite.prepare('SELECT role FROM users WHERE id = ?').get(SEED_USERS.rider.id) as any;
    expect(user.role).toBe('suspended');
  });
});

describe('Admin Fleet Overview', () => {
  let adminCookie: string;

  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
    const auth = await createAuthenticatedUser(sqlite, {
      id: SEED_USERS.admin.id,
      email: SEED_USERS.admin.email,
      name: SEED_USERS.admin.name,
      role: 'admin',
      password: SEED_USERS.admin.password,
    });
    adminCookie = auth.cookieHeader;
  });

  afterEach(() => { sqlite.close(); });

  it('should return correct fleet counts', async () => {
    const res = await request(app)
      .get('/api/admin/fleet')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    const fleet = res.body.data.fleet;
    expect(fleet.totalBikes).toBe(6);
    expect(fleet.activeBikes).toBe(4); // 4 available
    expect(fleet.maintenanceBikes).toBe(1); // bike-003
    expect(typeof fleet.revenueToday).toBe('number');
  });

  it('should calculate revenue from today\'s completed rides only', async () => {
    const today = new Date().toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Add a completed ride today
    sqlite.prepare(
      "INSERT INTO rides (id, user_id, bike_id, start_station_id, start_time, end_time, cost, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')",
    ).run('ride-today-1', SEED_USERS.rider.id, 'bike-001', 'station-001', today, today, 5.50);

    // Add a completed ride yesterday (should NOT count)
    sqlite.prepare(
      "INSERT INTO rides (id, user_id, bike_id, start_station_id, start_time, end_time, cost, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')",
    ).run('ride-yesterday-1', SEED_USERS.rider.id, 'bike-002', 'station-001', yesterday, yesterday, 10.00);

    // Add an active ride today (should NOT count)
    sqlite.prepare(
      "INSERT INTO rides (id, user_id, bike_id, start_station_id, start_time, status) VALUES (?, ?, ?, ?, ?, 'active')",
    ).run('ride-active-1', SEED_USERS.rider.id, 'bike-004', 'station-002', today);

    const res = await request(app)
      .get('/api/admin/fleet')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.fleet.revenueToday).toBe(5.50);
  });
});
