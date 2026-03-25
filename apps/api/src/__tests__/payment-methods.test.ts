/**
 * Payment Method API Tests
 *
 * Tests payment method CRUD endpoints:
 * - POST /api/payment-methods — add a payment method
 * - GET /api/payment-methods — list user's methods
 * - DELETE /api/payment-methods/:id — remove a method
 * - PUT /api/payment-methods/:id/default — set as default
 *
 * References: Sprint 2, PRD §3.4
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import {
  createTestDb,
  seedTestData,
  createAuthenticatedUser,
  seedPaymentMethod,
  TEST_JWT_SECRET,
} from '../test/setup.js';

let sqlite: Database.Database;
let app: express.Express;

// ─── Auth middleware ─────────────────────────────────

function testAuth(sqliteDb: Database.Database) {
  return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const token = req.cookies?.access_token;
    if (!token) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }
    try {
      const payload = jwt.verify(token, TEST_JWT_SECRET) as { sub: string; role: string };
      const user = sqliteDb.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(payload.sub) as any;
      if (!user) { res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not found' } }); return; }
      (req as any).user = user;
      next();
    } catch {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    }
  };
}

// ─── Test Express app ───────────────────────────────

function createTestApp(sqliteDb: Database.Database): express.Express {
  const testApp = express();
  testApp.use(express.json());
  testApp.use(cookieParser());
  const auth = testAuth(sqliteDb);

  // POST /api/payment-methods — add a payment method
  testApp.post('/api/payment-methods', auth, (req, res) => {
    const user = (req as any).user;
    const { last4, brand, expiryMonth, expiryYear } = req.body;

    if (!last4 || !brand || !expiryMonth || !expiryYear) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } });
      return;
    }

    // Check if user has any existing methods
    const existingCount = (sqliteDb.prepare(
      'SELECT COUNT(*) as count FROM payment_methods WHERE user_id = ?',
    ).get(user.id) as { count: number }).count;

    const isDefault = existingCount === 0 ? 1 : 0;

    const id = `pm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    sqliteDb.prepare(
      'INSERT INTO payment_methods (id, user_id, type, last4, brand, expiry_month, expiry_year, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(id, user.id, 'card', last4, brand, expiryMonth, expiryYear, isDefault);

    const method = sqliteDb.prepare('SELECT * FROM payment_methods WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: { paymentMethod: method } });
  });

  // GET /api/payment-methods — list user's methods
  testApp.get('/api/payment-methods', auth, (req, res) => {
    const user = (req as any).user;
    const methods = sqliteDb.prepare(
      'SELECT * FROM payment_methods WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
    ).all(user.id);

    res.json({ success: true, data: { paymentMethods: methods } });
  });

  // DELETE /api/payment-methods/:id — remove a method
  testApp.delete('/api/payment-methods/:id', auth, (req, res) => {
    const user = (req as any).user;
    const method = sqliteDb.prepare(
      'SELECT * FROM payment_methods WHERE id = ? AND user_id = ?',
    ).get(req.params.id, user.id) as any;

    if (!method) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment method not found' } });
      return;
    }

    // Delete the method
    sqliteDb.prepare('DELETE FROM payment_methods WHERE id = ?').run(req.params.id);

    // If it was the default, promote the next one
    if (method.is_default) {
      const next = sqliteDb.prepare(
        'SELECT id FROM payment_methods WHERE user_id = ? ORDER BY created_at ASC LIMIT 1',
      ).get(user.id) as any;
      if (next) {
        sqliteDb.prepare('UPDATE payment_methods SET is_default = 1 WHERE id = ?').run(next.id);
      }
    }

    res.json({ success: true, data: { deleted: true } });
  });

  // PUT /api/payment-methods/:id/default — set as default
  testApp.put('/api/payment-methods/:id/default', auth, (req, res) => {
    const user = (req as any).user;
    const method = sqliteDb.prepare(
      'SELECT * FROM payment_methods WHERE id = ? AND user_id = ?',
    ).get(req.params.id, user.id) as any;

    if (!method) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment method not found' } });
      return;
    }

    // Unset all defaults for this user
    sqliteDb.prepare('UPDATE payment_methods SET is_default = 0 WHERE user_id = ?').run(user.id);
    // Set this one as default
    sqliteDb.prepare('UPDATE payment_methods SET is_default = 1 WHERE id = ?').run(req.params.id);

    const updated = sqliteDb.prepare('SELECT * FROM payment_methods WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: { paymentMethod: updated } });
  });

  return testApp;
}

// ─── Tests ──────────────────────────────────────────

describe('POST /api/payment-methods — add payment method', () => {
  let cookieHeader: string;
  let userId: string;

  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
    const auth = await createAuthenticatedUser(sqlite);
    cookieHeader = auth.cookieHeader;
    userId = auth.user.id;
  });

  afterEach(() => {
    sqlite.close();
  });

  it('should create a payment method and auto-set as default if first', async () => {
    const res = await request(app)
      .post('/api/payment-methods')
      .set('Cookie', cookieHeader)
      .send({ last4: '4242', brand: 'Visa', expiryMonth: 12, expiryYear: 2026 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.paymentMethod).toBeDefined();
    expect(res.body.data.paymentMethod.last4).toBe('4242');
    expect(res.body.data.paymentMethod.brand).toBe('Visa');
    expect(res.body.data.paymentMethod.is_default).toBe(1);
    expect(res.body.data.paymentMethod.user_id).toBe(userId);
  });

  it('should not auto-set as default if user already has methods', async () => {
    // Add first method (will be default)
    await request(app)
      .post('/api/payment-methods')
      .set('Cookie', cookieHeader)
      .send({ last4: '4242', brand: 'Visa', expiryMonth: 12, expiryYear: 2026 });

    // Add second method (should NOT be default)
    const res = await request(app)
      .post('/api/payment-methods')
      .set('Cookie', cookieHeader)
      .send({ last4: '5555', brand: 'Mastercard', expiryMonth: 6, expiryYear: 2027 });

    expect(res.status).toBe(201);
    expect(res.body.data.paymentMethod.is_default).toBe(0);
  });

  it('should reject missing fields (400)', async () => {
    const res = await request(app)
      .post('/api/payment-methods')
      .set('Cookie', cookieHeader)
      .send({ last4: '4242' }); // missing brand, expiryMonth, expiryYear

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should require authentication (401)', async () => {
    const res = await request(app)
      .post('/api/payment-methods')
      .send({ last4: '4242', brand: 'Visa', expiryMonth: 12, expiryYear: 2026 });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/payment-methods — list methods', () => {
  let cookieHeader: string;
  let userId: string;

  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
    const auth = await createAuthenticatedUser(sqlite);
    cookieHeader = auth.cookieHeader;
    userId = auth.user.id;
  });

  afterEach(() => {
    sqlite.close();
  });

  it('should return only the user\'s payment methods', async () => {
    seedPaymentMethod(sqlite, userId, { id: 'pm-user-1', last4: '4242', isDefault: true });
    seedPaymentMethod(sqlite, userId, { id: 'pm-user-2', last4: '5555' });

    // Seed a method for another user
    const auth2 = await createAuthenticatedUser(sqlite, {
      id: 'user-other-pm',
      email: 'otherpm@test.com',
      name: 'Other',
      role: 'rider',
      password: 'OtherPass123',
    });
    seedPaymentMethod(sqlite, 'user-other-pm', { id: 'pm-other-1', last4: '9999' });

    const res = await request(app)
      .get('/api/payment-methods')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.paymentMethods).toHaveLength(2);
    for (const pm of res.body.data.paymentMethods) {
      expect(pm.user_id).toBe(userId);
    }
  });

  it('should return empty list when no methods exist', async () => {
    const res = await request(app)
      .get('/api/payment-methods')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.paymentMethods).toHaveLength(0);
  });

  it('should require authentication (401)', async () => {
    const res = await request(app).get('/api/payment-methods');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/payment-methods/:id — remove method', () => {
  let cookieHeader: string;
  let userId: string;

  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
    const auth = await createAuthenticatedUser(sqlite);
    cookieHeader = auth.cookieHeader;
    userId = auth.user.id;
  });

  afterEach(() => {
    sqlite.close();
  });

  it('should delete a non-default payment method', async () => {
    seedPaymentMethod(sqlite, userId, { id: 'pm-def', isDefault: true });
    seedPaymentMethod(sqlite, userId, { id: 'pm-nondef' });

    const res = await request(app)
      .delete('/api/payment-methods/pm-nondef')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);

    // Verify it's gone
    const remaining = sqlite.prepare('SELECT * FROM payment_methods WHERE user_id = ?').all(userId);
    expect(remaining).toHaveLength(1);
  });

  it('should promote another method when default is deleted', async () => {
    seedPaymentMethod(sqlite, userId, { id: 'pm-def', isDefault: true });
    seedPaymentMethod(sqlite, userId, { id: 'pm-next' });

    await request(app)
      .delete('/api/payment-methods/pm-def')
      .set('Cookie', cookieHeader);

    // pm-next should now be the default
    const promoted = sqlite.prepare('SELECT * FROM payment_methods WHERE id = ?').get('pm-next') as any;
    expect(promoted.is_default).toBe(1);
  });

  it('should return 404 for non-existent payment method', async () => {
    const res = await request(app)
      .delete('/api/payment-methods/pm-nonexistent')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('should not allow deleting another user\'s method', async () => {
    // Seed a method for another user
    await createAuthenticatedUser(sqlite, {
      id: 'user-other-del',
      email: 'otherdel@test.com',
      name: 'Other',
      role: 'rider',
      password: 'OtherPass123',
    });
    seedPaymentMethod(sqlite, 'user-other-del', { id: 'pm-other-del' });

    const res = await request(app)
      .delete('/api/payment-methods/pm-other-del')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(404); // Returns 404 (not 403) to avoid revealing existence
  });
});

describe('PUT /api/payment-methods/:id/default — set as default', () => {
  let cookieHeader: string;
  let userId: string;

  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
    const auth = await createAuthenticatedUser(sqlite);
    cookieHeader = auth.cookieHeader;
    userId = auth.user.id;
  });

  afterEach(() => {
    sqlite.close();
  });

  it('should set the specified method as default and unset others', async () => {
    seedPaymentMethod(sqlite, userId, { id: 'pm-old-def', isDefault: true });
    seedPaymentMethod(sqlite, userId, { id: 'pm-new-def' });

    const res = await request(app)
      .put('/api/payment-methods/pm-new-def/default')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.paymentMethod.is_default).toBe(1);

    // Old default should be unset
    const oldDef = sqlite.prepare('SELECT * FROM payment_methods WHERE id = ?').get('pm-old-def') as any;
    expect(oldDef.is_default).toBe(0);
  });

  it('should return 404 for non-existent method', async () => {
    const res = await request(app)
      .put('/api/payment-methods/pm-nonexistent/default')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(404);
  });

  it('should require authentication (401)', async () => {
    const res = await request(app).put('/api/payment-methods/pm-123/default');
    expect(res.status).toBe(401);
  });
});
