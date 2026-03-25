import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../middleware/auth.js';
import * as alertService from '../services/alert.service.js';

export const alertsRouter = Router();

alertsRouter.use(requireAdmin);

// ─── Validation Schemas ─────────────────────────────

const listAlertsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(['low_battery', 'station_full', 'station_empty', 'maintenance_due', 'payment_failure']).optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  isRead: z.preprocess((v) => {
    if (v === 'true') return true;
    if (v === 'false') return false;
    return undefined;
  }, z.boolean().optional()),
});

// ─── Routes ─────────────────────────────────────────

alertsRouter.get('/', (req: Request, res: Response) => {
  try {
    const parsed = listAlertsSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const result = alertService.listAlerts(parsed.data);
    res.json(result);
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.error }); return; }
    console.error('List alerts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

alertsRouter.get('/count', (_req: Request, res: Response) => {
  try {
    const count = alertService.getUnreadCount();
    res.json({ count });
  } catch (err: any) {
    console.error('Alert count error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

alertsRouter.patch('/read-all', (_req: Request, res: Response) => {
  try {
    alertService.markAllAsRead();
    res.json({ message: 'All alerts marked as read' });
  } catch (err: any) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

alertsRouter.patch('/:id/read', (req: Request, res: Response) => {
  try {
    const alert = alertService.markAsRead(req.params.id as string);
    res.json({ alert });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.error }); return; }
    console.error('Mark alert read error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

alertsRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    alertService.dismissAlert(req.params.id as string);
    res.json({ message: 'Alert dismissed' });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.error }); return; }
    console.error('Dismiss alert error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
