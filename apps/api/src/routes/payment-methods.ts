import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { paymentMethods } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import crypto from 'crypto';

export const paymentMethodsRouter = Router();

paymentMethodsRouter.use(requireAuth);

// ─── Validation Schemas ─────────────────────────────

const addSchema = z.object({
  last4: z.string().length(4, 'last4 must be exactly 4 digits').regex(/^\d{4}$/, 'last4 must be numeric'),
  brand: z.string().min(1, 'brand is required'),
  expiryMonth: z.number().int().min(1).max(12),
  expiryYear: z.number().int().min(new Date().getFullYear()),
});

// ─── POST /api/payment-methods ──────────────────────

paymentMethodsRouter.post('/', (req: Request, res: Response) => {
  try {
    const parsed = addSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const userId = req.user!.id;
    const { last4, brand, expiryMonth, expiryYear } = parsed.data;

    // Check if user has any existing payment methods
    const existing = db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.userId, userId))
      .all();

    const isDefault = existing.length === 0; // First card is default

    const id = crypto.randomUUID();
    db.insert(paymentMethods)
      .values({
        id,
        userId,
        type: 'card',
        last4,
        brand,
        expiryMonth,
        expiryYear,
        isDefault,
      })
      .run();

    const method = db.select().from(paymentMethods).where(eq(paymentMethods.id, id)).get()!;
    res.status(201).json({ paymentMethod: method });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: err.error });
      return;
    }
    console.error('Add payment method error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/payment-methods ───────────────────────

paymentMethodsRouter.get('/', (req: Request, res: Response) => {
  try {
    const methods = db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.userId, req.user!.id))
      .all();

    res.json({ paymentMethods: methods });
  } catch (err: any) {
    console.error('List payment methods error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/payment-methods/:id ────────────────

paymentMethodsRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const methodId = req.params.id as string;

    const method = db
      .select()
      .from(paymentMethods)
      .where(and(eq(paymentMethods.id, methodId), eq(paymentMethods.userId, userId)))
      .get();

    if (!method) {
      res.status(404).json({ error: 'Payment method not found' });
      return;
    }

    const allMethods = db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.userId, userId))
      .all();

    // If deleting the default and others exist, promote another
    if (method.isDefault && allMethods.length > 1) {
      const next = allMethods.find((m) => m.id !== methodId)!;
      db.update(paymentMethods)
        .set({ isDefault: true })
        .where(eq(paymentMethods.id, next.id))
        .run();
    }

    db.delete(paymentMethods).where(eq(paymentMethods.id, methodId)).run();

    res.json({ message: 'Payment method deleted' });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: err.error });
      return;
    }
    console.error('Delete payment method error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/payment-methods/:id/default ───────────

paymentMethodsRouter.put('/:id/default', (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const methodId = req.params.id as string;

    const method = db
      .select()
      .from(paymentMethods)
      .where(and(eq(paymentMethods.id, methodId), eq(paymentMethods.userId, userId)))
      .get();

    if (!method) {
      res.status(404).json({ error: 'Payment method not found' });
      return;
    }

    // Unset all defaults for this user
    db.update(paymentMethods)
      .set({ isDefault: false })
      .where(eq(paymentMethods.userId, userId))
      .run();

    // Set new default
    db.update(paymentMethods)
      .set({ isDefault: true })
      .where(eq(paymentMethods.id, methodId))
      .run();

    const updated = db.select().from(paymentMethods).where(eq(paymentMethods.id, methodId)).get()!;
    res.json({ paymentMethod: updated });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: err.error });
      return;
    }
    console.error('Set default payment method error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
