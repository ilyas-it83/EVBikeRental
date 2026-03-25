/**
 * Auth Registration Tests
 *
 * Tests POST /api/auth/register endpoint against acceptance criteria.
 * Validates: happy path, duplicate email, weak passwords, invalid email,
 * missing fields, password not returned, password stored as bcrypt hash.
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
  SEED_USERS,
} from '../test/setup.js';

// ─── App Factory ────────────────────────────────────
// Since the actual auth routes haven't been built yet by Bender,
// we test against the expected route contract. Once implemented,
// these tests will import the real router.

let sqlite: Database.Database;
let app: express.Express;

function createTestApp(sqliteDb: Database.Database): express.Express {
  const testApp = express();
  testApp.use(express.json());
  testApp.use(cookieParser());

  // Expect Bender to export auth routes from this path
  // For now, we create a minimal mock that matches the expected contract
  // to validate test structure. Replace with real import when available:
  //   import { authRouter } from '../routes/auth.js';
  //   testApp.use('/api/auth', authRouter);

  testApp.post('/api/auth/register', async (req, res) => {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password || !name) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' },
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' },
      });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' },
      });
      return;
    }

    if (!/\d/.test(password)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Password must contain a number' },
      });
      return;
    }

    // Check duplicate
    const existing = sqliteDb.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'Email already registered' },
      });
      return;
    }

    // Create user
    const id = `user-${Date.now()}`;
    const passwordHash = await bcrypt.hash(password, 10);
    sqliteDb
      .prepare('INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(id, email, name, passwordHash, 'rider');

    res.cookie('access_token', 'test-token', { httpOnly: true });
    res.cookie('refresh_token', 'test-refresh', { httpOnly: true });
    res.status(201).json({
      success: true,
      data: { user: { id, email, name, role: 'rider' } },
    });
  });

  return testApp;
}

// ─── Tests ──────────────────────────────────────────

describe('POST /api/auth/register', () => {
  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
  });

  afterEach(() => {
    sqlite.close();
  });

  it('should create a user with valid input and return 201', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'newuser@example.com',
      password: 'StrongPass1',
      name: 'New User',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe('newuser@example.com');
    expect(res.body.data.user.name).toBe('New User');
    expect(res.body.data.user.role).toBe('rider');
  });

  it('should set httpOnly cookies on successful registration', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'newuser@example.com',
      password: 'StrongPass1',
      name: 'New User',
    });

    expect(res.status).toBe(201);
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(Array.isArray(cookies) ? cookies.join(';') : cookies).toContain('access_token');
    expect(Array.isArray(cookies) ? cookies.join(';') : cookies).toContain('refresh_token');
  });

  it('should reject duplicate email with 409 Conflict', async () => {
    // First registration
    await request(app).post('/api/auth/register').send({
      email: 'dupe@example.com',
      password: 'StrongPass1',
      name: 'First User',
    });

    // Duplicate
    const res = await request(app).post('/api/auth/register').send({
      email: 'dupe@example.com',
      password: 'StrongPass1',
      name: 'Second User',
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('should reject password without a number with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'user@example.com',
      password: 'NoNumbersHere',
      name: 'User',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject password shorter than 8 characters with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'user@example.com',
      password: 'Ab1',
      name: 'User',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject invalid email format with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'not-an-email',
      password: 'StrongPass1',
      name: 'User',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject missing required fields with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'user@example.com',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should NEVER return password in response', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'secure@example.com',
      password: 'StrongPass1',
      name: 'Secure User',
    });

    expect(res.status).toBe(201);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('StrongPass1');
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.user.password_hash).toBeUndefined();
  });

  it('should store password as bcrypt hash, not plaintext', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'hash-check@example.com',
      password: 'StrongPass1',
      name: 'Hash User',
    });

    const row = sqlite
      .prepare('SELECT password_hash FROM users WHERE email = ?')
      .get('hash-check@example.com') as { password_hash: string } | undefined;

    expect(row).toBeDefined();
    expect(row!.password_hash).not.toBe('StrongPass1');
    expect(row!.password_hash).toMatch(/^\$2[aby]?\$/); // bcrypt prefix
    const isValid = await bcrypt.compare('StrongPass1', row!.password_hash);
    expect(isValid).toBe(true);
  });
});
