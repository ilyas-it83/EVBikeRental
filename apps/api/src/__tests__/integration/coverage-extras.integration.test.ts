import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import http from 'http';
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
const { clearTables, seedUser, seedStation, seedBike, seedPaymentMethod, seedRide, getAuthCookies } =
  await import('./helpers.js');

// Direct service imports for coverage
const pricingService = await import('../../services/pricing.service.js');
const paymentService = await import('../../services/payment.service.js');
const { setupWebSocket, broadcastStationUpdate } = await import('../../websocket.js');
const { haversineDistance } = await import('../../utils/geo.js');
const iotService = await import('../../services/iot.service.js');

describe('Coverage Extras', () => {
  beforeEach(() => clearTables(state.sqlite));
  afterAll(() => state.sqlite.close());

  // ── Health Endpoint ─────────────────────────────────

  describe('Health', () => {
    it('GET /api/health returns ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  // ── Pricing Service ─────────────────────────────────

  describe('Pricing Service', () => {
    it('calculateRideCost computes correctly', () => {
      const result = pricingService.calculateRideCost(10);
      expect(result.unlockFee).toBe(1.0);
      expect(result.minuteCharge).toBe(1.5);
      expect(result.total).toBe(2.5);
    });

    it('calculateRideCost for 1 minute', () => {
      const result = pricingService.calculateRideCost(1);
      expect(result.total).toBe(1.15);
    });

    it('getEstimate returns total cost', () => {
      const estimate = pricingService.getEstimate(20);
      expect(estimate).toBe(4.0); // 1.0 + 20 * 0.15 = 4.0
    });

    it('getPricingInfo returns rates', () => {
      const info = pricingService.getPricingInfo();
      expect(info.unlockFee).toBe(1.0);
      expect(info.perMinuteRate).toBe(0.15);
    });
  });

  // ── Geo Utils ───────────────────────────────────────

  describe('Haversine Distance', () => {
    it('returns 0 for same point', () => {
      expect(haversineDistance(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
    });

    it('calculates distance between two known points', () => {
      // NYC to LA ≈ 3944 km
      const dist = haversineDistance(40.7128, -74.006, 34.0522, -118.2437);
      expect(dist).toBeGreaterThan(3900);
      expect(dist).toBeLessThan(4000);
    });

    it('handles short distances', () => {
      // Two points ~1 km apart
      const dist = haversineDistance(40.7128, -74.006, 40.7218, -74.006);
      expect(dist).toBeGreaterThan(0.5);
      expect(dist).toBeLessThan(2);
    });
  });

  // ── IoT Service ─────────────────────────────────────

  describe('IoT Service', () => {
    it('unlockBike returns success', () => {
      const result = iotService.unlockBike('bike-1');
      expect(result.success).toBe(true);
    });

    it('lockBike returns success', () => {
      const result = iotService.lockBike('bike-1');
      expect(result.success).toBe(true);
    });
  });

  // ── Payment Service ─────────────────────────────────

  describe('Payment Service', () => {
    it('MockPaymentAdapter.preAuthorize returns success', () => {
      const adapter = new paymentService.MockPaymentAdapter();
      const result = adapter.preAuthorize(10.0, 'USD');
      expect(result.success).toBe(true);
      expect(result.authId).toMatch(/^mock_auth_/);
    });

    it('MockPaymentAdapter.charge returns success', () => {
      const adapter = new paymentService.MockPaymentAdapter();
      const result = adapter.charge(5.0, 'USD');
      expect(result.success).toBe(true);
      expect(result.transactionId).toMatch(/^mock_txn_/);
    });

    it('MockPaymentAdapter.refund returns success', () => {
      const adapter = new paymentService.MockPaymentAdapter();
      const result = adapter.refund('txn-1', 5.0);
      expect(result.success).toBe(true);
    });

    it('refundPayment refunds an existing payment', () => {
      const user = seedUser(state.sqlite, { email: 'refund@test.com' });
      const station = seedStation(state.sqlite);
      const bike = seedBike(state.sqlite, station.id);
      const ride = seedRide(state.sqlite, user.id, bike.id, station.id, { status: 'completed' });

      // Insert a payment
      state.sqlite
        .prepare(
          'INSERT INTO payments (id, user_id, ride_id, amount, currency, status) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run('pay-1', user.id, ride.id, 5.0, 'USD', 'completed');

      const result = paymentService.refundPayment('pay-1');
      expect(result.status).toBe('refunded');
    });

    it('refundPayment: payment not found → throws 404', () => {
      expect(() => paymentService.refundPayment('nonexistent')).toThrow();
      try {
        paymentService.refundPayment('nonexistent');
      } catch (err: any) {
        expect(err.status).toBe(404);
      }
    });

    it('processPayment creates a payment record', () => {
      const user = seedUser(state.sqlite, { email: 'pay@test.com' });
      const station = seedStation(state.sqlite);
      const bike = seedBike(state.sqlite, station.id);
      const ride = seedRide(state.sqlite, user.id, bike.id, station.id, { status: 'completed' });

      // Add a default payment method
      seedPaymentMethod(state.sqlite, user.id, { isDefault: true });

      const payment = paymentService.processPayment(user.id, ride.id, 3.5);
      expect(payment.amount).toBe(3.5);
      expect(payment.status).toBe('completed');
      expect(payment.method).toContain('Visa');
    });

    it('processPayment throws 402 when charge fails', () => {
      const user = seedUser(state.sqlite, { email: 'chargefail@test.com' });
      const station = seedStation(state.sqlite);
      const bike = seedBike(state.sqlite, station.id);
      const ride = seedRide(state.sqlite, user.id, bike.id, station.id, { status: 'completed' });

      vi.spyOn(paymentService.MockPaymentAdapter.prototype, 'charge').mockReturnValueOnce({
        success: false,
        transactionId: '',
      });

      expect(() => paymentService.processPayment(user.id, ride.id, 5.0)).toThrow();
      try {
        paymentService.processPayment(user.id, ride.id, 5.0);
      } catch (err: any) {
        expect(err.status).toBe(402);
      }
      vi.restoreAllMocks();
    });

    it('refundPayment throws 500 when refund fails', () => {
      const user = seedUser(state.sqlite, { email: 'refundfail@test.com' });
      const station = seedStation(state.sqlite);
      const bike = seedBike(state.sqlite, station.id);
      const ride = seedRide(state.sqlite, user.id, bike.id, station.id, { status: 'completed' });
      state.sqlite
        .prepare('INSERT INTO payments (id, user_id, ride_id, amount, currency, status) VALUES (?, ?, ?, ?, ?, ?)')
        .run('pay-fail', user.id, ride.id, 5.0, 'USD', 'completed');

      vi.spyOn(paymentService.MockPaymentAdapter.prototype, 'refund').mockReturnValueOnce({
        success: false,
      });

      expect(() => paymentService.refundPayment('pay-fail')).toThrow();
      try {
        paymentService.refundPayment('pay-fail');
      } catch (err: any) {
        expect(err.status).toBe(500);
      }
      vi.restoreAllMocks();
    });

    it('processPayment without default payment method still works', () => {
      const user = seedUser(state.sqlite, { email: 'nodefault@test.com' });
      const station = seedStation(state.sqlite);
      const bike = seedBike(state.sqlite, station.id);
      const ride = seedRide(state.sqlite, user.id, bike.id, station.id, { status: 'completed' });

      const payment = paymentService.processPayment(user.id, ride.id, 2.0);
      expect(payment.amount).toBe(2.0);
      expect(payment.method).toBeNull();
    });
  });

  // ── WebSocket ───────────────────────────────────────

  describe('WebSocket', () => {
    it('broadcastStationUpdate with no wss is a no-op', () => {
      // wss is null by default in test environment (no setupWebSocket called)
      // Should not throw
      broadcastStationUpdate('any-station');
    });

    it('setupWebSocket and broadcast sends messages', async () => {
      const station = seedStation(state.sqlite, { id: 'ws-station', dockCapacity: 10 });
      seedBike(state.sqlite, station.id, { serialNumber: 'SN-WS1', status: 'available' });

      const server = http.createServer(app);
      setupWebSocket(server);

      await new Promise<void>((resolve) => server.listen(0, resolve));
      const port = (server.address() as any).port;

      // Connect a WebSocket client
      const { WebSocket } = await import('ws');
      const ws = new WebSocket(`ws://localhost:${port}`);

      const messagePromise = new Promise<any>((resolve) => {
        ws.on('message', (data: any) => resolve(JSON.parse(data.toString())));
      });

      await new Promise<void>((resolve) => ws.on('open', resolve));

      // Trigger broadcast
      broadcastStationUpdate('ws-station');

      const message = await messagePromise;
      expect(message.type).toBe('station:availability');
      expect(message.data.stationId).toBe('ws-station');
      expect(message.data.availableBikes).toBe(1);

      ws.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('broadcastStationUpdate with non-existent station does nothing', async () => {
      const station = seedStation(state.sqlite, { id: 'real-station' });

      const server = http.createServer(app);
      setupWebSocket(server);

      await new Promise<void>((resolve) => server.listen(0, resolve));

      // Should not throw for non-existent station
      broadcastStationUpdate('nonexistent-station');

      await new Promise<void>((resolve) => server.close(() => resolve()));
    });
  });
});
