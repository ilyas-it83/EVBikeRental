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
const { clearTables, seedUser, seedStation, seedBike, seedPaymentMethod, getAuthCookies } =
  await import('./helpers.js');

describe('Stations & Payment Methods Integration', () => {
  beforeEach(() => clearTables(state.sqlite));
  afterAll(() => state.sqlite.close());

  // ── Public Station Endpoints ────────────────────────

  describe('GET /api/stations', () => {
    it('lists active stations', async () => {
      seedStation(state.sqlite, { name: 'Active', status: 'active' });
      seedStation(state.sqlite, { name: 'Inactive', status: 'inactive', id: 'inactive-s' });

      const res = await request(app).get('/api/stations');

      expect(res.status).toBe(200);
      // Only active stations returned
      expect(res.body.stations).toHaveLength(1);
      expect(res.body.stations[0].name).toBe('Active');
    });

    it('lists stations with bike availability counts', async () => {
      const station = seedStation(state.sqlite, { id: 'count-s', dockCapacity: 10 });
      seedBike(state.sqlite, station.id, { serialNumber: 'SN-A1', status: 'available' });
      seedBike(state.sqlite, station.id, { serialNumber: 'SN-A2', status: 'available' });
      seedBike(state.sqlite, station.id, { serialNumber: 'SN-M1', status: 'maintenance' });

      const res = await request(app).get('/api/stations');

      expect(res.status).toBe(200);
      expect(res.body.stations[0].availableBikes).toBe(2);
      expect(res.body.stations[0].emptyDocks).toBe(7); // 10 - 3 bikes
    });

    it('lists stations sorted by distance when coords provided', async () => {
      seedStation(state.sqlite, { id: 'near', name: 'Near', lat: 40.713, lng: -74.006 });
      seedStation(state.sqlite, { id: 'far', name: 'Far', lat: 41.0, lng: -74.5 });

      const res = await request(app).get('/api/stations?lat=40.7128&lng=-74.006');

      expect(res.status).toBe(200);
      expect(res.body.stations.length).toBeGreaterThanOrEqual(1);
      // Near station should be first
      if (res.body.stations.length >= 2) {
        expect(res.body.stations[0].distance).toBeLessThanOrEqual(
          res.body.stations[1].distance,
        );
      }
    });

    it('filters stations by radius', async () => {
      seedStation(state.sqlite, { id: 'close', name: 'Close', lat: 40.713, lng: -74.006 });
      seedStation(state.sqlite, {
        id: 'faraway',
        name: 'Far Away',
        lat: 50.0,
        lng: -80.0,
      });

      const res = await request(app).get('/api/stations?lat=40.7128&lng=-74.006&radius=5');

      expect(res.status).toBe(200);
      // Only nearby station should appear
      expect(res.body.stations).toHaveLength(1);
      expect(res.body.stations[0].name).toBe('Close');
    });

    it('returns all stations without coords (distance = 0)', async () => {
      seedStation(state.sqlite, { id: 's1' });
      seedStation(state.sqlite, { id: 's2' });

      const res = await request(app).get('/api/stations');

      expect(res.status).toBe(200);
      expect(res.body.stations).toHaveLength(2);
      expect(res.body.stations[0].distance).toBe(0);
    });

    it('rejects invalid query params → 400', async () => {
      const res = await request(app).get('/api/stations?lat=999');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/stations/:id', () => {
    it('returns station detail with bikes', async () => {
      const station = seedStation(state.sqlite, { id: 'detail-s', dockCapacity: 10 });
      seedBike(state.sqlite, station.id, { serialNumber: 'SN-D1', status: 'available' });
      seedBike(state.sqlite, station.id, { serialNumber: 'SN-D2', status: 'maintenance' });

      const res = await request(app).get(`/api/stations/${station.id}`);

      expect(res.status).toBe(200);
      expect(res.body.station.id).toBe(station.id);
      expect(res.body.station.bikes).toHaveLength(2);
      expect(res.body.station.availableBikes).toBe(1);
      expect(res.body.station.emptyDocks).toBe(8); // 10 - 2
    });

    it('station not found → 404', async () => {
      const res = await request(app).get('/api/stations/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  // ── Payment Methods (Authenticated) ─────────────────

  describe('Payment Methods CRUD', () => {
    let userCookies: string;
    let userId: string;

    beforeEach(() => {
      const user = seedUser(state.sqlite, { email: 'pm@test.com' });
      userId = user.id;
      userCookies = getAuthCookies(userId);
    });

    it('adds first payment method (auto-default) → 201', async () => {
      const res = await request(app)
        .post('/api/payment-methods')
        .set('Cookie', userCookies)
        .send({ last4: '4242', brand: 'Visa', expiryMonth: 12, expiryYear: 2026 });

      expect(res.status).toBe(201);
      expect(res.body.paymentMethod.last4).toBe('4242');
      expect(res.body.paymentMethod.brand).toBe('Visa');
      expect(res.body.paymentMethod.isDefault).toBe(true);
    });

    it('adds second payment method (not default) → 201', async () => {
      // Add first
      await request(app)
        .post('/api/payment-methods')
        .set('Cookie', userCookies)
        .send({ last4: '1111', brand: 'Visa', expiryMonth: 6, expiryYear: 2026 });

      // Add second
      const res = await request(app)
        .post('/api/payment-methods')
        .set('Cookie', userCookies)
        .send({ last4: '2222', brand: 'Mastercard', expiryMonth: 12, expiryYear: 2027 });

      expect(res.status).toBe(201);
      expect(res.body.paymentMethod.isDefault).toBe(false);
    });

    it('lists all payment methods', async () => {
      seedPaymentMethod(state.sqlite, userId, { last4: '1111', isDefault: true });
      seedPaymentMethod(state.sqlite, userId, { last4: '2222' });

      const res = await request(app)
        .get('/api/payment-methods')
        .set('Cookie', userCookies);

      expect(res.status).toBe(200);
      expect(res.body.paymentMethods).toHaveLength(2);
    });

    it('sets a payment method as default', async () => {
      const pm1 = seedPaymentMethod(state.sqlite, userId, {
        id: 'pm-1',
        last4: '1111',
        isDefault: true,
      });
      const pm2 = seedPaymentMethod(state.sqlite, userId, { id: 'pm-2', last4: '2222' });

      const res = await request(app)
        .put(`/api/payment-methods/${pm2.id}/default`)
        .set('Cookie', userCookies);

      expect(res.status).toBe(200);
      expect(res.body.paymentMethod.isDefault).toBe(true);

      // Old default should be unset
      const oldRow = state.sqlite
        .prepare('SELECT is_default FROM payment_methods WHERE id = ?')
        .get(pm1.id) as any;
      expect(oldRow.is_default).toBe(0);
    });

    it('set default: not found → 404', async () => {
      const res = await request(app)
        .put('/api/payment-methods/nonexistent/default')
        .set('Cookie', userCookies);

      expect(res.status).toBe(404);
    });

    it('deletes a non-default payment method', async () => {
      seedPaymentMethod(state.sqlite, userId, { id: 'pm-d1', last4: '1111', isDefault: true });
      seedPaymentMethod(state.sqlite, userId, { id: 'pm-d2', last4: '2222' });

      const res = await request(app)
        .delete('/api/payment-methods/pm-d2')
        .set('Cookie', userCookies);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Payment method deleted');
    });

    it('deletes default payment method → promotes next', async () => {
      seedPaymentMethod(state.sqlite, userId, { id: 'pm-def', last4: '1111', isDefault: true });
      seedPaymentMethod(state.sqlite, userId, { id: 'pm-next', last4: '2222' });

      const res = await request(app)
        .delete('/api/payment-methods/pm-def')
        .set('Cookie', userCookies);

      expect(res.status).toBe(200);

      // pm-next should now be default
      const row = state.sqlite
        .prepare('SELECT is_default FROM payment_methods WHERE id = ?')
        .get('pm-next') as any;
      expect(row.is_default).toBe(1);
    });

    it('delete: not found → 404', async () => {
      const res = await request(app)
        .delete('/api/payment-methods/nonexistent')
        .set('Cookie', userCookies);

      expect(res.status).toBe(404);
    });

    it('add: validation error → 400', async () => {
      const res = await request(app)
        .post('/api/payment-methods')
        .set('Cookie', userCookies)
        .send({ last4: 'abc', brand: '', expiryMonth: 13, expiryYear: 2020 });

      expect(res.status).toBe(400);
    });

    it('unauthenticated → 401', async () => {
      const res = await request(app).get('/api/payment-methods');
      expect(res.status).toBe(401);
    });
  });
});
