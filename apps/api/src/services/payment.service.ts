import { db } from '../db/index.js';
import { payments, paymentMethods } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

// ─── Payment Adapter Interface ──────────────────────

export interface PaymentAdapter {
  charge(amount: number, currency: string): { success: boolean; transactionId: string };
  refund(transactionId: string, amount: number): { success: boolean };
  preAuthorize(amount: number, currency: string): { success: boolean; authId: string };
}

// ─── Mock Payment Adapter ───────────────────────────

export class MockPaymentAdapter implements PaymentAdapter {
  charge(amount: number, _currency: string): { success: boolean; transactionId: string } {
    console.log(`[payment] Mock charge: $${amount}`);
    return { success: true, transactionId: `mock_txn_${crypto.randomUUID()}` };
  }

  refund(transactionId: string, amount: number): { success: boolean } {
    console.log(`[payment] Mock refund: $${amount} for ${transactionId}`);
    return { success: true };
  }

  preAuthorize(amount: number, _currency: string): { success: boolean; authId: string } {
    console.log(`[payment] Mock pre-auth: $${amount}`);
    return { success: true, authId: `mock_auth_${crypto.randomUUID()}` };
  }
}

const adapter: PaymentAdapter = new MockPaymentAdapter();

// ─── Public API ─────────────────────────────────────

export function processPayment(
  userId: string,
  rideId: string,
  amount: number,
): typeof payments.$inferSelect {
  const result = adapter.charge(amount, 'USD');
  if (!result.success) {
    throw { status: 402, error: 'Payment failed' };
  }

  // Find user's default payment method
  const defaultMethod = db
    .select()
    .from(paymentMethods)
    .where(and(eq(paymentMethods.userId, userId), eq(paymentMethods.isDefault, true)))
    .get();

  const id = crypto.randomUUID();
  db.insert(payments)
    .values({
      id,
      userId,
      rideId,
      amount,
      currency: 'USD',
      status: 'completed',
      method: defaultMethod ? `${defaultMethod.brand} ****${defaultMethod.last4}` : null,
    })
    .run();

  return db.select().from(payments).where(eq(payments.id, id)).get()!;
}

export function refundPayment(paymentId: string): typeof payments.$inferSelect {
  const payment = db.select().from(payments).where(eq(payments.id, paymentId)).get();
  if (!payment) {
    throw { status: 404, error: 'Payment not found' };
  }

  const result = adapter.refund(paymentId, payment.amount);
  if (!result.success) {
    throw { status: 500, error: 'Refund failed' };
  }

  db.update(payments).set({ status: 'refunded' }).where(eq(payments.id, paymentId)).run();

  return db.select().from(payments).where(eq(payments.id, paymentId)).get()!;
}
