import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as stationService from '../services/station.service.js';

export const stationsRouter = Router();

const listQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().positive().default(10),
});

// ─── GET /api/stations ──────────────────────────────

stationsRouter.get('/', (req: Request, res: Response) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid query parameters',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { lat, lng, radius } = parsed.data;
    const stations = stationService.listStations(lat, lng, radius);
    res.json({ stations });
  } catch (err) {
    console.error('List stations error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/stations/:id ──────────────────────────

stationsRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const station = stationService.getStationById(id);
    if (!station) {
      res.status(404).json({ error: 'Station not found' });
      return;
    }
    res.json({ station });
  } catch (err) {
    console.error('Get station error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
