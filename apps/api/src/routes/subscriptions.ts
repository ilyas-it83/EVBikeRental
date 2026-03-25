import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import * as subscriptionService from '../services/subscription.service.js';

export const subscriptionsRouter = Router();

subscriptionsRouter.use(requireAuth);

const subscribeSchema = z.object({
  plan: z.enum(['free', 'monthly', 'annual']),
});

// ─── POST /api/subscriptions/subscribe ──────────────

subscriptionsRouter.post('/subscribe', (req: Request, res: Response) => {
  try {
    const parsed = subscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }
    const subscription = subscriptionService.subscribe(req.user!.id, parsed.data.plan);
    res.status(201).json({ subscription });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.error }); return; }
    console.error('Subscribe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/subscriptions/cancel ────────────────

subscriptionsRouter.delete('/cancel', (req: Request, res: Response) => {
  try {
    const subscription = subscriptionService.cancelSubscription(req.user!.id);
    res.json({ subscription, message: 'Subscription cancelled' });
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ error: err.error }); return; }
    console.error('Cancel subscription error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/subscriptions/current ─────────────────

subscriptionsRouter.get('/current', (req: Request, res: Response) => {
  try {
    const subscription = subscriptionService.getCurrentSubscription(req.user!.id);
    res.json({ subscription });
  } catch (err: any) {
    console.error('Get current subscription error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/subscriptions/plans ───────────────────

subscriptionsRouter.get('/plans', (_req: Request, res: Response) => {
  try {
    const plans = subscriptionService.getPlans();
    res.json({ plans });
  } catch (err: any) {
    console.error('Get plans error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
