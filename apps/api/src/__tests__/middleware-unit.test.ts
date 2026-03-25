/**
 * Auth Middleware Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import * as schema from '../db/schema.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'rider',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

const _dbRef: { current: ReturnType<typeof drizzle> | null } = { current: null };

vi.mock('../db/index.js', () => ({
  get db() { return _dbRef.current; },
}));

let sqlite: InstanceType<typeof Database>;

beforeEach(() => {
  sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.exec(SCHEMA_SQL);
  _dbRef.current = drizzle(sqlite, { schema });
});

afterEach(() => {
  sqlite.close();
  _dbRef.current = null;
});

import { requireAuth, requireAdmin } from '../middleware/auth.js';

function seedUser(id: string, role: string = 'rider') {
  const hash = bcrypt.hashSync('password', 10);
  sqlite.prepare(
    'INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)',
  ).run(id, `${id}@test.com`, `User ${id}`, hash, role);
}

function generateToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, JWT_SECRET, { expiresIn: '15m' });
}

function createMockReqRes(cookies: Record<string, string> = {}) {
  const req = {
    cookies,
    user: undefined as any,
  } as any;

  const res = {
    _status: 200,
    _body: null as any,
    status(code: number) {
      this._status = code;
      return this;
    },
    json(body: any) {
      this._body = body;
      return this;
    },
  } as any;

  return { req, res };
}

describe('Middleware: requireAuth', () => {
  it('returns 401 when no access_token cookie', async () => {
    
    const { req, res } = createMockReqRes({});
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res._status).toBe(401);
    expect(res._body.error).toContain('Authentication required');
    expect(next).not.toHaveBeenCalled();
  });

  it('sets req.user for valid token', async () => {
    
    seedUser('u1', 'rider');
    const token = generateToken('u1', 'rider');
    const { req, res } = createMockReqRes({ access_token: token });
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe('u1');
    expect(req.user.email).toBe('u1@test.com');
    expect(req.user.role).toBe('rider');
  });

  it('returns 401 for invalid token', async () => {
    
    const { req, res } = createMockReqRes({ access_token: 'invalid.token.value' });
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when user not found in DB', async () => {
    
    const token = generateToken('nonexistent', 'rider');
    const { req, res } = createMockReqRes({ access_token: token });
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res._status).toBe(401);
    expect(res._body.error).toContain('User not found');
    expect(next).not.toHaveBeenCalled();
  });
});

describe('Middleware: requireAdmin', () => {
  it('calls next for admin user', async () => {
    
    seedUser('admin1', 'admin');
    const token = generateToken('admin1', 'admin');
    const { req, res } = createMockReqRes({ access_token: token });
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.role).toBe('admin');
  });

  it('returns 403 for rider user', async () => {
    
    seedUser('rider1', 'rider');
    const token = generateToken('rider1', 'rider');
    const { req, res } = createMockReqRes({ access_token: token });
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(res._status).toBe(403);
    expect(res._body.error).toContain('Admin access required');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when no token', async () => {
    
    const { req, res } = createMockReqRes({});
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
