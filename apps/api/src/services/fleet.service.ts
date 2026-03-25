import { db } from '../db/index.js';
import { stations, bikes, rides, payments } from '../db/schema.js';
import { eq, and, sql, gte } from 'drizzle-orm';

export function getFleetOverview() {
  const totalBikes = db.select({ count: sql<number>`count(*)` }).from(bikes).get()!.count;
  const totalStations = db.select({ count: sql<number>`count(*)` }).from(stations).where(eq(stations.status, 'active')).get()!.count;

  const activeBikes = db
    .select({ count: sql<number>`count(*)` })
    .from(bikes)
    .where(eq(bikes.status, 'in_use'))
    .get()!.count;

  const availableBikes = db
    .select({ count: sql<number>`count(*)` })
    .from(bikes)
    .where(eq(bikes.status, 'available'))
    .get()!.count;

  const maintenanceBikes = db
    .select({ count: sql<number>`count(*)` })
    .from(bikes)
    .where(eq(bikes.status, 'maintenance'))
    .get()!.count;

  const activeRides = db
    .select({ count: sql<number>`count(*)` })
    .from(rides)
    .where(eq(rides.status, 'active'))
    .get()!.count;

  // Today's date at midnight (UTC)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayStr = todayStart.toISOString();

  const completedRidesToday = db
    .select({ count: sql<number>`count(*)` })
    .from(rides)
    .where(and(eq(rides.status, 'completed'), gte(rides.endTime, todayStr)))
    .get()!.count;

  const revenueResult = db
    .select({ total: sql<number>`coalesce(sum(amount), 0)` })
    .from(payments)
    .where(and(eq(payments.status, 'completed'), gte(payments.createdAt, todayStr)))
    .get()!;

  return {
    totalBikes,
    totalStations,
    activeBikes,
    availableBikes,
    maintenanceBikes,
    activeRides,
    completedRidesToday,
    revenueToday: revenueResult.total,
  };
}

export function getStationDetails() {
  const allStations = db.select().from(stations).all();
  const allBikes = db.select().from(bikes).all();

  return allStations.map((station) => {
    const stationBikes = allBikes.filter((b) => b.stationId === station.id);
    const available = stationBikes.filter((b) => b.status === 'available').length;

    return {
      ...station,
      availableBikes: available,
      totalBikes: stationBikes.length,
      emptyDocks: station.dockCapacity - stationBikes.length,
      bikes: stationBikes.map((b) => ({
        id: b.id,
        serialNumber: b.serialNumber,
        model: b.model,
        status: b.status,
        batteryLevel: b.batteryLevel,
      })),
    };
  });
}
