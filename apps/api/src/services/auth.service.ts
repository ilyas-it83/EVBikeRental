import { db } from '../db/index.js';
import { users, refreshTokens } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_DAYS = 7;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
}

function toProfile(user: typeof users.$inferSelect): UserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function generateAccessToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

async function generateRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();

  db.insert(refreshTokens).values({
    id: crypto.randomUUID(),
    userId,
    token,
    expiresAt,
  }).run();

  return token;
}

function issueTokens(userId: string, role: string): Promise<TokenPair> {
  return generateRefreshToken(userId).then((refreshToken) => ({
    accessToken: generateAccessToken(userId, role),
    refreshToken,
  }));
}

// ─── Public API ─────────────────────────────────────

export async function register(data: {
  email: string;
  password: string;
  name: string;
  phone?: string;
}): Promise<{ user: UserProfile; tokens: TokenPair }> {
  // Check duplicate email
  const existing = db.select().from(users).where(eq(users.email, data.email)).get();
  if (existing) {
    throw { status: 409, error: 'An account with this email already exists' };
  }

  const id = crypto.randomUUID();
  const passwordHash = bcrypt.hashSync(data.password, 12);

  db.insert(users).values({
    id,
    email: data.email,
    passwordHash,
    name: data.name,
    phone: data.phone ?? null,
    role: 'rider',
  }).run();

  const user = db.select().from(users).where(eq(users.id, id)).get()!;
  const tokens = await issueTokens(user.id, user.role);

  return { user: toProfile(user), tokens };
}

export async function login(email: string, password: string): Promise<{ user: UserProfile; tokens: TokenPair }> {
  const user = db.select().from(users).where(eq(users.email, email)).get();
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    throw { status: 401, error: 'Invalid email or password' };
  }

  const tokens = await issueTokens(user.id, user.role);
  return { user: toProfile(user), tokens };
}

export async function refresh(token: string): Promise<TokenPair> {
  const stored = db.select().from(refreshTokens).where(eq(refreshTokens.token, token)).get();
  if (!stored || new Date(stored.expiresAt) < new Date()) {
    // Clean up expired token if it exists
    if (stored) {
      db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id)).run();
    }
    throw { status: 401, error: 'Invalid or expired refresh token' };
  }

  // Rotate: delete old token
  db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id)).run();

  const user = db.select().from(users).where(eq(users.id, stored.userId)).get();
  if (!user) {
    throw { status: 401, error: 'User not found' };
  }

  return issueTokens(user.id, user.role);
}

export function logout(token: string): void {
  db.delete(refreshTokens).where(eq(refreshTokens.token, token)).run();
}

export function getUserById(userId: string): UserProfile | null {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  return user ? toProfile(user) : null;
}

export function verifyAccessToken(token: string): { sub: string; role: string } {
  return jwt.verify(token, JWT_SECRET) as { sub: string; role: string };
}
