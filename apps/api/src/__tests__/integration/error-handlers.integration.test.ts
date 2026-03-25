/**
 * Tests that trigger the generic 500 error handlers in every route file.
 * Each route handler has: catch(err) { if (err.status) { ... } else { console.error; res.status(500) } }
 * This file covers the else branches by making service calls throw plain Errors.
 */
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

// Import service modules for spying
const authService = await import('../../services/auth.service.js');
const rideService = await import('../../services/ride.service.js');
const adminService = await import('../../services/admin.service.js');
const fleetService = await import('../../services/fleet.service.js');
const stationService = await import('../../services/station.service.js');
const subscriptionService = await import('../../services/subscription.service.js');
const reservationService = await import('../../services/reservation.service.js');

describe('Route 500 Error Handlers', () => {
  let riderCookies: string;
  let adminCookies: string;

  beforeEach(() => {
    clearTables(state.sqlite);
    vi.restoreAllMocks();
    const rider = seedUser(state.sqlite, { email: 'rider@test.com', id: 'rider-id' });
    const admin = seedUser(state.sqlite, { email: 'admin@test.com', id: 'admin-id', role: 'admin' });
    riderCookies = getAuthCookies(rider.id);
    adminCookies = getAuthCookies(admin.id, 'admin');
  });

  afterAll(() => state.sqlite.close());

  // ── Auth routes 500s ────────────────────────────────

  it('POST /register → 500 on unexpected error', async () => {
    vi.spyOn(authService, 'register').mockRejectedValueOnce(new Error('boom'));
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'x@x.com', password: 'Password1', name: 'X' });
    expect(res.status).toBe(500);
  });

  it('POST /login → 500 on unexpected error', async () => {
    vi.spyOn(authService, 'login').mockRejectedValueOnce(new Error('boom'));
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'x@x.com', password: 'Password1' });
    expect(res.status).toBe(500);
  });

  it('POST /refresh → 500 on unexpected error', async () => {
    vi.spyOn(authService, 'refresh').mockRejectedValueOnce(new Error('boom'));
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'refresh_token=some-token');
    expect(res.status).toBe(500);
  });

  it('POST /logout → 500 on unexpected error', async () => {
    vi.spyOn(authService, 'logout').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', 'refresh_token=some-token');
    expect(res.status).toBe(500);
  });

  // ── Station routes 500s ─────────────────────────────

  it('GET /stations → 500', async () => {
    vi.spyOn(stationService, 'listStations').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app).get('/api/stations');
    expect(res.status).toBe(500);
  });

  it('GET /stations/:id → 500', async () => {
    vi.spyOn(stationService, 'getStationById').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app).get('/api/stations/any-id');
    expect(res.status).toBe(500);
  });

  // ── Ride routes 500s ────────────────────────────────

  it('POST /rides/unlock → 500', async () => {
    vi.spyOn(rideService, 'startRide').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .post('/api/rides/unlock')
      .set('Cookie', riderCookies)
      .send({ bikeId: 'b', stationId: 's' });
    expect(res.status).toBe(500);
  });

  it('GET /rides/active → 500', async () => {
    vi.spyOn(rideService, 'getActiveRide').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .get('/api/rides/active')
      .set('Cookie', riderCookies);
    expect(res.status).toBe(500);
  });

  it('POST /rides/:id/end → 500', async () => {
    vi.spyOn(rideService, 'endRide').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .post('/api/rides/some-id/end')
      .set('Cookie', riderCookies)
      .send({ endStationId: 's' });
    expect(res.status).toBe(500);
  });

  it('GET /rides → 500', async () => {
    vi.spyOn(rideService, 'getRideHistory').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .get('/api/rides')
      .set('Cookie', riderCookies);
    expect(res.status).toBe(500);
  });

  it('GET /rides/:id → 500', async () => {
    vi.spyOn(rideService, 'getRideById').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .get('/api/rides/some-id')
      .set('Cookie', riderCookies);
    expect(res.status).toBe(500);
  });

  // (payment-methods 500 errors handled above via DB table manipulation)

  it('POST /payment-methods → 500 on db error', async () => {
    // Temporarily rename the table to cause a DB error
    state.sqlite.exec('ALTER TABLE payment_methods RENAME TO payment_methods_bak');
    const res = await request(app)
      .post('/api/payment-methods')
      .set('Cookie', riderCookies)
      .send({ last4: '4242', brand: 'Visa', expiryMonth: 12, expiryYear: 2026 });
    expect(res.status).toBe(500);
    state.sqlite.exec('ALTER TABLE payment_methods_bak RENAME TO payment_methods');
  });

  it('GET /payment-methods → 500 on db error', async () => {
    state.sqlite.exec('ALTER TABLE payment_methods RENAME TO payment_methods_bak');
    const res = await request(app)
      .get('/api/payment-methods')
      .set('Cookie', riderCookies);
    expect(res.status).toBe(500);
    state.sqlite.exec('ALTER TABLE payment_methods_bak RENAME TO payment_methods');
  });

  it('DELETE /payment-methods/:id → 500 on db error', async () => {
    state.sqlite.exec('ALTER TABLE payment_methods RENAME TO payment_methods_bak');
    const res = await request(app)
      .delete('/api/payment-methods/any-id')
      .set('Cookie', riderCookies);
    expect(res.status).toBe(500);
    state.sqlite.exec('ALTER TABLE payment_methods_bak RENAME TO payment_methods');
  });

  it('PUT /payment-methods/:id/default → 500 on db error', async () => {
    state.sqlite.exec('ALTER TABLE payment_methods RENAME TO payment_methods_bak');
    const res = await request(app)
      .put('/api/payment-methods/any-id/default')
      .set('Cookie', riderCookies);
    expect(res.status).toBe(500);
    state.sqlite.exec('ALTER TABLE payment_methods_bak RENAME TO payment_methods');
  });

  // ── Admin routes 500s ───────────────────────────────

  it('GET /admin/stations → 500', async () => {
    vi.spyOn(adminService, 'listAllStations').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .get('/api/admin/stations')
      .set('Cookie', adminCookies);
    expect(res.status).toBe(500);
  });

  it('POST /admin/stations → 500', async () => {
    vi.spyOn(adminService, 'createStation').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .post('/api/admin/stations')
      .set('Cookie', adminCookies)
      .send({ name: 'X', address: 'X', lat: 40, lng: -74, dockCapacity: 10 });
    expect(res.status).toBe(500);
  });

  it('PUT /admin/stations/:id → 500', async () => {
    vi.spyOn(adminService, 'updateStation').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .put('/api/admin/stations/any-id')
      .set('Cookie', adminCookies)
      .send({ name: 'X' });
    expect(res.status).toBe(500);
  });

  it('DELETE /admin/stations/:id → 500', async () => {
    vi.spyOn(adminService, 'deleteStation').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .delete('/api/admin/stations/any-id')
      .set('Cookie', adminCookies);
    expect(res.status).toBe(500);
  });

  it('GET /admin/bikes → 500', async () => {
    vi.spyOn(adminService, 'listAllBikes').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .get('/api/admin/bikes')
      .set('Cookie', adminCookies);
    expect(res.status).toBe(500);
  });

  it('POST /admin/bikes → 500', async () => {
    vi.spyOn(adminService, 'createBike').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .post('/api/admin/bikes')
      .set('Cookie', adminCookies)
      .send({ serialNumber: 'X', model: 'X', stationId: 'X' });
    expect(res.status).toBe(500);
  });

  it('PUT /admin/bikes/:id → 500', async () => {
    vi.spyOn(adminService, 'updateBike').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .put('/api/admin/bikes/any-id')
      .set('Cookie', adminCookies)
      .send({ status: 'maintenance' });
    expect(res.status).toBe(500);
  });

  it('DELETE /admin/bikes/:id → 500', async () => {
    vi.spyOn(adminService, 'deleteBike').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .delete('/api/admin/bikes/any-id')
      .set('Cookie', adminCookies);
    expect(res.status).toBe(500);
  });

  it('GET /admin/users → 500', async () => {
    vi.spyOn(adminService, 'listUsers').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .get('/api/admin/users')
      .set('Cookie', adminCookies);
    expect(res.status).toBe(500);
  });

  it('PUT /admin/users/:id/role → 500', async () => {
    vi.spyOn(adminService, 'updateUserRole').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .put('/api/admin/users/any-id/role')
      .set('Cookie', adminCookies)
      .send({ role: 'admin' });
    expect(res.status).toBe(500);
  });

  it('PUT /admin/users/:id/suspend → 500', async () => {
    vi.spyOn(adminService, 'suspendUser').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .put('/api/admin/users/any-id/suspend')
      .set('Cookie', adminCookies);
    expect(res.status).toBe(500);
  });

  it('GET /admin/fleet/overview → 500', async () => {
    vi.spyOn(fleetService, 'getFleetOverview').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .get('/api/admin/fleet/overview')
      .set('Cookie', adminCookies);
    expect(res.status).toBe(500);
  });

  it('GET /admin/fleet/stations → 500', async () => {
    vi.spyOn(fleetService, 'getStationDetails').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .get('/api/admin/fleet/stations')
      .set('Cookie', adminCookies);
    expect(res.status).toBe(500);
  });

  // ── Subscription routes 500s ────────────────────────

  it('POST /subscriptions/subscribe → 500', async () => {
    vi.spyOn(subscriptionService, 'subscribe').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .post('/api/subscriptions/subscribe')
      .set('Cookie', riderCookies)
      .send({ plan: 'monthly' });
    expect(res.status).toBe(500);
  });

  it('DELETE /subscriptions/cancel → 500', async () => {
    vi.spyOn(subscriptionService, 'cancelSubscription').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .delete('/api/subscriptions/cancel')
      .set('Cookie', riderCookies);
    expect(res.status).toBe(500);
  });

  it('GET /subscriptions/current → 500', async () => {
    vi.spyOn(subscriptionService, 'getCurrentSubscription').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .get('/api/subscriptions/current')
      .set('Cookie', riderCookies);
    expect(res.status).toBe(500);
  });

  it('GET /subscriptions/plans → 500', async () => {
    vi.spyOn(subscriptionService, 'getPlans').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .get('/api/subscriptions/plans')
      .set('Cookie', riderCookies);
    expect(res.status).toBe(500);
  });

  // ── Reservation routes 500s ─────────────────────────

  it('POST /reservations → 500', async () => {
    vi.spyOn(reservationService, 'reserveBike').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .post('/api/reservations')
      .set('Cookie', riderCookies)
      .send({ bikeId: 'b', stationId: 's' });
    expect(res.status).toBe(500);
  });

  it('DELETE /reservations/:id → 500', async () => {
    vi.spyOn(reservationService, 'cancelReservation').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .delete('/api/reservations/any-id')
      .set('Cookie', riderCookies);
    expect(res.status).toBe(500);
  });

  it('GET /reservations/active → 500', async () => {
    vi.spyOn(reservationService, 'getActiveReservation').mockImplementationOnce(() => { throw new Error('boom'); });
    const res = await request(app)
      .get('/api/reservations/active')
      .set('Cookie', riderCookies);
    expect(res.status).toBe(500);
  });
});
