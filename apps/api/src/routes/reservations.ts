import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import * as reservationService from '../services/reservation.service.js';

export const reservationsRouter = Router();

reservationsRouter.use(requireAuth);

const reserveSchema = z.object({
  bikeId: z.string().min(1, 'bikeId is required'),
  stationId: z.string().min(1, 'stationId is required'),
});

// ─── POST /api/reservations ─────────────────────────

reservationsRouter.post('/', (req: Request, res: Response) => {
  try {
    const parsed = reserveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }
    const reservation = reservationService.reserveBike(req.user!.id, parsed.data.bikeId, parsed.data.stationId);
    res.status(201).json({ reservation });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.error }); return; }
    console.error('Reserve bike error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/reservations/:id ───────────────────

reservationsRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const reservation = reservationService.cancelReservation(req.params.id as string, req.user!.id);
    res.json({ reservation, message: 'Reservation cancelled' });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.error }); return; }
    console.error('Cancel reservation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/reservations/active ───────────────────

reservationsRouter.get('/active', (req: Request, res: Response) => {
  try {
    const reservation = reservationService.getActiveReservation(req.user!.id);
    res.json({ reservation });
  } catch (err: any) {
    console.error('Get active reservation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
