import { db, sqlite } from './index.js';
import { users, stations, bikes, rides, payments } from './schema.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

function uid(): string {
  return crypto.randomUUID();
}

export function seedIfEmpty() {
  const row = sqlite.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (row.count > 0) {
    console.log('[seed] Database already seeded, skipping');
    return;
  }

  console.log('[seed] Empty database detected, seeding...');

  const passwordHash = bcrypt.hashSync('password123', 12);
  const riderId = uid();
  const adminId = uid();

  db.insert(users).values([
    { id: riderId, email: 'rider@test.com', passwordHash, name: 'Test Rider', phone: '+15551234567', role: 'rider' },
    { id: adminId, email: 'admin@test.com', passwordHash, name: 'Test Admin', phone: '+15559876543', role: 'admin' },
  ]).run();

  const stationData = [
    { id: uid(), name: 'Ferry Building', address: '1 Ferry Building, San Francisco, CA', lat: 37.7955, lng: -122.3937, dockCapacity: 20 },
    { id: uid(), name: 'Embarcadero Station', address: '298 Market St, San Francisco, CA', lat: 37.7929, lng: -122.3969, dockCapacity: 15 },
    { id: uid(), name: 'Union Square', address: '333 Post St, San Francisco, CA', lat: 37.7879, lng: -122.4074, dockCapacity: 18 },
    { id: uid(), name: 'Civic Center', address: '355 McAllister St, San Francisco, CA', lat: 37.7813, lng: -122.4167, dockCapacity: 12 },
    { id: uid(), name: 'Mission Dolores Park', address: '19th & Dolores St, San Francisco, CA', lat: 37.7596, lng: -122.4269, dockCapacity: 16 },
  ];
  db.insert(stations).values(stationData).run();

  const models = ['EcoRide E1', 'VoltBike Pro', 'SparkCycle 3000'];
  const bikeRows: Array<{
    id: string; serialNumber: string; model: string;
    stationId: string; status: 'available' | 'in_use' | 'maintenance' | 'retired';
    batteryLevel: number;
  }> = [];

  for (const station of stationData) {
    for (let i = 0; i < 5; i++) {
      const batteryLevel = 40 + Math.floor(Math.random() * 61);
      const status: 'available' | 'maintenance' = i === 4 ? 'maintenance' : 'available';
      bikeRows.push({
        id: uid(),
        serialNumber: `SN-${station.name.substring(0, 3).toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
        model: models[i % models.length],
        stationId: station.id,
        status,
        batteryLevel,
      });
    }
  }
  db.insert(bikes).values(bikeRows).run();

  const rideData = [
    {
      id: uid(), userId: riderId, bikeId: bikeRows[0].id,
      startStationId: stationData[0].id, endStationId: stationData[1].id,
      startTime: '2025-07-20T08:00:00Z', endTime: '2025-07-20T08:25:00Z',
      durationMinutes: 25, distanceKm: 2.1, cost: 5.25, status: 'completed' as const,
    },
    {
      id: uid(), userId: riderId, bikeId: bikeRows[5].id,
      startStationId: stationData[1].id, endStationId: stationData[2].id,
      startTime: '2025-07-21T14:30:00Z', endTime: '2025-07-21T15:05:00Z',
      durationMinutes: 35, distanceKm: 3.4, cost: 7.50, status: 'completed' as const,
    },
    {
      id: uid(), userId: riderId, bikeId: bikeRows[10].id,
      startStationId: stationData[2].id, endStationId: stationData[4].id,
      startTime: '2025-07-22T10:00:00Z', endTime: '2025-07-22T10:50:00Z',
      durationMinutes: 50, distanceKm: 5.8, cost: 12.00, status: 'completed' as const,
    },
  ];
  db.insert(rides).values(rideData).run();

  const paymentData = rideData.map((ride) => ({
    id: uid(), userId: ride.userId, rideId: ride.id,
    amount: ride.cost!, currency: 'USD', status: 'completed' as const, method: 'card',
  }));
  db.insert(payments).values(paymentData).run();

  console.log('[seed] ✓ 2 users, 5 stations, 25 bikes, 3 rides, 3 payments');
}
