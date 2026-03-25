import { db } from '../db/index.js';
import { stations, bikes } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { haversineDistance } from '../utils/geo.js';

export interface StationWithDistance {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  dockCapacity: number;
  status: string;
  availableBikes: number;
  emptyDocks: number;
  distance: number;
  createdAt: string;
}

export interface StationDetail {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  dockCapacity: number;
  status: string;
  availableBikes: number;
  emptyDocks: number;
  createdAt: string;
  bikes: BikeInfo[];
}

export interface BikeInfo {
  id: string;
  model: string;
  batteryLevel: number;
  status: string;
}

export function listStations(lat?: number, lng?: number, radiusKm: number = 10): StationWithDistance[] {
  const allStations = db.select().from(stations).where(eq(stations.status, 'active')).all();

  const allBikes = db.select({
    stationId: bikes.stationId,
    status: bikes.status,
  }).from(bikes).all();

  // Count available bikes per station
  const bikeCounts = new Map<string, { available: number; total: number }>();
  for (const bike of allBikes) {
    if (!bike.stationId) continue;
    const entry = bikeCounts.get(bike.stationId) ?? { available: 0, total: 0 };
    entry.total++;
    if (bike.status === 'available') entry.available++;
    bikeCounts.set(bike.stationId, entry);
  }

  let result: StationWithDistance[] = allStations.map((s) => {
    const counts = bikeCounts.get(s.id) ?? { available: 0, total: 0 };
    const distance = (lat != null && lng != null)
      ? haversineDistance(lat, lng, s.lat, s.lng)
      : 0;

    return {
      id: s.id,
      name: s.name,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      dockCapacity: s.dockCapacity,
      status: s.status,
      availableBikes: counts.available,
      emptyDocks: s.dockCapacity - counts.total,
      distance: Math.round(distance * 100) / 100,
      createdAt: s.createdAt,
    };
  });

  // Filter by radius if coordinates provided
  if (lat != null && lng != null) {
    result = result.filter((s) => s.distance <= radiusKm);
    result.sort((a, b) => a.distance - b.distance);
  }

  return result;
}

export function getStationById(stationId: string): StationDetail | null {
  const station = db.select().from(stations).where(eq(stations.id, stationId)).get();
  if (!station) return null;

  const stationBikes = db.select().from(bikes)
    .where(eq(bikes.stationId, stationId))
    .all();

  const availableBikes = stationBikes.filter((b) => b.status === 'available');

  return {
    id: station.id,
    name: station.name,
    address: station.address,
    lat: station.lat,
    lng: station.lng,
    dockCapacity: station.dockCapacity,
    status: station.status,
    availableBikes: availableBikes.length,
    emptyDocks: station.dockCapacity - stationBikes.length,
    createdAt: station.createdAt,
    bikes: stationBikes.map((b) => ({
      id: b.id,
      model: b.model,
      batteryLevel: b.batteryLevel,
      status: b.status,
    })),
  };
}
