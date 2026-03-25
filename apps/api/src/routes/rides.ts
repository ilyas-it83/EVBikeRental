import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as rideService from '../services/ride.service.js';
import { requireAuth } from '../middleware/auth.js';

export const ridesRouter = Router();

ridesRouter.use(requireAuth);

// ─── Receipt & Export Schemas ───────────────────────

const exportSchema = z.object({
  from: z.string().min(1, 'from date is required'),
  to: z.string().min(1, 'to date is required'),
  format: z.enum(['csv']).default('csv'),
});

// ─── Validation Schemas ─────────────────────────────

const unlockSchema = z.object({
  bikeId: z.string().min(1, 'bikeId is required'),
  stationId: z.string().min(1, 'stationId is required'),
});

const endRideSchema = z.object({
  endStationId: z.string().min(1, 'endStationId is required'),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ─── POST /api/rides/unlock ─────────────────────────

ridesRouter.post('/unlock', (req: Request, res: Response) => {
  try {
    const parsed = unlockSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const ride = rideService.startRide(req.user!.id, parsed.data.bikeId, parsed.data.stationId);
    res.status(201).json({ ride });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: err.error });
      return;
    }
    console.error('Unlock ride error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/rides/active ──────────────────────────

ridesRouter.get('/active', (req: Request, res: Response) => {
  try {
    const ride = rideService.getActiveRide(req.user!.id);
    res.json({ ride });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: err.error });
      return;
    }
    console.error('Get active ride error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/rides/:id/end ────────────────────────

ridesRouter.post('/:id/end', (req: Request, res: Response) => {
  try {
    const parsed = endRideSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const ride = rideService.endRide(req.params.id as string, req.user!.id, parsed.data.endStationId);
    res.json({ ride });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: err.error });
      return;
    }
    console.error('End ride error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/rides ─────────────────────────────────

ridesRouter.get('/', (req: Request, res: Response) => {
  try {
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid query parameters',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { page, limit } = parsed.data;
    const result = rideService.getRideHistory(req.user!.id, page, limit);
    res.json(result);
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: err.error });
      return;
    }
    console.error('Get ride history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/rides/export ──────────────────────────

ridesRouter.get('/export', (req: Request, res: Response) => {
  try {
    const parsed = exportSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const csv = rideService.exportRideHistoryCSV(req.user!.id, parsed.data.from, parsed.data.to);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="rides-${parsed.data.from}-to-${parsed.data.to}.csv"`);
    res.send(csv);
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: err.error });
      return;
    }
    console.error('Export rides error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/rides/:id/receipt ─────────────────────

ridesRouter.get('/:id/receipt', (req: Request, res: Response) => {
  try {
    const receipt = rideService.getRideReceipt(req.params.id as string, req.user!.id);
    res.json({ receipt });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: err.error });
      return;
    }
    console.error('Get receipt error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/rides/:id ─────────────────────────────

ridesRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const ride = rideService.getRideById(req.params.id as string, req.user!.id);
    res.json({ ride });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: err.error });
      return;
    }
    console.error('Get ride error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
