import { db } from '../db/index.js';
import { reservations, bikes, stations } from '../db/schema.js';
import { eq, and, lte } from 'drizzle-orm';
import crypto from 'crypto';
import { broadcastStationUpdate } from '../websocket.js';

const RESERVATION_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export function reserveBike(userId: string, bikeId: string, stationId: string) {
  // Validate bike
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

  // Validate station
  const station = db.select().from(stations).where(eq(stations.id, stationId)).get();
  if (!station) {
    throw { status: 404, error: 'Station not found' };
  }

  // Check user has no active reservation
  const existing = db
    .select()
    .from(reservations)
    .where(and(eq(reservations.userId, userId), eq(reservations.status, 'active')))
    .get();
  if (existing) {
    throw { status: 400, error: 'You already have an active reservation' };
  }

  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + RESERVATION_DURATION_MS).toISOString();

  // Set bike to reserved
  db.update(bikes).set({ status: 'reserved' }).where(eq(bikes.id, bikeId)).run();

  // Create reservation
  db.insert(reservations)
    .values({ id, userId, bikeId, stationId, status: 'active', expiresAt })
    .run();

  broadcastStationUpdate(stationId);

  return db.select().from(reservations).where(eq(reservations.id, id)).get()!;
}

export function cancelReservation(reservationId: string, userId: string) {
  const reservation = db
    .select()
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .get();

  if (!reservation) {
    throw { status: 404, error: 'Reservation not found' };
  }
  if (reservation.userId !== userId) {
    throw { status: 403, error: 'Not your reservation' };
  }
  if (reservation.status !== 'active') {
    throw { status: 400, error: 'Reservation is not active' };
  }

  db.update(reservations)
    .set({ status: 'cancelled' })
    .where(eq(reservations.id, reservationId))
    .run();

  // Restore bike to available
  db.update(bikes)
    .set({ status: 'available' })
    .where(eq(bikes.id, reservation.bikeId))
    .run();

  broadcastStationUpdate(reservation.stationId);

  return db.select().from(reservations).where(eq(reservations.id, reservationId)).get()!;
}

export function getActiveReservation(userId: string) {
  const reservation = db
    .select()
    .from(reservations)
    .where(and(eq(reservations.userId, userId), eq(reservations.status, 'active')))
    .get();

  if (!reservation) return null;

  // Auto-expire if past expiresAt
  if (new Date(reservation.expiresAt) < new Date()) {
    db.update(reservations)
      .set({ status: 'expired' })
      .where(eq(reservations.id, reservation.id))
      .run();

    db.update(bikes)
      .set({ status: 'available' })
      .where(eq(bikes.id, reservation.bikeId))
      .run();

    broadcastStationUpdate(reservation.stationId);
    return null;
  }

  return reservation;
}

export function expireReservations() {
  const now = new Date().toISOString();
  const expired = db
    .select()
    .from(reservations)
    .where(and(eq(reservations.status, 'active'), lte(reservations.expiresAt, now)))
    .all();

  for (const reservation of expired) {
    db.update(reservations)
      .set({ status: 'expired' })
      .where(eq(reservations.id, reservation.id))
      .run();

    db.update(bikes)
      .set({ status: 'available' })
      .where(eq(bikes.id, reservation.bikeId))
      .run();

    broadcastStationUpdate(reservation.stationId);
  }

  if (expired.length > 0) {
    console.log(`[reservations] Expired ${expired.length} reservation(s)`);
  }
}
