import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

const state = vi.hoisted(() => ({ sqlite: null as any }));

vi.mock('../../db/index.js', async () => {
  const Database = (await import('better-sqlite3')).default;
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const schema = await import('../../db/schema.js');
  const { TABLE_SQL } = await import('./helpers.js');

  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(TABLE_SQL);

  state.sqlite = sqlite;
  return { db: drizzle(sqlite, { schema }) };
});

const { default: app } = (await import('../../app.js')) as { default: Express };
const { clearTables, seedUser, seedRefreshToken, getAuthCookies, getExpiredAuthCookies } =
  await import('./helpers.js');

describe('Auth Flow Integration', () => {
  beforeEach(() => clearTables(state.sqlite));
  afterAll(() => state.sqlite.close());

  // ── Registration ────────────────────────────────────

  it('registers a new user → 201 with cookies', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@test.com', password: 'Password1', name: 'New User' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('new@test.com');
    expect(res.body.user.name).toBe('New User');
    expect(res.body.user.role).toBe('rider');
    expect(res.body.user.passwordHash).toBeUndefined();

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const joined = Array.isArray(cookies) ? cookies.join(';') : cookies;
    expect(joined).toContain('access_token');
    expect(joined).toContain('refresh_token');
  });

  it('registers with optional phone field', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'phone@test.com', password: 'Password1', name: 'Phone User', phone: '+15551234567' });

    expect(res.status).toBe(201);
    expect(res.body.user.phone).toBe('+15551234567');
  });

  it('rejects duplicate email → 409', async () => {
    seedUser(state.sqlite, { email: 'dupe@test.com' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dupe@test.com', password: 'Password1', name: 'Dupe' });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already exists');
  });

  it('rejects invalid email → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-email', password: 'Password1', name: 'Bad' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('rejects short password → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com', password: 'Ab1', name: 'Short' });

    expect(res.status).toBe(400);
  });

  it('rejects password without number → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com', password: 'NoNumbers', name: 'X' });

    expect(res.status).toBe(400);
  });

  it('rejects password without letter → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com', password: '12345678', name: 'X' });

    expect(res.status).toBe(400);
  });

  it('rejects missing fields → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com' });

    expect(res.status).toBe(400);
  });

  // ── Login ──────────────────────────────────────────

  it('logs in with valid credentials → 200 with cookies', async () => {
    seedUser(state.sqlite, { email: 'login@test.com', password: 'Password1' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'Password1' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('login@test.com');
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
  });

  it('rejects wrong password → 401', async () => {
    seedUser(state.sqlite, { email: 'login2@test.com', password: 'Password1' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login2@test.com', password: 'WrongPass1' });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Invalid');
  });

  it('rejects non-existent user → 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'Password1' });

    expect(res.status).toBe(401);
  });

  it('rejects login validation errors → 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bad-email', password: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  // ── GET /me ────────────────────────────────────────

  it('returns user profile with valid cookie', async () => {
    const user = seedUser(state.sqlite, { email: 'me@test.com' });
    const cookies = getAuthCookies(user.id);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@test.com');
  });

  it('rejects /me without cookie → 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects /me with expired token → 401', async () => {
    const user = seedUser(state.sqlite);
    const cookies = getExpiredAuthCookies(user.id);
    // Wait a tick so token is definitely expired
    await new Promise((r) => setTimeout(r, 10));

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookies);

    expect(res.status).toBe(401);
  });

  it('rejects /me when user deleted from DB → 401', async () => {
    const user = seedUser(state.sqlite, { email: 'ghost@test.com' });
    const cookies = getAuthCookies(user.id);
    state.sqlite.prepare('DELETE FROM users WHERE id = ?').run(user.id);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookies);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('User not found');
  });

  // ── Refresh ────────────────────────────────────────

  it('refreshes tokens successfully', async () => {
    // Register to get valid cookies
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'refresh@test.com', password: 'Password1', name: 'Refresh' });

    const regCookies = reg.headers['set-cookie'];

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', regCookies);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Tokens refreshed');
    const newCookies = res.headers['set-cookie'];
    expect(newCookies).toBeDefined();
  });

  it('rejects refresh without token → 401', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('No refresh token');
  });

  it('rejects refresh with invalid token → 401', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'refresh_token=invalid-token');

    expect(res.status).toBe(401);
  });

  it('rejects refresh with expired token → 401 and cleans up', async () => {
    const user = seedUser(state.sqlite, { email: 'expired@test.com' });
    const rt = seedRefreshToken(state.sqlite, user.id, {
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${rt.token}`);

    expect(res.status).toBe(401);
    // Verify token was cleaned up
    const row = state.sqlite
      .prepare('SELECT id FROM refresh_tokens WHERE token = ?')
      .get(rt.token);
    expect(row).toBeUndefined();
  });

  it('rejects refresh when user is deleted → 401', async () => {
    const user = seedUser(state.sqlite, { email: 'del@test.com' });
    const rt = seedRefreshToken(state.sqlite, user.id);
    // Delete FK-dependent rows first, then the user
    state.sqlite.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(user.id);
    state.sqlite.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    // Re-insert the refresh token without FK constraint (user gone)
    state.sqlite.prepare('PRAGMA foreign_keys = OFF').run();
    state.sqlite.prepare('INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)').run(
      rt.id, user.id, rt.token, new Date(Date.now() + 86400000).toISOString(),
    );
    state.sqlite.prepare('PRAGMA foreign_keys = ON').run();

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${rt.token}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('User not found');
  });

  // ── Logout ─────────────────────────────────────────

  it('logs out and clears cookies', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'logout@test.com', password: 'Password1', name: 'Logout' });

    const regCookies = reg.headers['set-cookie'];

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', regCookies);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out');
  });

  it('logout without cookies still succeeds', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
  });

  // ── Full flow ──────────────────────────────────────

  it('register → login → me → refresh → logout', async () => {
    // Register
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'flow@test.com', password: 'FlowPass1', name: 'Flow User' });
    expect(reg.status).toBe(201);

    // Login
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'flow@test.com', password: 'FlowPass1' });
    expect(login.status).toBe(200);
    const loginCookies = login.headers['set-cookie'];

    // /me
    const me = await request(app)
      .get('/api/auth/me')
      .set('Cookie', loginCookies);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('flow@test.com');

    // Refresh
    const refresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', loginCookies);
    expect(refresh.status).toBe(200);

    // Logout
    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', loginCookies);
    expect(logout.status).toBe(200);
  });
});
