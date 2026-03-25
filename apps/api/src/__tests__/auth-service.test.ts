/**
 * Auth Service Unit Tests
 *
 * Tests auth.service.ts functions directly:
 * - register: creates user with hashed password
 * - register: duplicate email throws 409
 * - login: correct password returns tokens
 * - login: wrong password throws 401
 * - refresh: valid token returns new tokens
 * - refresh: expired token throws 401
 * - logout: deletes refresh token
 * - getUserById: returns profile without passwordHash
 * - getUserById: non-existent returns null
 * - verifyAccessToken: valid → returns payload
 * - verifyAccessToken: invalid → throws
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema.js';

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

// Mutable db reference that the mock returns
const _dbRef: { current: ReturnType<typeof drizzle> | null } = { current: null };

vi.mock('../db/index.js', () => ({
  get db() {
    return _dbRef.current;
  },
}));

let sqlite: InstanceType<typeof Database>;

beforeEach(() => {
  sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(SCHEMA_SQL);
  _dbRef.current = drizzle(sqlite, { schema });
});

afterEach(() => {
  sqlite.close();
  _dbRef.current = null;
});

// Import after mock is hoisted
import * as authService from '../services/auth.service.js';

describe('Auth Service', () => {
  describe('register', () => {
    it('creates a user with hashed password and returns profile + tokens', async () => {
      
      const result = await authService.register({
        email: 'new@test.com',
        password: 'Passw0rd!',
        name: 'New User',
      });

      expect(result.user.email).toBe('new@test.com');
      expect(result.user.name).toBe('New User');
      expect(result.user.role).toBe('rider');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.tokens.accessToken).toBeTruthy();
      expect(result.tokens.refreshToken).toBeTruthy();

      // Verify password is hashed in DB
      const dbUser = sqlite.prepare('SELECT password_hash FROM users WHERE email = ?').get('new@test.com') as any;
      expect(dbUser.password_hash).not.toBe('Passw0rd!');
      expect(dbUser.password_hash.startsWith('$2')).toBe(true);
    });

    it('throws 409 for duplicate email', async () => {
      
      await authService.register({
        email: 'dup@test.com',
        password: 'Pass123!',
        name: 'First',
      });

      try {
        await authService.register({
          email: 'dup@test.com',
          password: 'Pass456!',
          name: 'Second',
        });
        expect.unreachable('Should have thrown');
      } catch (err: any) {
        expect(err.status).toBe(409);
        expect(err.error).toContain('already exists');
      }
    });
  });

  describe('login', () => {
    it('returns user + tokens for correct password', async () => {
      
      await authService.register({
        email: 'login@test.com',
        password: 'MyPass!',
        name: 'Login User',
      });

      const result = await authService.login('login@test.com', 'MyPass!');
      expect(result.user.email).toBe('login@test.com');
      expect(result.tokens.accessToken).toBeTruthy();
      expect(result.tokens.refreshToken).toBeTruthy();
    });

    it('throws 401 for wrong password', async () => {
      
      await authService.register({
        email: 'wrong@test.com',
        password: 'Correct!',
        name: 'Wrong Pass',
      });

      try {
        await authService.login('wrong@test.com', 'Incorrect!');
        expect.unreachable('Should have thrown');
      } catch (err: any) {
        expect(err.status).toBe(401);
      }
    });

    it('throws 401 for non-existent email', async () => {
      
      try {
        await authService.login('nobody@test.com', 'anything');
        expect.unreachable('Should have thrown');
      } catch (err: any) {
        expect(err.status).toBe(401);
      }
    });
  });

  describe('refresh', () => {
    it('returns new tokens for valid refresh token', async () => {
      
      const { tokens } = await authService.register({
        email: 'refresh@test.com',
        password: 'Pass!',
        name: 'Refresh User',
      });

      const newTokens = await authService.refresh(tokens.refreshToken);
      expect(newTokens.accessToken).toBeTruthy();
      expect(newTokens.refreshToken).toBeTruthy();
      // Old token should be rotated (deleted)
      expect(newTokens.refreshToken).not.toBe(tokens.refreshToken);
    });

    it('throws 401 for expired refresh token', async () => {
      
      // Insert an expired token directly
      sqlite.prepare(
        'INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      ).run('user-expired', 'expired@test.com', 'Expired', '$2a$12$hash', 'rider');

      sqlite.prepare(
        'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      ).run('rt-exp', 'user-expired', 'expired-token-abc', '2020-01-01T00:00:00.000Z');

      try {
        await authService.refresh('expired-token-abc');
        expect.unreachable('Should have thrown');
      } catch (err: any) {
        expect(err.status).toBe(401);
      }
    });

    it('throws 401 for used (rotated) token', async () => {
      
      const { tokens } = await authService.register({
        email: 'rotated@test.com',
        password: 'Pass!',
        name: 'Rotated User',
      });

      // Use the token once (valid)
      await authService.refresh(tokens.refreshToken);

      // Use same token again (should be deleted)
      try {
        await authService.refresh(tokens.refreshToken);
        expect.unreachable('Should have thrown');
      } catch (err: any) {
        expect(err.status).toBe(401);
      }
    });
  });

  describe('logout', () => {
    it('deletes the refresh token from DB', async () => {
      
      const { tokens } = await authService.register({
        email: 'logout@test.com',
        password: 'Pass!',
        name: 'Logout User',
      });

      authService.logout(tokens.refreshToken);

      const row = sqlite.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(tokens.refreshToken);
      expect(row).toBeUndefined();
    });
  });

  describe('getUserById', () => {
    it('returns user profile without passwordHash', async () => {
      
      const { user } = await authService.register({
        email: 'profile@test.com',
        password: 'Pass!',
        name: 'Profile User',
        phone: '+15551234567',
      });

      const profile = authService.getUserById(user.id);
      expect(profile).not.toBeNull();
      expect(profile!.email).toBe('profile@test.com');
      expect(profile!.name).toBe('Profile User');
      expect(profile!.phone).toBe('+15551234567');
      expect(profile).not.toHaveProperty('passwordHash');
    });

    it('returns null for non-existent user', async () => {
      
      expect(authService.getUserById('non-existent-id')).toBeNull();
    });
  });

  describe('verifyAccessToken', () => {
    it('returns payload for valid token', async () => {
      
      const { user, tokens } = await authService.register({
        email: 'verify@test.com',
        password: 'Pass!',
        name: 'Verify User',
      });

      const payload = authService.verifyAccessToken(tokens.accessToken);
      expect(payload.sub).toBe(user.id);
      expect(payload.role).toBe('rider');
    });

    it('throws for invalid token', async () => {
      
      expect(() => authService.verifyAccessToken('invalid.token.here')).toThrow();
    });

    it('throws for tampered token', async () => {
      
      const { tokens } = await authService.register({
        email: 'tamper@test.com',
        password: 'Pass!',
        name: 'Tamper User',
      });

      // Tamper with the token
      const tampered = tokens.accessToken.slice(0, -5) + 'xxxxx';
      expect(() => authService.verifyAccessToken(tampered)).toThrow();
    });
  });
});
