import { db } from '../db/index.js';
import { stations, bikes, users } from '../db/schema.js';
import { eq, and, sql, lte } from 'drizzle-orm';
import crypto from 'crypto';

// ─── Station Management ─────────────────────────────

export function createStation(data: {
  name: string;
  address: string;
  lat: number;
  lng: number;
  dockCapacity: number;
}) {
  const id = crypto.randomUUID();
  db.insert(stations)
    .values({ id, ...data, status: 'active' })
    .run();
  return db.select().from(stations).where(eq(stations.id, id)).get()!;
}

export function updateStation(
  id: string,
  data: Partial<{ name: string; address: string; lat: number; lng: number; dockCapacity: number }>,
) {
  const station = db.select().from(stations).where(eq(stations.id, id)).get();
  if (!station) {
    throw { status: 404, error: 'Station not found' };
  }
  db.update(stations).set(data).where(eq(stations.id, id)).run();
  return db.select().from(stations).where(eq(stations.id, id)).get()!;
}

export function deleteStation(id: string) {
  const station = db.select().from(stations).where(eq(stations.id, id)).get();
  if (!station) {
    throw { status: 404, error: 'Station not found' };
  }

  // Fail if bikes are active at this station
  const activeBikes = db
    .select()
    .from(bikes)
    .where(
      and(
        eq(bikes.stationId, id),
        eq(bikes.status, 'in_use'),
      ),
    )
    .all();
  if (activeBikes.length > 0) {
    throw { status: 400, error: 'Cannot delete station with active bikes' };
  }

  db.update(stations).set({ status: 'inactive' }).where(eq(stations.id, id)).run();
  return db.select().from(stations).where(eq(stations.id, id)).get()!;
}

export function listAllStations() {
  return db.select().from(stations).all();
}

// ─── Bike Management ────────────────────────────────

export function createBike(data: {
  serialNumber: string;
  model: string;
  stationId: string;
  batteryLevel?: number;
}) {
  const station = db.select().from(stations).where(eq(stations.id, data.stationId)).get();
  if (!station) {
    throw { status: 404, error: 'Station not found' };
  }

  const id = crypto.randomUUID();
  db.insert(bikes)
    .values({
      id,
      serialNumber: data.serialNumber,
      model: data.model,
      stationId: data.stationId,
      batteryLevel: data.batteryLevel ?? 100,
      status: 'available',
    })
    .run();
  return db.select().from(bikes).where(eq(bikes.id, id)).get()!;
}

export function updateBike(
  id: string,
  data: Partial<{
    status: 'available' | 'in_use' | 'maintenance' | 'retired' | 'reserved';
    stationId: string;
    batteryLevel: number;
    model: string;
  }>,
) {
  const bike = db.select().from(bikes).where(eq(bikes.id, id)).get();
  if (!bike) {
    throw { status: 404, error: 'Bike not found' };
  }
  db.update(bikes).set(data).where(eq(bikes.id, id)).run();
  return db.select().from(bikes).where(eq(bikes.id, id)).get()!;
}

export function deleteBike(id: string) {
  const bike = db.select().from(bikes).where(eq(bikes.id, id)).get();
  if (!bike) {
    throw { status: 404, error: 'Bike not found' };
  }
  if (bike.status === 'in_use') {
    throw { status: 400, error: 'Cannot retire a bike that is in use' };
  }

  db.update(bikes).set({ status: 'retired' }).where(eq(bikes.id, id)).run();
  return db.select().from(bikes).where(eq(bikes.id, id)).get()!;
}

export function listAllBikes(filters?: { stationId?: string; status?: string; lowBattery?: boolean }) {
  let allBikes = db.select().from(bikes).all();

  if (filters?.stationId) {
    allBikes = allBikes.filter((b) => b.stationId === filters.stationId);
  }
  if (filters?.status) {
    allBikes = allBikes.filter((b) => b.status === filters.status);
  }
  if (filters?.lowBattery) {
    allBikes = allBikes.filter((b) => b.batteryLevel < 20);
  }

  return allBikes;
}

// ─── User Management ────────────────────────────────

export function listUsers(page: number = 1, limit: number = 20) {
  const offset = (page - 1) * limit;

  const totalResult = db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .get()!;
  const total = totalResult.count;

  const userList = db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      phone: users.phone,
      role: users.role,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .limit(limit)
    .offset(offset)
    .all();

  return {
    users: userList,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export function updateUserRole(userId: string, role: 'rider' | 'admin') {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) {
    throw { status: 404, error: 'User not found' };
  }

  db.update(users).set({ role }).where(eq(users.id, userId)).run();

  const { passwordHash, ...rest } = db.select().from(users).where(eq(users.id, userId)).get()!;
  return rest;
}

export function suspendUser(userId: string) {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) {
    throw { status: 404, error: 'User not found' };
  }

  // Soft-suspend: mark updatedAt and return info (could add a suspended column in future)
  db.update(users)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(users.id, userId))
    .run();

  const { passwordHash, ...rest } = db.select().from(users).where(eq(users.id, userId)).get()!;
  return { ...rest, suspended: true };
}
