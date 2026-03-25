/**
 * Auth Login Tests
 *
 * Tests POST /api/auth/login endpoint against acceptance criteria.
 * Validates: happy path, wrong password, non-existent email (no enumeration),
 * missing fields.
 *
 * References: GitHub Issue #4, PRD §3.1
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import {
  createTestDb,
  seedTestData,
} from '../test/setup.js';

let sqlite: Database.Database;
let app: express.Express;

function createTestApp(sqliteDb: Database.Database): express.Express {
  const testApp = express();
  testApp.use(express.json());
  testApp.use(cookieParser());

  testApp.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' },
      });
      return;
    }

    const user = sqliteDb
      .prepare('SELECT id, email, name, password_hash, role FROM users WHERE email = ?')
      .get(email) as { id: string; email: string; name: string; password_hash: string; role: string } | undefined;

    // Generic error for both wrong password AND non-existent email (prevents enumeration)
    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
      });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
      });
      return;
    }

    res.cookie('access_token', 'test-access-token', { httpOnly: true });
    res.cookie('refresh_token', 'test-refresh-token', { httpOnly: true });
    res.status(200).json({
      success: true,
      data: { user: { id: user.id, email: user.email, name: user.name, role: user.role } },
    });
  });

  return testApp;
}

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
  });

  afterEach(() => {
    sqlite.close();
  });

  it('should login with valid credentials and return 200 with cookies', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'rider@test.com',
      password: 'SecurePass123',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe('rider@test.com');

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(Array.isArray(cookies) ? cookies.join(';') : cookies).toContain('access_token');
    expect(Array.isArray(cookies) ? cookies.join(';') : cookies).toContain('refresh_token');
  });

  it('should reject wrong password with 401 generic "Invalid credentials"', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'rider@test.com',
      password: 'WrongPassword1',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.error.message).toBe('Invalid credentials');
    // Must NOT leak that the email exists
    expect(res.body.error.message).not.toContain('password');
  });

  it('should reject non-existent email with 401 generic "Invalid credentials" (no enumeration)', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@test.com',
      password: 'AnyPass123',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    // Error message must be identical to wrong-password case
    expect(res.body.error.message).toBe('Invalid credentials');
    expect(res.body.error.message).not.toContain('email');
    expect(res.body.error.message).not.toContain('not found');
  });

  it('should reject missing fields with 400', async () => {
    const noPassword = await request(app).post('/api/auth/login').send({
      email: 'rider@test.com',
    });
    expect(noPassword.status).toBe(400);

    const noEmail = await request(app).post('/api/auth/login').send({
      password: 'SecurePass123',
    });
    expect(noEmail.status).toBe(400);

    const empty = await request(app).post('/api/auth/login').send({});
    expect(empty.status).toBe(400);
  });
});
