import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyIdToken } from '../lib/firebase-admin';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';

// Augment Request to carry user payload without relying on .d.ts typeRoots
interface AuthRequest extends Request {
  user?: { id: string; firebaseUid: string; isAdmin?: boolean; isBanned?: boolean };
}

const setUser = (req: Request, user: { id: string; firebaseUid: string; isAdmin?: boolean; isBanned?: boolean }) => {
  (req as AuthRequest).user = user;
};

const prisma = new PrismaClient();

/** Try to verify our own JWT. Returns the DB user if found. */
async function tryJwt(token: string) {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    return prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, firebaseUid: true, isAdmin: true, isBanned: true },
    });
  } catch {
    return null;
  }
}

/**
 * Verifies the Firebase ID token from Authorization header and populates req.user.
 * Returns 401 if the token is missing or invalid.
 */
export async function authenticateUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    // 1. Try our own JWT first (works in all environments)
    const jwtUser = await tryJwt(token);
    if (jwtUser) {
      if (jwtUser.isBanned) {
        res.status(403).json({ success: false, error: 'Account suspended' });
        return;
      }
      setUser(req, { id: jwtUser.id, firebaseUid: jwtUser.firebaseUid, isAdmin: jwtUser.isAdmin ?? false });
      return next();
    }

    // 2. DEV MODE fallback: treat token string as a userId directly
    const isDev = process.env.NODE_ENV === 'development' && !process.env.FIREBASE_CLIENT_EMAIL;
    if (isDev) {
      let user = await prisma.user.findFirst({
        where: { OR: [{ id: token }, { firebaseUid: token }] },
        select: { id: true, firebaseUid: true, isAdmin: true, isBanned: true },
      });
      if (!user) {
        user = await prisma.user.create({
          data: {
            firebaseUid: token,
            email: `dev-${token}@localhost`,
            displayName: 'Dev User',
            isAdmin: true,
            referralCode: generateReferralCode(),
          },
          select: { id: true, firebaseUid: true, isAdmin: true, isBanned: true },
        });
      }
      setUser(req, { id: user.id, firebaseUid: user.firebaseUid, isAdmin: user.isAdmin ?? false });
      return next();
    }

    const decoded = await verifyIdToken(token);

    // Look up or auto-create user record on first login (upsert to avoid race condition)
    const user = await prisma.user.upsert({
      where: { firebaseUid: decoded.uid },
      update: {},
      create: {
        firebaseUid: decoded.uid,
        email: decoded.email || '',
        displayName: decoded.name || null,
        referralCode: generateReferralCode(),
      },
      select: { id: true, firebaseUid: true, isAdmin: true, isBanned: true },
    });

    setUser(req, {
      id: user.id,
      firebaseUid: user.firebaseUid,
      isAdmin: user.isAdmin ?? false,
    });

    next();
  } catch (err) {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

/**
 * Optional auth — populates req.user if token present, but does not reject if missing.
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7);
  const isDev = process.env.NODE_ENV === 'development' && !process.env.FIREBASE_CLIENT_EMAIL;
  try {
    // Try our own JWT first
    const jwtUser = await tryJwt(token);
    if (jwtUser) {
      setUser(req, { id: jwtUser.id, firebaseUid: jwtUser.firebaseUid, isAdmin: jwtUser.isAdmin ?? false });
      return next();
    }

    if (isDev) {
      let user = await prisma.user.findFirst({
        where: { OR: [{ id: token }, { firebaseUid: token }] },
        select: { id: true, firebaseUid: true, isAdmin: true, isBanned: true },
      });
      if (!user) {
        user = await prisma.user.create({
          data: { firebaseUid: token, email: `dev-${token}@localhost`, displayName: 'Dev User', isAdmin: true, referralCode: generateReferralCode() },
          select: { id: true, firebaseUid: true, isAdmin: true, isBanned: true },
        });
      }
      setUser(req, { id: user.id, firebaseUid: user.firebaseUid, isAdmin: user.isAdmin ?? false });
    } else {
      const decoded = await verifyIdToken(token);
      const user = await prisma.user.findUnique({
        where: { firebaseUid: decoded.uid },
        select: { id: true, firebaseUid: true, isAdmin: true, isBanned: true },
      });
      if (user) {
        setUser(req, { id: user.id, firebaseUid: user.firebaseUid, isAdmin: user.isAdmin ?? false });
      }
    }
  } catch {
    // Silently ignore invalid tokens for optional auth
  }
  next();
}

/**
 * Requires admin role — must be used after authenticateUser.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!(req as AuthRequest).user?.isAdmin) {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }
  next();
}

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
