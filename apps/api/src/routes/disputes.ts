import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import * as disputeService from '../services/dispute.service.js';

export const disputesRouter = Router();

// ─── Validation Schemas ─────────────────────────────

const createDisputeSchema = z.object({
  rideId: z.string().min(1, 'rideId is required'),
  reason: z.enum(['overcharge', 'bike_issue', 'wrong_station', 'other']),
  description: z.string().min(1, 'description is required'),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const adminFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['open', 'under_review', 'resolved', 'rejected']).optional(),
});

const updateDisputeSchema = z.object({
  status: z.enum(['open', 'under_review', 'resolved', 'rejected']),
  resolution: z.string().optional(),
});

// ─── Rider Routes ───────────────────────────────────

disputesRouter.post('/', requireAuth, (req: Request, res: Response) => {
  try {
    const parsed = createDisputeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const dispute = disputeService.createDispute(
      req.user!.id,
      parsed.data.rideId,
      parsed.data.reason,
      parsed.data.description,
    );
    res.status(201).json({ dispute });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.error }); return; }
    console.error('Create dispute error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

disputesRouter.get('/', requireAuth, (req: Request, res: Response) => {
  try {
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const result = disputeService.getUserDisputes(req.user!.id, parsed.data.page, parsed.data.limit);
    res.json(result);
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.error }); return; }
    console.error('List disputes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

disputesRouter.get('/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const dispute = disputeService.getDisputeById(req.params.id as string, req.user!.id);
    res.json({ dispute });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.error }); return; }
    console.error('Get dispute error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Admin Routes ───────────────────────────────────

disputesRouter.get('/admin/all', requireAdmin, (req: Request, res: Response) => {
  try {
    const parsed = adminFilterSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const result = disputeService.listAllDisputes(parsed.data.page, parsed.data.limit, parsed.data.status);
    res.json(result);
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.error }); return; }
    console.error('Admin list disputes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

disputesRouter.patch('/admin/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const parsed = updateDisputeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const dispute = disputeService.updateDisputeStatus(
      req.params.id as string,
      parsed.data.status,
      parsed.data.resolution,
    );
    res.json({ dispute });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.error }); return; }
    console.error('Admin update dispute error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
