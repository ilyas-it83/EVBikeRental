/**
 * Station API Tests
 *
 * Tests station endpoints:
 * - GET /api/stations — list with availability
 * - GET /api/stations?lat=X&lng=Y — sorted by distance
 * - GET /api/stations?lat=X&lng=Y&radius=N — filtered by radius
 * - GET /api/stations/:id — station detail with bikes
 * - GET /api/stations/:nonexistent — 404
 * - Haversine distance accuracy
 *
 * References: GitHub Issue #5, PRD §3.2
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import {
  createTestDb,
  seedTestData,
  haversineDistance,
  SEED_STATIONS,
  SEED_BIKES,
} from '../test/setup.js';

let sqlite: Database.Database;
let app: express.Express;

function createTestApp(sqliteDb: Database.Database): express.Express {
  const testApp = express();
  testApp.use(express.json());

  // Haversine helper
  function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // GET /api/stations
  testApp.get('/api/stations', (req, res) => {
    const { lat, lng, radius } = req.query;

    let stations = sqliteDb
      .prepare('SELECT id, name, latitude, longitude, address, capacity FROM stations')
      .all() as Array<{
        id: string; name: string; latitude: number; longitude: number;
        address: string; capacity: number;
      }>;

    // Enrich with availability counts
    const enriched = stations.map((s) => {
      const availableBikes = (sqliteDb
        .prepare('SELECT COUNT(*) as count FROM bikes WHERE station_id = ? AND status = ?')
        .get(s.id, 'available') as { count: number }).count;

      const totalBikesAtStation = (sqliteDb
        .prepare('SELECT COUNT(*) as count FROM bikes WHERE station_id = ?')
        .get(s.id) as { count: number }).count;

      const emptyDocks = s.capacity - totalBikesAtStation;

      return { ...s, availableBikes, emptyDocks };
    });

    // If lat/lng provided, calculate distances and sort
    if (lat && lng) {
      const userLat = parseFloat(lat as string);
      const userLng = parseFloat(lng as string);

      const withDistance = enriched.map((s) => ({
        ...s,
        distance: haversine(userLat, userLng, s.latitude, s.longitude),
      }));

      // Filter by radius if provided
      const filtered = radius
        ? withDistance.filter((s) => s.distance <= parseFloat(radius as string))
        : withDistance;

      // Sort by distance
      filtered.sort((a, b) => a.distance - b.distance);

      res.json({ success: true, data: { stations: filtered } });
      return;
    }

    res.json({ success: true, data: { stations: enriched } });
  });

  // GET /api/stations/:id
  testApp.get('/api/stations/:id', (req, res) => {
    const station = sqliteDb
      .prepare('SELECT id, name, latitude, longitude, address, capacity FROM stations WHERE id = ?')
      .get(req.params.id) as any;

    if (!station) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Station not found' },
      });
      return;
    }

    const bikes = sqliteDb
      .prepare('SELECT id, status, battery_level, model FROM bikes WHERE station_id = ?')
      .all(req.params.id);

    const availableBikes = (sqliteDb
      .prepare('SELECT COUNT(*) as count FROM bikes WHERE station_id = ? AND status = ?')
      .get(req.params.id, 'available') as { count: number }).count;

    const totalBikesAtStation = (sqliteDb
      .prepare('SELECT COUNT(*) as count FROM bikes WHERE station_id = ?')
      .get(req.params.id) as { count: number }).count;

    res.json({
      success: true,
      data: {
        station: {
          ...station,
          availableBikes,
          emptyDocks: station.capacity - totalBikesAtStation,
          bikes,
        },
      },
    });
  });

  return testApp;
}

describe('GET /api/stations', () => {
  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
  });

  afterEach(() => {
    sqlite.close();
  });

  it('should return station list with availableBikes and emptyDocks', async () => {
    const res = await request(app).get('/api/stations');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stations).toHaveLength(3);

    for (const station of res.body.data.stations) {
      expect(station).toHaveProperty('availableBikes');
      expect(station).toHaveProperty('emptyDocks');
      expect(typeof station.availableBikes).toBe('number');
      expect(typeof station.emptyDocks).toBe('number');
    }
  });

  it('should return stations sorted by distance when lat/lng provided', async () => {
    // Query from Times Square area
    const res = await request(app)
      .get('/api/stations')
      .query({ lat: 40.758896, lng: -73.98513 });

    expect(res.status).toBe(200);
    const stations = res.body.data.stations;

    // Should be sorted by distance (ascending)
    for (let i = 1; i < stations.length; i++) {
      expect(stations[i].distance).toBeGreaterThanOrEqual(stations[i - 1].distance);
    }

    // Times Square station should be closest (distance ~0)
    expect(stations[0].name).toBe('Times Square Station');
    expect(stations[0].distance).toBeLessThan(0.01);
  });

  it('should filter stations by radius when lat/lng/radius provided', async () => {
    // Query from Times Square with 2km radius
    const res = await request(app)
      .get('/api/stations')
      .query({ lat: 40.758896, lng: -73.98513, radius: 2 });

    expect(res.status).toBe(200);
    const stations = res.body.data.stations;

    // All returned stations should be within 2km
    for (const station of stations) {
      expect(station.distance).toBeLessThanOrEqual(2);
    }

    // Brooklyn Bridge is ~6km from Times Square — should be excluded
    const brooklynBridge = stations.find((s: any) => s.name === 'Brooklyn Bridge Station');
    expect(brooklynBridge).toBeUndefined();
  });

  it('should return correct availableBikes count matching actual available bikes', async () => {
    const res = await request(app).get('/api/stations');
    const stations = res.body.data.stations;

    // Station 001: 2 available bikes (bike-001, bike-002), bike-003 is maintenance
    const station1 = stations.find((s: any) => s.id === 'station-001');
    expect(station1.availableBikes).toBe(2);

    // Station 002: 1 available bike (bike-004), bike-005 is rented
    const station2 = stations.find((s: any) => s.id === 'station-002');
    expect(station2.availableBikes).toBe(1);

    // Station 003: 1 available bike (bike-006)
    const station3 = stations.find((s: any) => s.id === 'station-003');
    expect(station3.availableBikes).toBe(1);
  });
});

describe('GET /api/stations/:id', () => {
  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
  });

  afterEach(() => {
    sqlite.close();
  });

  it('should return station detail with bike list', async () => {
    const res = await request(app).get('/api/stations/station-001');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const station = res.body.data.station;
    expect(station.id).toBe('station-001');
    expect(station.name).toBe('Central Park Station');
    expect(station.bikes).toBeDefined();
    expect(Array.isArray(station.bikes)).toBe(true);
    expect(station.bikes.length).toBe(3); // 3 bikes at station-001
    expect(station.availableBikes).toBe(2);
    expect(station.emptyDocks).toBe(17); // capacity 20 - 3 bikes
  });

  it('should return 404 for non-existent station', async () => {
    const res = await request(app).get('/api/stations/nonexistent-id');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('Haversine distance calculation', () => {
  it('should calculate accurate distance between known coordinates', () => {
    // New York to Los Angeles: ~3944 km
    const nyToLa = haversineDistance(40.7128, -74.006, 33.9425, -118.408);
    expect(nyToLa).toBeGreaterThan(3900);
    expect(nyToLa).toBeLessThan(4000);
  });

  it('should return ~0 for same coordinates', () => {
    const same = haversineDistance(40.7128, -74.006, 40.7128, -74.006);
    expect(same).toBeCloseTo(0, 5);
  });

  it('should calculate short distances accurately', () => {
    // Central Park to Times Square: ~3 km
    const cpToTs = haversineDistance(40.785091, -73.968285, 40.758896, -73.98513);
    expect(cpToTs).toBeGreaterThan(2);
    expect(cpToTs).toBeLessThan(4);
  });
});
