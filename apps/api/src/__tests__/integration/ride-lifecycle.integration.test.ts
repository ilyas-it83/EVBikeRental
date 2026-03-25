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
const {
  clearTables,
  seedUser,
  seedStation,
  seedBike,
  seedPaymentMethod,
  seedRide,
  getAuthCookies,
} = await import('./helpers.js');

describe('Ride Lifecycle Integration', () => {
  beforeEach(() => clearTables(state.sqlite));
  afterAll(() => state.sqlite.close());

  function setupRideScenario() {
    const user = seedUser(state.sqlite, { email: 'rider@test.com' });
    const station1 = seedStation(state.sqlite, { name: 'Start Station', id: 'station-1' });
    const station2 = seedStation(state.sqlite, {
      name: 'End Station',
      id: 'station-2',
      lat: 40.72,
      lng: -74.01,
    });
    const bike = seedBike(state.sqlite, station1.id, { id: 'bike-1', batteryLevel: 90 });
    seedPaymentMethod(state.sqlite, user.id, { isDefault: true });
    const cookies = getAuthCookies(user.id);
    return { user, station1, station2, bike, cookies };
  }

  // ── Full lifecycle ──────────────────────────────────

  it('unlock → active → end → history (full flow)', async () => {
    const { user, station1, station2, bike, cookies } = setupRideScenario();

    // Unlock bike
    const unlock = await request(app)
      .post('/api/rides/unlock')
      .set('Cookie', cookies)
      .send({ bikeId: bike.id, stationId: station1.id });

    expect(unlock.status).toBe(201);
    expect(unlock.body.ride.status).toBe('active');
    expect(unlock.body.ride.bikeId).toBe(bike.id);
    expect(unlock.body.ride.startStationName).toBe('Start Station');
    const rideId = unlock.body.ride.id;

    // Check bike status changed to in_use
    const bikeRow = state.sqlite
      .prepare('SELECT status, station_id FROM bikes WHERE id = ?')
      .get(bike.id) as any;
    expect(bikeRow.status).toBe('in_use');
    expect(bikeRow.station_id).toBeNull();

    // Get active ride
    const active = await request(app)
      .get('/api/rides/active')
      .set('Cookie', cookies);

    expect(active.status).toBe(200);
    expect(active.body.ride).not.toBeNull();
    expect(active.body.ride.id).toBe(rideId);

    // End ride
    const end = await request(app)
      .post(`/api/rides/${rideId}/end`)
      .set('Cookie', cookies)
      .send({ endStationId: station2.id });

    expect(end.status).toBe(200);
    expect(end.body.ride.status).toBe('completed');
    expect(end.body.ride.cost).toBeGreaterThan(0);
    expect(end.body.ride.durationMinutes).toBeGreaterThanOrEqual(1);
    expect(end.body.ride.endStationName).toBe('End Station');

    // Verify payment created
    expect(end.body.ride.payment).not.toBeNull();
    expect(end.body.ride.payment.status).toBe('completed');

    // Check bike returned to station
    const bikeAfter = state.sqlite
      .prepare('SELECT status, station_id FROM bikes WHERE id = ?')
      .get(bike.id) as any;
    expect(bikeAfter.status).toBe('available');
    expect(bikeAfter.station_id).toBe(station2.id);

    // Get ride history
    const history = await request(app)
      .get('/api/rides')
      .set('Cookie', cookies);

    expect(history.status).toBe(200);
    expect(history.body.rides).toHaveLength(1);
    expect(history.body.total).toBe(1);
    expect(history.body.page).toBe(1);

    // Get ride by ID
    const detail = await request(app)
      .get(`/api/rides/${rideId}`)
      .set('Cookie', cookies);

    expect(detail.status).toBe(200);
    expect(detail.body.ride.id).toBe(rideId);
    expect(detail.body.ride.bike).not.toBeNull();
  });

  // ── Unlock failures ─────────────────────────────────

  it('unlock fails without payment method → 400', async () => {
    const user = seedUser(state.sqlite);
    const station = seedStation(state.sqlite);
    const bike = seedBike(state.sqlite, station.id);
    const cookies = getAuthCookies(user.id);

    const res = await request(app)
      .post('/api/rides/unlock')
      .set('Cookie', cookies)
      .send({ bikeId: bike.id, stationId: station.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('payment method');
  });

  it('unlock fails: bike not found → 404', async () => {
    const { cookies, station1 } = setupRideScenario();

    const res = await request(app)
      .post('/api/rides/unlock')
      .set('Cookie', cookies)
      .send({ bikeId: 'nonexistent', stationId: station1.id });

    expect(res.status).toBe(404);
  });

  it('unlock fails: bike at wrong station → 400', async () => {
    const { cookies, station2, bike } = setupRideScenario();

    const res = await request(app)
      .post('/api/rides/unlock')
      .set('Cookie', cookies)
      .send({ bikeId: bike.id, stationId: station2.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('not at this station');
  });

  it('unlock fails: bike not available → 400', async () => {
    const { cookies, station1 } = setupRideScenario();
    const maintenanceBike = seedBike(state.sqlite, station1.id, {
      id: 'maint-bike',
      serialNumber: 'SN-MAINT',
      status: 'maintenance',
    });

    const res = await request(app)
      .post('/api/rides/unlock')
      .set('Cookie', cookies)
      .send({ bikeId: maintenanceBike.id, stationId: station1.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('not available');
  });

  it('unlock fails: low battery → 400', async () => {
    const { user, station1, cookies } = setupRideScenario();
    const lowBike = seedBike(state.sqlite, station1.id, {
      id: 'low-bike',
      serialNumber: 'SN-LOW',
      batteryLevel: 10,
    });

    const res = await request(app)
      .post('/api/rides/unlock')
      .set('Cookie', cookies)
      .send({ bikeId: lowBike.id, stationId: station1.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('battery too low');
  });

  it('unlock fails: already has active ride → 400', async () => {
    const { user, station1, bike, cookies } = setupRideScenario();
    seedRide(state.sqlite, user.id, bike.id, station1.id, { status: 'active' });
    // Bike is now in a ride but let's create a second bike to try unlocking
    const bike2 = seedBike(state.sqlite, station1.id, {
      id: 'bike-2',
      serialNumber: 'SN-B2',
    });

    const res = await request(app)
      .post('/api/rides/unlock')
      .set('Cookie', cookies)
      .send({ bikeId: bike2.id, stationId: station1.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('active ride');
  });

  it('unlock fails: unauthenticated → 401', async () => {
    const res = await request(app)
      .post('/api/rides/unlock')
      .send({ bikeId: 'x', stationId: 'y' });

    expect(res.status).toBe(401);
  });

  it('unlock validation error → 400', async () => {
    const user = seedUser(state.sqlite);
    const cookies = getAuthCookies(user.id);

    const res = await request(app)
      .post('/api/rides/unlock')
      .set('Cookie', cookies)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  // ── End ride failures ───────────────────────────────

  it('end ride: not found → 404', async () => {
    const { cookies } = setupRideScenario();

    const res = await request(app)
      .post('/api/rides/nonexistent/end')
      .set('Cookie', cookies)
      .send({ endStationId: 'station-2' });

    expect(res.status).toBe(404);
  });

  it('end ride: not your ride → 403', async () => {
    const { station1, bike } = setupRideScenario();
    const otherUser = seedUser(state.sqlite, { id: 'other-user', email: 'other@test.com' });
    const ride = seedRide(state.sqlite, otherUser.id, bike.id, station1.id);

    const user = seedUser(state.sqlite, { id: 'me-user', email: 'me@test.com' });
    const cookies = getAuthCookies(user.id);

    const res = await request(app)
      .post(`/api/rides/${ride.id}/end`)
      .set('Cookie', cookies)
      .send({ endStationId: station1.id });

    expect(res.status).toBe(403);
  });

  it('end ride: not active → 400', async () => {
    const { user, station1, bike, cookies } = setupRideScenario();
    const ride = seedRide(state.sqlite, user.id, bike.id, station1.id, {
      status: 'completed',
      endTime: new Date().toISOString(),
    });

    const res = await request(app)
      .post(`/api/rides/${ride.id}/end`)
      .set('Cookie', cookies)
      .send({ endStationId: station1.id });

    expect(res.status).toBe(400);
  });

  it('end ride: end station not found → 404', async () => {
    const { user, station1, bike, cookies } = setupRideScenario();
    const ride = seedRide(state.sqlite, user.id, bike.id, station1.id);

    const res = await request(app)
      .post(`/api/rides/${ride.id}/end`)
      .set('Cookie', cookies)
      .send({ endStationId: 'nonexistent' });

    expect(res.status).toBe(404);
  });

  it('end ride validation error → 400', async () => {
    const { cookies } = setupRideScenario();

    const res = await request(app)
      .post('/api/rides/some-id/end')
      .set('Cookie', cookies)
      .send({});

    expect(res.status).toBe(400);
  });

  // ── Active ride + history ───────────────────────────

  it('get active ride returns null when none', async () => {
    const user = seedUser(state.sqlite);
    const cookies = getAuthCookies(user.id);

    const res = await request(app)
      .get('/api/rides/active')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.ride).toBeNull();
  });

  it('ride history with pagination', async () => {
    const user = seedUser(state.sqlite);
    const station = seedStation(state.sqlite);
    const bike = seedBike(state.sqlite, station.id);
    const cookies = getAuthCookies(user.id);

    // Create 3 completed rides
    for (let i = 0; i < 3; i++) {
      seedRide(state.sqlite, user.id, bike.id, station.id, {
        status: 'completed',
        startTime: new Date(Date.now() - i * 100000).toISOString(),
      });
    }

    const res = await request(app)
      .get('/api/rides?page=1&limit=2')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.rides).toHaveLength(2);
    expect(res.body.total).toBe(3);
    expect(res.body.totalPages).toBe(2);

    // Page 2
    const page2 = await request(app)
      .get('/api/rides?page=2&limit=2')
      .set('Cookie', cookies);

    expect(page2.body.rides).toHaveLength(1);
  });

  it('get ride by ID: not found → 404', async () => {
    const user = seedUser(state.sqlite);
    const cookies = getAuthCookies(user.id);

    const res = await request(app)
      .get('/api/rides/nonexistent')
      .set('Cookie', cookies);

    expect(res.status).toBe(404);
  });

  it('ride history invalid pagination → 400', async () => {
    const user = seedUser(state.sqlite);
    const cookies = getAuthCookies(user.id);

    const res = await request(app)
      .get('/api/rides?page=-1&limit=abc')
      .set('Cookie', cookies);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid query parameters');
  });

  it('get ride by ID: not your ride → 403', async () => {
    const user1 = seedUser(state.sqlite, { email: 'u1@test.com' });
    const user2 = seedUser(state.sqlite, { email: 'u2@test.com', id: 'user-2' });
    const station = seedStation(state.sqlite);
    const bike = seedBike(state.sqlite, station.id);
    const ride = seedRide(state.sqlite, user1.id, bike.id, station.id);

    const cookies = getAuthCookies(user2.id);
    const res = await request(app)
      .get(`/api/rides/${ride.id}`)
      .set('Cookie', cookies);

    expect(res.status).toBe(403);
  });
});
