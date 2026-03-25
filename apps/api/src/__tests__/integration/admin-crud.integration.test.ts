import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

const state = vi.hoisted(() => ({ sqlite: null as any }));

vi.mock('../../db/index.js', async () => {
  const Database = (await import('better-sqlite3')).default;
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const schema = await import('../../db/schema.js');
  const { TABLE_SQL } = await import('./helpers.js');

  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(TABLE_SQL);

  state.sqlite = sqlite;
  return { db: drizzle(sqlite, { schema }) };
});

const { default: app } = (await import('../../app.js')) as { default: Express };
const { clearTables, seedUser, seedStation, seedBike, getAuthCookies } =
  await import('./helpers.js');

describe('Admin CRUD Integration', () => {
  let adminCookies: string;

  beforeEach(() => {
    clearTables(state.sqlite);
    const admin = seedUser(state.sqlite, { email: 'admin@test.com', role: 'admin' });
    adminCookies = getAuthCookies(admin.id, 'admin');
  });

  afterAll(() => state.sqlite.close());

  // ── Station CRUD ────────────────────────────────────

  it('creates a station → 201', async () => {
    const res = await request(app)
      .post('/api/admin/stations')
      .set('Cookie', adminCookies)
      .send({ name: 'New Station', address: '1 Main St', lat: 40.7, lng: -74.0, dockCapacity: 15 });

    expect(res.status).toBe(201);
    expect(res.body.station.name).toBe('New Station');
    expect(res.body.station.dockCapacity).toBe(15);
  });

  it('create station validation error → 400', async () => {
    const res = await request(app)
      .post('/api/admin/stations')
      .set('Cookie', adminCookies)
      .send({ name: '' });

    expect(res.status).toBe(400);
  });

  it('lists all stations', async () => {
    seedStation(state.sqlite, { name: 'S1' });
    seedStation(state.sqlite, { name: 'S2' });

    const res = await request(app)
      .get('/api/admin/stations')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body.stations).toHaveLength(2);
  });

  it('update station validation error → 400', async () => {
    const res = await request(app)
      .put('/api/admin/stations/any-id')
      .set('Cookie', adminCookies)
      .send({ lat: 999 }); // lat must be -90..90

    expect(res.status).toBe(400);
  });

  it('updates a station', async () => {
    const station = seedStation(state.sqlite);

    const res = await request(app)
      .put(`/api/admin/stations/${station.id}`)
      .set('Cookie', adminCookies)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.station.name).toBe('Updated Name');
  });

  it('update station not found → 404', async () => {
    const res = await request(app)
      .put('/api/admin/stations/nonexistent')
      .set('Cookie', adminCookies)
      .send({ name: 'X' });

    expect(res.status).toBe(404);
  });

  it('deletes (deactivates) a station', async () => {
    const station = seedStation(state.sqlite);

    const res = await request(app)
      .delete(`/api/admin/stations/${station.id}`)
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body.station.status).toBe('inactive');
    expect(res.body.message).toBe('Station deactivated');
  });

  it('delete station not found → 404', async () => {
    const res = await request(app)
      .delete('/api/admin/stations/nonexistent')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(404);
  });

  it('delete station with active (in_use) bikes → 400', async () => {
    const station = seedStation(state.sqlite);
    seedBike(state.sqlite, station.id, { status: 'in_use', serialNumber: 'SN-ACTIVE' });

    const res = await request(app)
      .delete(`/api/admin/stations/${station.id}`)
      .set('Cookie', adminCookies);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('active bikes');
  });

  // ── Bike CRUD ───────────────────────────────────────

  it('creates a bike → 201', async () => {
    const station = seedStation(state.sqlite);

    const res = await request(app)
      .post('/api/admin/bikes')
      .set('Cookie', adminCookies)
      .send({ serialNumber: 'SN-NEW-001', model: 'EV-Pro', stationId: station.id });

    expect(res.status).toBe(201);
    expect(res.body.bike.serialNumber).toBe('SN-NEW-001');
    expect(res.body.bike.status).toBe('available');
  });

  it('create bike with custom battery', async () => {
    const station = seedStation(state.sqlite);

    const res = await request(app)
      .post('/api/admin/bikes')
      .set('Cookie', adminCookies)
      .send({ serialNumber: 'SN-BAT', model: 'EV-X', stationId: station.id, batteryLevel: 50 });

    expect(res.status).toBe(201);
    expect(res.body.bike.batteryLevel).toBe(50);
  });

  it('create bike: station not found → 404', async () => {
    const res = await request(app)
      .post('/api/admin/bikes')
      .set('Cookie', adminCookies)
      .send({ serialNumber: 'SN-X', model: 'X', stationId: 'nonexistent' });

    expect(res.status).toBe(404);
  });

  it('create bike validation error → 400', async () => {
    const res = await request(app)
      .post('/api/admin/bikes')
      .set('Cookie', adminCookies)
      .send({});

    expect(res.status).toBe(400);
  });

  it('lists bikes with no filters', async () => {
    const station = seedStation(state.sqlite);
    seedBike(state.sqlite, station.id, { serialNumber: 'SN-1' });
    seedBike(state.sqlite, station.id, { serialNumber: 'SN-2' });

    const res = await request(app)
      .get('/api/admin/bikes')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body.bikes).toHaveLength(2);
  });

  it('update bike validation error → 400', async () => {
    const res = await request(app)
      .put('/api/admin/bikes/any-id')
      .set('Cookie', adminCookies)
      .send({ status: 'invalid_status' });

    expect(res.status).toBe(400);
  });

  it('lists bikes with station filter', async () => {
    const s1 = seedStation(state.sqlite, { id: 'sf-1', name: 'S1' });
    const s2 = seedStation(state.sqlite, { id: 'sf-2', name: 'S2' });
    seedBike(state.sqlite, s1.id, { serialNumber: 'SN-S1' });
    seedBike(state.sqlite, s2.id, { serialNumber: 'SN-S2' });

    const res = await request(app)
      .get(`/api/admin/bikes?stationId=${s1.id}`)
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body.bikes).toHaveLength(1);
  });

  it('lists bikes with status filter', async () => {
    const station = seedStation(state.sqlite);
    seedBike(state.sqlite, station.id, { serialNumber: 'SN-A', status: 'available' });
    seedBike(state.sqlite, station.id, { serialNumber: 'SN-M', status: 'maintenance' });

    const res = await request(app)
      .get('/api/admin/bikes?status=maintenance')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body.bikes).toHaveLength(1);
    expect(res.body.bikes[0].status).toBe('maintenance');
  });

  it('lists bikes with lowBattery filter', async () => {
    const station = seedStation(state.sqlite);
    seedBike(state.sqlite, station.id, { serialNumber: 'SN-HI', batteryLevel: 90 });
    seedBike(state.sqlite, station.id, { serialNumber: 'SN-LO', batteryLevel: 10 });

    const res = await request(app)
      .get('/api/admin/bikes?lowBattery=true')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body.bikes).toHaveLength(1);
    expect(res.body.bikes[0].batteryLevel).toBe(10);
  });

  it('updates a bike', async () => {
    const station = seedStation(state.sqlite);
    const bike = seedBike(state.sqlite, station.id);

    const res = await request(app)
      .put(`/api/admin/bikes/${bike.id}`)
      .set('Cookie', adminCookies)
      .send({ status: 'maintenance', batteryLevel: 50 });

    expect(res.status).toBe(200);
    expect(res.body.bike.status).toBe('maintenance');
    expect(res.body.bike.batteryLevel).toBe(50);
  });

  it('update bike not found → 404', async () => {
    const res = await request(app)
      .put('/api/admin/bikes/nonexistent')
      .set('Cookie', adminCookies)
      .send({ status: 'maintenance' });

    expect(res.status).toBe(404);
  });

  it('deletes (retires) a bike', async () => {
    const station = seedStation(state.sqlite);
    const bike = seedBike(state.sqlite, station.id);

    const res = await request(app)
      .delete(`/api/admin/bikes/${bike.id}`)
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body.bike.status).toBe('retired');
    expect(res.body.message).toBe('Bike retired');
  });

  it('delete bike not found → 404', async () => {
    const res = await request(app)
      .delete('/api/admin/bikes/nonexistent')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(404);
  });

  it('delete bike in use → 400', async () => {
    const station = seedStation(state.sqlite);
    const bike = seedBike(state.sqlite, station.id, {
      status: 'in_use',
      serialNumber: 'SN-USE',
    });

    const res = await request(app)
      .delete(`/api/admin/bikes/${bike.id}`)
      .set('Cookie', adminCookies);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('in use');
  });

  // ── User Management ─────────────────────────────────

  it('lists users with pagination', async () => {
    seedUser(state.sqlite, { email: 'u1@test.com', id: 'u1' });
    seedUser(state.sqlite, { email: 'u2@test.com', id: 'u2' });

    const res = await request(app)
      .get('/api/admin/users?page=1&limit=10')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    // admin + 2 seeded users = 3
    expect(res.body.users.length).toBeGreaterThanOrEqual(3);
    expect(res.body.total).toBeGreaterThanOrEqual(3);
    expect(res.body.page).toBe(1);
  });

  it('lists users with invalid pagination → 400', async () => {
    const res = await request(app)
      .get('/api/admin/users?page=-1')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(400);
  });

  it('updates user role', async () => {
    const user = seedUser(state.sqlite, { email: 'promote@test.com', id: 'promote-user' });

    const res = await request(app)
      .put(`/api/admin/users/${user.id}/role`)
      .set('Cookie', adminCookies)
      .send({ role: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
  });

  it('update role: user not found → 404', async () => {
    const res = await request(app)
      .put('/api/admin/users/nonexistent/role')
      .set('Cookie', adminCookies)
      .send({ role: 'admin' });

    expect(res.status).toBe(404);
  });

  it('update role validation error → 400', async () => {
    const res = await request(app)
      .put('/api/admin/users/any-id/role')
      .set('Cookie', adminCookies)
      .send({ role: 'superadmin' });

    expect(res.status).toBe(400);
  });

  it('suspends a user', async () => {
    const user = seedUser(state.sqlite, { email: 'suspend@test.com', id: 'suspend-user' });

    const res = await request(app)
      .put(`/api/admin/users/${user.id}/suspend`)
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body.user.suspended).toBe(true);
    expect(res.body.message).toBe('User suspended');
  });

  it('suspend: user not found → 404', async () => {
    const res = await request(app)
      .put('/api/admin/users/nonexistent/suspend')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(404);
  });

  // ── Fleet ───────────────────────────────────────────

  it('fleet overview returns correct stats', async () => {
    const station = seedStation(state.sqlite);
    seedBike(state.sqlite, station.id, { serialNumber: 'SN-F1', status: 'available' });
    seedBike(state.sqlite, station.id, { serialNumber: 'SN-F2', status: 'in_use' });
    seedBike(state.sqlite, station.id, { serialNumber: 'SN-F3', status: 'maintenance' });

    const res = await request(app)
      .get('/api/admin/fleet/overview')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body.overview.totalBikes).toBe(3);
    expect(res.body.overview.totalStations).toBe(1);
    expect(res.body.overview.availableBikes).toBe(1);
    expect(res.body.overview.activeBikes).toBe(1);
    expect(res.body.overview.maintenanceBikes).toBe(1);
  });

  it('fleet station details', async () => {
    const station = seedStation(state.sqlite);
    seedBike(state.sqlite, station.id, { serialNumber: 'SN-D1' });

    const res = await request(app)
      .get('/api/admin/fleet/stations')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body.stations).toHaveLength(1);
    expect(res.body.stations[0].bikes).toHaveLength(1);
    expect(res.body.stations[0].availableBikes).toBe(1);
  });

  // ── Auth guard ──────────────────────────────────────

  it('non-admin gets 403', async () => {
    const rider = seedUser(state.sqlite, { email: 'rider@test.com', id: 'rider-id' });
    const riderCookies = getAuthCookies(rider.id, 'rider');

    const res = await request(app)
      .get('/api/admin/stations')
      .set('Cookie', riderCookies);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Admin access required');
  });

  it('unauthenticated gets 401', async () => {
    const res = await request(app).get('/api/admin/stations');
    expect(res.status).toBe(401);
  });
});
