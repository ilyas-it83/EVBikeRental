import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../middleware/auth.js';
import * as adminService from '../services/admin.service.js';
import * as fleetService from '../services/fleet.service.js';
import * as analyticsService from '../services/analytics.service.js';

export const adminRouter = Router();

adminRouter.use(requireAdmin);

// ─── Validation Schemas ─────────────────────────────

const createStationSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  dockCapacity: z.number().int().positive(),
});

const updateStationSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  dockCapacity: z.number().int().positive().optional(),
});

const createBikeSchema = z.object({
  serialNumber: z.string().min(1),
  model: z.string().min(1),
  stationId: z.string().min(1),
  batteryLevel: z.number().int().min(0).max(100).optional(),
});

const updateBikeSchema = z.object({
  status: z.enum(['available', 'in_use', 'maintenance', 'retired', 'reserved']).optional(),
  stationId: z.string().optional(),
  batteryLevel: z.number().int().min(0).max(100).optional(),
  model: z.string().min(1).optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const bikeFilterSchema = z.object({
  stationId: z.string().optional(),
  status: z.string().optional(),
  lowBattery: z.coerce.boolean().optional(),
});

const updateRoleSchema = z.object({
  role: z.enum(['rider', 'admin']),
});

// ─── Station Routes ─────────────────────────────────

adminRouter.get('/stations', (_req: Request, res: Response) => {
  try {
    const stations = adminService.listAllStations();
    res.json({ stations });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.error }); return; }
    console.error('Admin list stations error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.post('/stations', (req: Request, res: Response) => {
  try {
    const parsed = createStationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }
    const station = adminService.createStation(parsed.data);
    res.status(201).json({ station });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.error }); return; }
    console.error('Admin create station error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.put('/stations/:id', (req: Request, res: Response) => {
  try {
    const parsed = updateStationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }
    const station = adminService.updateStation(req.params.id as string, parsed.data);
    res.json({ station });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.error }); return; }
    console.error('Admin update station error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.delete('/stations/:id', (req: Request, res: Response) => {
  try {
    const station = adminService.deleteStation(req.params.id as string);
    res.json({ station, message: 'Station deactivated' });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.error }); return; }
    console.error('Admin delete station error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Bike Routes ────────────────────────────────────

adminRouter.get('/bikes', (req: Request, res: Response) => {
  try {
    const parsed = bikeFilterSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten().fieldErrors });
      return;
    }
    const bikes = adminService.listAllBikes(parsed.data);
    res.json({ bikes });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.error }); return; }
    console.error('Admin list bikes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.post('/bikes', (req: Request, res: Response) => {
  try {
    const parsed = createBikeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }
    const bike = adminService.createBike(parsed.data);
    res.status(201).json({ bike });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.error }); return; }
    console.error('Admin create bike error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.put('/bikes/:id', (req: Request, res: Response) => {
  try {
    const parsed = updateBikeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }
    const bike = adminService.updateBike(req.params.id as string, parsed.data);
    res.json({ bike });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.error }); return; }
    console.error('Admin update bike error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.delete('/bikes/:id', (req: Request, res: Response) => {
  try {
    const bike = adminService.deleteBike(req.params.id as string);
    res.json({ bike, message: 'Bike retired' });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.error }); return; }
    console.error('Admin delete bike error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── User Routes ────────────────────────────────────

adminRouter.get('/users', (req: Request, res: Response) => {
  try {
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten().fieldErrors });
      return;
    }
    const result = adminService.listUsers(parsed.data.page, parsed.data.limit);
    res.json(result);
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.error }); return; }
    console.error('Admin list users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.put('/users/:id/role', (req: Request, res: Response) => {
  try {
    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }
    const user = adminService.updateUserRole(req.params.id as string, parsed.data.role);
    res.json({ user });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.error }); return; }
    console.error('Admin update user role error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.put('/users/:id/suspend', (req: Request, res: Response) => {
  try {
    const user = adminService.suspendUser(req.params.id as string);
    res.json({ user, message: 'User suspended' });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.error }); return; }
    console.error('Admin suspend user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Fleet Routes ───────────────────────────────────

adminRouter.get('/fleet/overview', (_req: Request, res: Response) => {
  try {
    const overview = fleetService.getFleetOverview();
    res.json({ overview });
  } catch (err: any) {
    console.error('Fleet overview error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.get('/fleet/stations', (_req: Request, res: Response) => {
  try {
    const stations = fleetService.getStationDetails();
    res.json({ stations });
  } catch (err: any) {
    console.error('Fleet station details error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Analytics Routes ───────────────────────────────

const daysSchema = z.object({
  days: z.coerce.number().int().positive().default(30),
});

const weeksSchema = z.object({
  weeks: z.coerce.number().int().positive().default(12),
});

const analyticsExportSchema = z.object({
  format: z.enum(['csv']).default('csv'),
  type: z.enum(['rides', 'revenue']),
});

adminRouter.get('/analytics/overview', (_req: Request, res: Response) => {
  try {
    const overview = analyticsService.getOverview();
    res.json({ overview });
  } catch (err: any) {
    console.error('Analytics overview error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.get('/analytics/rides-per-day', (req: Request, res: Response) => {
  try {
    const parsed = daysSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten().fieldErrors });
      return;
    }
    const data = analyticsService.getRidesPerDay(parsed.data.days);
    res.json({ data });
  } catch (err: any) {
    console.error('Rides per day error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.get('/analytics/revenue-per-week', (req: Request, res: Response) => {
  try {
    const parsed = weeksSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten().fieldErrors });
      return;
    }
    const data = analyticsService.getRevenuePerWeek(parsed.data.weeks);
    res.json({ data });
  } catch (err: any) {
    console.error('Revenue per week error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.get('/analytics/peak-hours', (_req: Request, res: Response) => {
  try {
    const data = analyticsService.getPeakHours();
    res.json({ data });
  } catch (err: any) {
    console.error('Peak hours error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.get('/analytics/export', (req: Request, res: Response) => {
  try {
    const parsed = analyticsExportSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const csv = parsed.data.type === 'rides'
      ? analyticsService.exportRidesCSV()
      : analyticsService.exportRevenueCSV();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${parsed.data.type}-export.csv"`);
    res.send(csv);
  } catch (err: any) {
    console.error('Analytics export error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
