import { db } from '../db/index.js';
import { alerts, bikes, stations } from '../db/schema.js';
import { eq, and, desc, sql, lt } from 'drizzle-orm';
import crypto from 'crypto';

// ─── Types ──────────────────────────────────────────

type AlertType = 'low_battery' | 'station_full' | 'station_empty' | 'maintenance_due' | 'payment_failure';
type AlertSeverity = 'info' | 'warning' | 'critical';

// ─── Helpers: Alert Generation ──────────────────────

export function checkLowBattery(): void {
  const lowBikes = db
    .select()
    .from(bikes)
    .where(and(lt(bikes.batteryLevel, 20), sql`${bikes.status} != 'retired'`))
    .all();

  for (const bike of lowBikes) {
    // Avoid duplicate alerts for same bike
    const existing = db
      .select()
      .from(alerts)
      .where(
        and(
          eq(alerts.type, 'low_battery'),
          eq(alerts.dismissed, false),
          sql`json_extract(${alerts.metadata}, '$.bikeId') = ${bike.id}`,
        ),
      )
      .get();

    if (!existing) {
      createAlert(
        'low_battery',
        bike.batteryLevel < 10 ? 'critical' : 'warning',
        `Bike ${bike.serialNumber} battery at ${bike.batteryLevel}%`,
        JSON.stringify({ bikeId: bike.id, serialNumber: bike.serialNumber, batteryLevel: bike.batteryLevel }),
      );
    }
  }
}

export function checkStationCapacity(): void {
  const allStations = db.select().from(stations).where(eq(stations.status, 'active')).all();
  const allBikes = db.select().from(bikes).all();

  for (const station of allStations) {
    const bikesAtStation = allBikes.filter((b) => b.stationId === station.id).length;

    // Station empty (0 bikes)
    if (bikesAtStation === 0) {
      const existing = db
        .select()
        .from(alerts)
        .where(
          and(
            eq(alerts.type, 'station_empty'),
            eq(alerts.dismissed, false),
            sql`json_extract(${alerts.metadata}, '$.stationId') = ${station.id}`,
          ),
        )
        .get();

      if (!existing) {
        createAlert(
          'station_empty',
          'warning',
          `Station "${station.name}" has no bikes available`,
          JSON.stringify({ stationId: station.id, stationName: station.name }),
        );
      }
    }

    // Station full (at dock capacity)
    if (bikesAtStation >= station.dockCapacity) {
      const existing = db
        .select()
        .from(alerts)
        .where(
          and(
            eq(alerts.type, 'station_full'),
            eq(alerts.dismissed, false),
            sql`json_extract(${alerts.metadata}, '$.stationId') = ${station.id}`,
          ),
        )
        .get();

      if (!existing) {
        createAlert(
          'station_full',
          'warning',
          `Station "${station.name}" is at full capacity (${station.dockCapacity}/${station.dockCapacity})`,
          JSON.stringify({ stationId: station.id, stationName: station.name, capacity: station.dockCapacity }),
        );
      }
    }
  }
}

// ─── Core Alert CRUD ────────────────────────────────

export function createAlert(
  type: AlertType,
  severity: AlertSeverity,
  message: string,
  metadata?: string,
): typeof alerts.$inferSelect {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.insert(alerts)
    .values({ id, type, severity, message, metadata: metadata ?? null, isRead: false, dismissed: false, createdAt: now })
    .run();

  return db.select().from(alerts).where(eq(alerts.id, id)).get()!;
}

export function listAlerts(filters: {
  type?: AlertType;
  severity?: AlertSeverity;
  isRead?: boolean;
  page?: number;
  limit?: number;
}): { alerts: (typeof alerts.$inferSelect)[]; total: number; page: number; totalPages: number } {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const offset = (page - 1) * limit;

  const conditions = [eq(alerts.dismissed, false)];
  if (filters.type) conditions.push(eq(alerts.type, filters.type));
  if (filters.severity) conditions.push(eq(alerts.severity, filters.severity));
  if (filters.isRead !== undefined) conditions.push(eq(alerts.isRead, filters.isRead));

  const where = conditions.length === 1 ? conditions[0] : and(...conditions);

  const total = db
    .select({ count: sql<number>`count(*)` })
    .from(alerts)
    .where(where)
    .get()!.count;

  const rows = db
    .select()
    .from(alerts)
    .where(where)
    .orderBy(desc(alerts.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return { alerts: rows, total, page, totalPages: Math.ceil(total / limit) };
}

export function getUnreadCount(): number {
  return db
    .select({ count: sql<number>`count(*)` })
    .from(alerts)
    .where(and(eq(alerts.isRead, false), eq(alerts.dismissed, false)))
    .get()!.count;
}

export function markAsRead(alertId: string): typeof alerts.$inferSelect {
  const alert = db.select().from(alerts).where(eq(alerts.id, alertId)).get();
  if (!alert) {
    throw { status: 404, error: 'Alert not found' };
  }

  db.update(alerts).set({ isRead: true }).where(eq(alerts.id, alertId)).run();
  return db.select().from(alerts).where(eq(alerts.id, alertId)).get()!;
}

export function markAllAsRead(): void {
  db.update(alerts)
    .set({ isRead: true })
    .where(and(eq(alerts.isRead, false), eq(alerts.dismissed, false)))
    .run();
}

export function dismissAlert(alertId: string): void {
  const alert = db.select().from(alerts).where(eq(alerts.id, alertId)).get();
  if (!alert) {
    throw { status: 404, error: 'Alert not found' };
  }

  db.update(alerts).set({ dismissed: true }).where(eq(alerts.id, alertId)).run();
}
