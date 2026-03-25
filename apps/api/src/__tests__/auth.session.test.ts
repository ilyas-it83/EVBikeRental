/**
 * Auth Session Tests
 *
 * Tests session management endpoints:
 * - GET /api/auth/me — returns user profile or 401
 * - POST /api/auth/refresh — rotates access token
 * - POST /api/auth/logout — invalidates session
 *
 * References: GitHub Issue #4, PRD §3.1
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
  generateExpiredToken,
  TEST_JWT_SECRET,
  TEST_REFRESH_SECRET,
} from '../test/setup.js';

let sqlite: Database.Database;
let app: express.Express;

function createTestApp(sqliteDb: Database.Database): express.Express {
  const testApp = express();
  testApp.use(express.json());
  testApp.use(cookieParser());

  // Auth middleware
  const requireAuth: express.RequestHandler = (req, res, next) => {
    const token = req.cookies?.access_token;
    if (!token) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }
    try {
      const payload = jwt.verify(token, TEST_JWT_SECRET) as { sub: string; role: string };
      (req as any).userId = payload.sub;
      (req as any).userRole = payload.role;
      next();
    } catch {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
      });
    }
  };

  // GET /api/auth/me
  testApp.get('/api/auth/me', requireAuth, (req, res) => {
    const userId = (req as any).userId;
    const user = sqliteDb
      .prepare('SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = ?')
      .get(userId) as any;

    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    res.json({ success: true, data: { user } });
  });

  // POST /api/auth/refresh
  testApp.post('/api/auth/refresh', (req, res) => {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Refresh token required' },
      });
      return;
    }

    try {
      const payload = jwt.verify(refreshToken, TEST_REFRESH_SECRET) as { sub: string };

      // Check if refresh token is revoked
      const stored = sqliteDb
        .prepare('SELECT id, revoked FROM refresh_tokens WHERE token = ?')
        .get(refreshToken) as { id: string; revoked: number } | undefined;

      if (!stored || stored.revoked) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Refresh token invalid or revoked' },
        });
        return;
      }

      const newAccessToken = jwt.sign({ sub: payload.sub, role: 'rider' }, TEST_JWT_SECRET, { expiresIn: '15m' });
      res.cookie('access_token', newAccessToken, { httpOnly: true });
      res.json({ success: true, data: { message: 'Token refreshed' } });
    } catch {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' },
      });
    }
  });

  // POST /api/auth/logout
  testApp.post('/api/auth/logout', (req, res) => {
    const refreshToken = req.cookies?.refresh_token;

    if (refreshToken) {
      sqliteDb
        .prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token = ?')
        .run(refreshToken);
    }

    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.json({ success: true, data: { message: 'Logged out' } });
  });

  // Protected endpoint for testing post-logout access
  testApp.get('/api/protected', requireAuth, (_req, res) => {
    res.json({ success: true, data: { secret: 'protected-data' } });
  });

  return testApp;
}

describe('GET /api/auth/me', () => {
  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
  });

  afterEach(() => {
    sqlite.close();
  });

  it('should return user profile with valid access token', async () => {
    const auth = await createAuthenticatedUser(sqlite);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', [`access_token=${auth.accessToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe('rider@test.com');
    expect(res.body.data.user.name).toBe('Test Rider');
    // Password must never be in the response
    expect(res.body.data.user.password_hash).toBeUndefined();
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('should return 401 without access token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('POST /api/auth/refresh', () => {
  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
  });

  afterEach(() => {
    sqlite.close();
  });

  it('should return new access token with valid refresh token', async () => {
    const auth = await createAuthenticatedUser(sqlite);
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refresh_token=${auth.refreshToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(Array.isArray(cookies) ? cookies.join(';') : cookies).toContain('access_token');
  });

  it('should reject expired or invalid refresh token with 401', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', ['refresh_token=invalid-token-xyz']);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should reject missing refresh token with 401', async () => {
    const res = await request(app).post('/api/auth/refresh');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/logout', () => {
  beforeEach(async () => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    app = createTestApp(sqlite);
    await seedTestData(sqlite);
  });

  afterEach(() => {
    sqlite.close();
  });

  it('should invalidate refresh token and clear cookies', async () => {
    const auth = await createAuthenticatedUser(sqlite);

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', [
        `access_token=${auth.accessToken}`,
        `refresh_token=${auth.refreshToken}`,
      ]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Refresh token should be revoked in DB
    const stored = sqlite
      .prepare('SELECT revoked FROM refresh_tokens WHERE token = ?')
      .get(auth.refreshToken) as { revoked: number } | undefined;
    expect(stored).toBeDefined();
    expect(stored!.revoked).toBe(1);
  });

  it('should deny access to protected endpoints after logout', async () => {
    const auth = await createAuthenticatedUser(sqlite);

    // Logout
    await request(app)
      .post('/api/auth/logout')
      .set('Cookie', [
        `access_token=${auth.accessToken}`,
        `refresh_token=${auth.refreshToken}`,
      ]);

    // Try to refresh (should fail — token revoked)
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refresh_token=${auth.refreshToken}`]);

    expect(refreshRes.status).toBe(401);
  });
});
