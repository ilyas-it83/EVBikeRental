import { db } from '../db/index.js';
import { rides, payments, users, bikes } from '../db/schema.js';
import { eq, and, gte, sql } from 'drizzle-orm';

// ─── Overview ───────────────────────────────────────

export function getOverview() {
  const totalRides = db.select({ count: sql<number>`count(*)` }).from(rides).get()!.count;

  const totalRevenue = db
    .select({ total: sql<number>`coalesce(sum(amount), 0)` })
    .from(payments)
    .where(eq(payments.status, 'completed'))
    .get()!.total;

  // Active users: users who have at least one ride
  const activeUsers = db
    .select({ count: sql<number>`count(distinct ${rides.userId})` })
    .from(rides)
    .get()!.count;

  // Fleet utilization: bikes in_use / total non-retired bikes
  const totalBikes = db
    .select({ count: sql<number>`count(*)` })
    .from(bikes)
    .where(sql`${bikes.status} != 'retired'`)
    .get()!.count;

  const inUseBikes = db
    .select({ count: sql<number>`count(*)` })
    .from(bikes)
    .where(eq(bikes.status, 'in_use'))
    .get()!.count;

  const fleetUtilization = totalBikes > 0 ? Math.round((inUseBikes / totalBikes) * 10000) / 100 : 0;

  return { totalRides, totalRevenue, activeUsers, fleetUtilization };
}

// ─── Rides Per Day ──────────────────────────────────

export function getRidesPerDay(days: number = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString();

  const rows = db
    .select({
      date: sql<string>`date(${rides.startTime})`,
      count: sql<number>`count(*)`,
    })
    .from(rides)
    .where(gte(rides.startTime, sinceStr))
    .groupBy(sql`date(${rides.startTime})`)
    .orderBy(sql`date(${rides.startTime})`)
    .all();

  return rows;
}

// ─── Revenue Per Week ───────────────────────────────

export function getRevenuePerWeek(weeks: number = 12) {
  const since = new Date();
  since.setDate(since.getDate() - weeks * 7);
  const sinceStr = since.toISOString();

  const rows = db
    .select({
      week: sql<string>`strftime('%Y-W%W', ${payments.createdAt})`,
      revenue: sql<number>`coalesce(sum(${payments.amount}), 0)`,
    })
    .from(payments)
    .where(and(eq(payments.status, 'completed'), gte(payments.createdAt, sinceStr)))
    .groupBy(sql`strftime('%Y-W%W', ${payments.createdAt})`)
    .orderBy(sql`strftime('%Y-W%W', ${payments.createdAt})`)
    .all();

  return rows;
}

// ─── Peak Hours ─────────────────────────────────────

export function getPeakHours() {
  const rows = db
    .select({
      hour: sql<number>`cast(strftime('%H', ${rides.startTime}) as integer)`,
      count: sql<number>`count(*)`,
    })
    .from(rides)
    .groupBy(sql`strftime('%H', ${rides.startTime})`)
    .orderBy(sql`cast(strftime('%H', ${rides.startTime}) as integer)`)
    .all();

  return rows;
}

// ─── CSV Export ─────────────────────────────────────

export function exportRidesCSV(): string {
  const allRides = db.select().from(rides).orderBy(sql`${rides.startTime} desc`).all();

  const header = 'id,user_id,bike_id,start_station_id,end_station_id,start_time,end_time,duration_minutes,distance_km,cost,status';
  const rows = allRides.map((r) =>
    [r.id, r.userId, r.bikeId, r.startStationId, r.endStationId ?? '', r.startTime, r.endTime ?? '', r.durationMinutes ?? '', r.distanceKm ?? '', r.cost ?? '', r.status].join(','),
  );

  return [header, ...rows].join('\n');
}

export function exportRevenueCSV(): string {
  const allPayments = db
    .select()
    .from(payments)
    .where(eq(payments.status, 'completed'))
    .orderBy(sql`${payments.createdAt} desc`)
    .all();

  const header = 'id,user_id,ride_id,amount,currency,method,created_at';
  const rows = allPayments.map((p) =>
    [p.id, p.userId, p.rideId, p.amount, p.currency, p.method ?? '', p.createdAt].join(','),
  );

  return [header, ...rows].join('\n');
}
