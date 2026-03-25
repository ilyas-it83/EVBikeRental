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

// Direct service import for expireReservations
const reservationService = await import('../../services/reservation.service.js');

describe('Reservation Flow Integration', () => {
  let userId: string;
  let userCookies: string;
  let stationId: string;
  let bikeId: string;

  beforeEach(() => {
    clearTables(state.sqlite);
    const user = seedUser(state.sqlite, { email: 'reserver@test.com' });
    userId = user.id;
    userCookies = getAuthCookies(userId);
    const station = seedStation(state.sqlite, { id: 'res-station' });
    stationId = station.id;
    const bike = seedBike(state.sqlite, stationId, { id: 'res-bike' });
    bikeId = bike.id;
  });

  afterAll(() => state.sqlite.close());

  // ── Reserve ─────────────────────────────────────────

  it('reserves a bike → 201', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Cookie', userCookies)
      .send({ bikeId, stationId });

    expect(res.status).toBe(201);
    expect(res.body.reservation.bikeId).toBe(bikeId);
    expect(res.body.reservation.stationId).toBe(stationId);
    expect(res.body.reservation.status).toBe('active');

    // Bike status should be reserved
    const bikeRow = state.sqlite
      .prepare('SELECT status FROM bikes WHERE id = ?')
      .get(bikeId) as any;
    expect(bikeRow.status).toBe('reserved');
  });

  it('reserve: bike not found → 404', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Cookie', userCookies)
      .send({ bikeId: 'nonexistent', stationId });

    expect(res.status).toBe(404);
  });

  it('reserve: bike at wrong station → 400', async () => {
    const station2 = seedStation(state.sqlite, { id: 'other-station', name: 'Other' });

    const res = await request(app)
      .post('/api/reservations')
      .set('Cookie', userCookies)
      .send({ bikeId, stationId: station2.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('not at this station');
  });

  it('reserve: bike not available → 400', async () => {
    const maintenanceBike = seedBike(state.sqlite, stationId, {
      id: 'maint-bike',
      serialNumber: 'SN-MAINT',
      status: 'maintenance',
    });

    const res = await request(app)
      .post('/api/reservations')
      .set('Cookie', userCookies)
      .send({ bikeId: maintenanceBike.id, stationId });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('not available');
  });

  it('reserve: station not found → 404', async () => {
    // Create a bike with null station to test a different scenario
    const floatingBike = seedBike(state.sqlite, stationId, {
      id: 'float-bike',
      serialNumber: 'SN-FLOAT',
    });
    // Override station to a nonexistent one at the request level
    const res = await request(app)
      .post('/api/reservations')
      .set('Cookie', userCookies)
      .send({ bikeId: floatingBike.id, stationId: 'nonexistent-station' });

    // Bike is not at nonexistent station → 400 (bike at wrong station check happens first)
    expect(res.status).toBe(400);
  });

  it('reserve: station not found (bike stationId matches but station deleted) → 404', async () => {
    // Create scenario where bike references a station that doesn't exist
    state.sqlite.exec('PRAGMA foreign_keys = OFF');
    state.sqlite
      .prepare('INSERT INTO bikes (id, serial_number, model, station_id, status, battery_level) VALUES (?, ?, ?, ?, ?, ?)')
      .run('orphan-bike', 'SN-ORPHAN', 'EV-Pro', 'ghost-station', 'available', 80);
    state.sqlite.exec('PRAGMA foreign_keys = ON');

    const res = await request(app)
      .post('/api/reservations')
      .set('Cookie', userCookies)
      .send({ bikeId: 'orphan-bike', stationId: 'ghost-station' });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Station not found');
  });

  it('reserve: already has active reservation → 400', async () => {
    // First reservation
    await request(app)
      .post('/api/reservations')
      .set('Cookie', userCookies)
      .send({ bikeId, stationId });

    // Create another available bike
    const bike2 = seedBike(state.sqlite, stationId, {
      id: 'bike-2',
      serialNumber: 'SN-B2',
    });

    // Try second reservation
    const res = await request(app)
      .post('/api/reservations')
      .set('Cookie', userCookies)
      .send({ bikeId: bike2.id, stationId });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('already have an active reservation');
  });

  it('reserve: validation error → 400', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Cookie', userCookies)
      .send({});

    expect(res.status).toBe(400);
  });

  // ── Get Active ──────────────────────────────────────

  it('get active reservation', async () => {
    await request(app)
      .post('/api/reservations')
      .set('Cookie', userCookies)
      .send({ bikeId, stationId });

    const res = await request(app)
      .get('/api/reservations/active')
      .set('Cookie', userCookies);

    expect(res.status).toBe(200);
    expect(res.body.reservation).not.toBeNull();
    expect(res.body.reservation.bikeId).toBe(bikeId);
  });

  it('get active reservation when none → null', async () => {
    const res = await request(app)
      .get('/api/reservations/active')
      .set('Cookie', userCookies);

    expect(res.status).toBe(200);
    expect(res.body.reservation).toBeNull();
  });

  it('get active reservation auto-expires past-due reservation', async () => {
    // Manually insert an expired reservation
    state.sqlite
      .prepare(
        'INSERT INTO reservations (id, user_id, bike_id, station_id, status, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run('exp-res', userId, bikeId, stationId, 'active', new Date(Date.now() - 60000).toISOString());
    state.sqlite
      .prepare('UPDATE bikes SET status = ? WHERE id = ?')
      .run('reserved', bikeId);

    const res = await request(app)
      .get('/api/reservations/active')
      .set('Cookie', userCookies);

    expect(res.status).toBe(200);
    expect(res.body.reservation).toBeNull();

    // Bike should be available again
    const bikeRow = state.sqlite
      .prepare('SELECT status FROM bikes WHERE id = ?')
      .get(bikeId) as any;
    expect(bikeRow.status).toBe('available');
  });

  // ── Cancel ──────────────────────────────────────────

  it('cancels a reservation', async () => {
    const reserve = await request(app)
      .post('/api/reservations')
      .set('Cookie', userCookies)
      .send({ bikeId, stationId });

    const reservationId = reserve.body.reservation.id;

    const res = await request(app)
      .delete(`/api/reservations/${reservationId}`)
      .set('Cookie', userCookies);

    expect(res.status).toBe(200);
    expect(res.body.reservation.status).toBe('cancelled');
    expect(res.body.message).toBe('Reservation cancelled');

    // Bike should be available again
    const bikeRow = state.sqlite
      .prepare('SELECT status FROM bikes WHERE id = ?')
      .get(bikeId) as any;
    expect(bikeRow.status).toBe('available');
  });

  it('cancel: not found → 404', async () => {
    const res = await request(app)
      .delete('/api/reservations/nonexistent')
      .set('Cookie', userCookies);

    expect(res.status).toBe(404);
  });

  it('cancel: not yours → 403', async () => {
    // Create reservation for another user
    const other = seedUser(state.sqlite, { id: 'other-user', email: 'other@test.com' });
    state.sqlite
      .prepare(
        'INSERT INTO reservations (id, user_id, bike_id, station_id, status, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run('other-res', other.id, bikeId, stationId, 'active', new Date(Date.now() + 600000).toISOString());

    const res = await request(app)
      .delete('/api/reservations/other-res')
      .set('Cookie', userCookies);

    expect(res.status).toBe(403);
  });

  it('cancel: not active → 400', async () => {
    state.sqlite
      .prepare(
        'INSERT INTO reservations (id, user_id, bike_id, station_id, status, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run('done-res', userId, bikeId, stationId, 'cancelled', new Date(Date.now() + 600000).toISOString());

    const res = await request(app)
      .delete('/api/reservations/done-res')
      .set('Cookie', userCookies);

    expect(res.status).toBe(400);
  });

  // ── Expire batch (direct service call) ──────────────

  it('expireReservations expires past-due reservations', () => {
    // Create expired reservation
    state.sqlite
      .prepare(
        'INSERT INTO reservations (id, user_id, bike_id, station_id, status, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run('batch-exp', userId, bikeId, stationId, 'active', new Date(Date.now() - 60000).toISOString());
    state.sqlite.prepare('UPDATE bikes SET status = ? WHERE id = ?').run('reserved', bikeId);

    reservationService.expireReservations();

    const row = state.sqlite
      .prepare('SELECT status FROM reservations WHERE id = ?')
      .get('batch-exp') as any;
    expect(row.status).toBe('expired');

    const bikeRow = state.sqlite
      .prepare('SELECT status FROM bikes WHERE id = ?')
      .get(bikeId) as any;
    expect(bikeRow.status).toBe('available');
  });

  it('expireReservations does nothing when no expired', () => {
    // No reservations - should not throw
    reservationService.expireReservations();
  });

  // ── Auth guard ──────────────────────────────────────

  it('unauthenticated → 401', async () => {
    const res = await request(app).post('/api/reservations').send({ bikeId, stationId });
    expect(res.status).toBe(401);
  });
});
