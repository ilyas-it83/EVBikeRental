import { db } from '../db/index.js';
import { rides, bikes, stations, payments, paymentMethods, users } from '../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import crypto from 'crypto';
import * as pricingService from './pricing.service.js';
import * as paymentService from './payment.service.js';
import * as iotService from './iot.service.js';
import * as alertService from './alert.service.js';
import { broadcastStationUpdate } from '../websocket.js';

// ─── Types ──────────────────────────────────────────

export interface RideWithDetails {
  id: string;
  userId: string;
  bikeId: string;
  startStationId: string;
  endStationId: string | null;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
  distanceKm: number | null;
  cost: number | null;
  status: string;
  createdAt: string;
  startStationName: string;
  endStationName: string | null;
  payment: typeof payments.$inferSelect | null;
  bike: { model: string; batteryLevel: number } | null;
}

// ─── Helpers ────────────────────────────────────────

function getStationName(stationId: string | null): string | null {
  if (!stationId) return null;
  const station = db.select().from(stations).where(eq(stations.id, stationId)).get();
  return station?.name ?? null;
}

function enrichRide(ride: typeof rides.$inferSelect): RideWithDetails {
  const payment = db
    .select()
    .from(payments)
    .where(eq(payments.rideId, ride.id))
    .get() ?? null;

  const bike = db
    .select({ model: bikes.model, batteryLevel: bikes.batteryLevel })
    .from(bikes)
    .where(eq(bikes.id, ride.bikeId))
    .get() ?? null;

  return {
    ...ride,
    startStationName: getStationName(ride.startStationId) ?? 'Unknown',
    endStationName: getStationName(ride.endStationId),
    payment,
    bike,
  };
}

// ─── Public API ─────────────────────────────────────

export function startRide(
  userId: string,
  bikeId: string,
  stationId: string,
): RideWithDetails {
  // Validate bike exists and is at the station
  const bike = db.select().from(bikes).where(eq(bikes.id, bikeId)).get();
  if (!bike) {
    throw { status: 404, error: 'Bike not found' };
  }
  if (bike.stationId !== stationId) {
    throw { status: 400, error: 'Bike is not at this station' };
  }
  if (bike.status !== 'available') {
    throw { status: 400, error: 'Bike is not available' };
  }
  if (bike.batteryLevel < 15) {
    throw { status: 400, error: 'Bike battery too low (minimum 15%)' };
  }

  // Check user has no active ride
  const activeRide = db
    .select()
    .from(rides)
    .where(and(eq(rides.userId, userId), eq(rides.status, 'active')))
    .get();
  if (activeRide) {
    throw { status: 400, error: 'You already have an active ride' };
  }

  // Check user has at least one payment method
  const pm = db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.userId, userId))
    .get();
  if (!pm) {
    throw { status: 400, error: 'No payment method on file. Please add one first.' };
  }

  // Update bike: in_use, clear station
  db.update(bikes)
    .set({ status: 'in_use', stationId: null })
    .where(eq(bikes.id, bikeId))
    .run();

  // Unlock bike via IoT
  iotService.unlockBike(bikeId);

  // Create ride record
  const id = crypto.randomUUID();
  const startTime = new Date().toISOString();

  db.insert(rides)
    .values({
      id,
      userId,
      bikeId,
      startStationId: stationId,
      startTime,
      status: 'active',
    })
    .run();

  const ride = db.select().from(rides).where(eq(rides.id, id)).get()!;
  broadcastStationUpdate(stationId);

  // Check alerts after ride start
  try { alertService.checkStationCapacity(); } catch (_) { /* non-critical */ }

  return enrichRide(ride);
}

export function getActiveRide(userId: string): RideWithDetails | null {
  const ride = db
    .select()
    .from(rides)
    .where(and(eq(rides.userId, userId), eq(rides.status, 'active')))
    .get();

  if (!ride) return null;
  return enrichRide(ride);
}

export function endRide(
  rideId: string,
  userId: string,
  endStationId: string,
): RideWithDetails {
  // Validate ride
  const ride = db.select().from(rides).where(eq(rides.id, rideId)).get();
  if (!ride) {
    throw { status: 404, error: 'Ride not found' };
  }
  if (ride.userId !== userId) {
    throw { status: 403, error: 'Not your ride' };
  }
  if (ride.status !== 'active') {
    throw { status: 400, error: 'Ride is not active' };
  }

  // Validate end station
  const endStation = db.select().from(stations).where(eq(stations.id, endStationId)).get();
  if (!endStation) {
    throw { status: 404, error: 'End station not found' };
  }

  // Calculate duration and cost
  const endTime = new Date();
  const startTime = new Date(ride.startTime);
  const durationMinutes = Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 60000));
  const { total: cost } = pricingService.calculateRideCost(durationMinutes);

  // Update ride
  db.update(rides)
    .set({
      endStationId,
      endTime: endTime.toISOString(),
      durationMinutes,
      cost,
      status: 'completed',
    })
    .where(eq(rides.id, rideId))
    .run();

  // Update bike: available, set station, reduce battery
  const batteryDrain = Math.floor(Math.random() * 11) + 5; // 5-15%
  const bike = db.select().from(bikes).where(eq(bikes.id, ride.bikeId)).get()!;
  const newBattery = Math.max(0, bike.batteryLevel - batteryDrain);

  db.update(bikes)
    .set({ status: 'available', stationId: endStationId, batteryLevel: newBattery })
    .where(eq(bikes.id, ride.bikeId))
    .run();

  // Process payment
  paymentService.processPayment(userId, rideId, cost);

  // Lock bike via IoT
  iotService.lockBike(ride.bikeId);

  const updatedRide = db.select().from(rides).where(eq(rides.id, rideId)).get()!;
  broadcastStationUpdate(endStationId);

  // Check alerts after ride end
  try {
    alertService.checkLowBattery();
    alertService.checkStationCapacity();
  } catch (_) { /* non-critical */ }

  return enrichRide(updatedRide);
}

export function getRideHistory(
  userId: string,
  page: number = 1,
  limit: number = 20,
): { rides: RideWithDetails[]; total: number; page: number; totalPages: number } {
  const offset = (page - 1) * limit;

  const totalResult = db
    .select({ count: sql<number>`count(*)` })
    .from(rides)
    .where(eq(rides.userId, userId))
    .get()!;
  const total = totalResult.count;

  const userRides = db
    .select()
    .from(rides)
    .where(eq(rides.userId, userId))
    .orderBy(desc(rides.startTime))
    .limit(limit)
    .offset(offset)
    .all();

  return {
    rides: userRides.map(enrichRide),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export function getRideById(rideId: string, userId: string): RideWithDetails {
  const ride = db.select().from(rides).where(eq(rides.id, rideId)).get();
  if (!ride) {
    throw { status: 404, error: 'Ride not found' };
  }
  if (ride.userId !== userId) {
    throw { status: 403, error: 'Not your ride' };
  }
  return enrichRide(ride);
}

// ─── Receipt ────────────────────────────────────────

export interface RideReceipt {
  rideId: string;
  date: string;
  startStation: string;
  endStation: string | null;
  durationMinutes: number | null;
  distanceKm: number | null;
  cost: number | null;
  currency: string;
  paymentStatus: string | null;
  paymentMethod: string | null;
  userName: string;
  userEmail: string;
}

export function getRideReceipt(rideId: string, userId: string): RideReceipt {
  const ride = db.select().from(rides).where(eq(rides.id, rideId)).get();
  if (!ride) {
    throw { status: 404, error: 'Ride not found' };
  }
  if (ride.userId !== userId) {
    throw { status: 403, error: 'Not your ride' };
  }
  if (ride.status !== 'completed') {
    throw { status: 400, error: 'Receipt only available for completed rides' };
  }

  const payment = db.select().from(payments).where(eq(payments.rideId, rideId)).get();

  // Get user info for receipt
  const user = db.select().from(users).where(eq(users.id, userId)).get();

  return {
    rideId: ride.id,
    date: ride.startTime,
    startStation: getStationName(ride.startStationId) ?? 'Unknown',
    endStation: getStationName(ride.endStationId),
    durationMinutes: ride.durationMinutes,
    distanceKm: ride.distanceKm,
    cost: ride.cost,
    currency: payment?.currency ?? 'USD',
    paymentStatus: payment?.status ?? null,
    paymentMethod: payment?.method ?? null,
    userName: user?.name ?? 'Unknown',
    userEmail: user?.email ?? 'Unknown',
  };
}

// ─── CSV Export ─────────────────────────────────────

export function exportRideHistoryCSV(userId: string, from: string, to: string): string {
  const userRides = db
    .select()
    .from(rides)
    .where(
      and(
        eq(rides.userId, userId),
        sql`${rides.startTime} >= ${from}`,
        sql`${rides.startTime} <= ${to}`,
      ),
    )
    .orderBy(desc(rides.startTime))
    .all();

  const header = 'ride_id,date,start_station,end_station,duration_minutes,distance_km,cost,payment_status';
  const rows = userRides.map((ride) => {
    const payment = db.select().from(payments).where(eq(payments.rideId, ride.id)).get();
    return [
      ride.id,
      ride.startTime,
      getStationName(ride.startStationId) ?? '',
      getStationName(ride.endStationId) ?? '',
      ride.durationMinutes ?? '',
      ride.distanceKm ?? '',
      ride.cost ?? '',
      payment?.status ?? '',
    ].join(',');
  });

  return [header, ...rows].join('\n');
}
