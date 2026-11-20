import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { buyerProfiles, sellerProfiles, users } from '../db/schema.ts';
import { adminAuth } from '../lib/firebase-admin.ts';

const SESSION_SECRET = process.env.SESSION_SECRET || 'briefline-local-dev-signing-secret-change-in-prod';

export type SafeUser = Omit<typeof users.$inferSelect, 'passwordHash' | 'verificationToken' | 'resetToken'>;

export interface AuthRequest extends Request {
  currentUser?: SafeUser;
}

export function sanitizeUser(row: typeof users.$inferSelect): SafeUser {
  const { passwordHash: _p, verificationToken: _v, resetToken: _r, ...safe } = row;
  return safe;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored || !stored.includes(':')) return false;
  const [salt, keyHex] = stored.split(':');
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export function createSessionToken(userId: number, uid: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      uid,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `local.${payload}.${sig}`;
}

export function verifySessionToken(token: string): { userId: number; uid: string } | null {
  if (!token.startsWith('local.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, payload, sig] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      userId: number;
      uid: string;
      exp: number;
    };
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return { userId: parsed.userId, uid: parsed.uid };
  } catch {
    return null;
  }
}

export async function ensureProfilesForUser(userId: number, defaultName: string) {
  await db
    .insert(buyerProfiles)
    .values({ userId, organizationName: defaultName })
    .onConflictDoNothing({ target: buyerProfiles.userId });
  await db
    .insert(sellerProfiles)
    .values({ userId })
    .onConflictDoNothing({ target: sellerProfiles.userId });
}

export async function syncFirebaseUser(uid: string, email: string, name?: string, picture?: string): Promise<SafeUser> {
  const displayName = name && name.trim().length > 0 ? name.trim() : email.split('@')[0];
  const existingByEmail = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (existingByEmail.length > 0) {
    const updated = await db
      .update(users)
      .set({
        uid,
        avatarUrl: existingByEmail[0].avatarUrl || picture || null,
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingByEmail[0].id))
      .returning();
    await ensureProfilesForUser(updated[0].id, updated[0].name);
    return sanitizeUser(updated[0]);
  }

  const inserted = await db
    .insert(users)
    .values({
      uid,
      email: email.toLowerCase(),
      name: displayName,
      avatarUrl: picture || null,
      canBuy: true,
      canSell: true,
      activeRole: 'buyer',
      emailVerified: true,
    })
    .onConflictDoUpdate({
      target: users.uid,
      set: {
        email: email.toLowerCase(),
        updatedAt: new Date(),
      },
    })
    .returning();

  await ensureProfilesForUser(inserted[0].id, inserted[0].name);
  return sanitizeUser(inserted[0]);
}

async function resolvePrincipalFromHeader(authHeader?: string): Promise<SafeUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;

  if (token.startsWith('local.')) {
    const parsed = verifySessionToken(token);
    if (!parsed) return null;
    const rows = await db.select().from(users).where(eq(users.id, parsed.userId)).limit(1);
    if (!rows.length) return null;
    return sanitizeUser(rows[0]);
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email || `${decoded.uid}@firebase.user`;
    return await syncFirebaseUser(decoded.uid, email, decoded.name, decoded.picture);
  } catch {
    return null;
  }
}

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const user = await resolvePrincipalFromHeader(req.headers.authorization);
    if (user) {
      req.currentUser = user;
    }
  } catch (err) {
    console.error('Optional auth resolution failed:', err);
  }
  next();
};

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await resolvePrincipalFromHeader(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }
    req.currentUser = user;
    next();
  } catch (err) {
    console.error('Auth verification failed:', err);
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
};

export const requireUnrestricted = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.currentUser?.isRestricted) {
    return res.status(403).json({
      error: `Account is currently restricted: ${req.currentUser.restrictionReason || 'Contact platform support.'}`,
    });
  }
  next();
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.currentUser || !req.currentUser.isAdmin) {
    return res.status(403).json({ error: 'Administrator privileges are required for this action.' });
  }
  next();
};
