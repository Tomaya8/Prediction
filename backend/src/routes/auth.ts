/**
 * Auth Routes — email/password auth backed by PostgreSQL.
 * No Firebase dependency required; tokens are JWTs verified by the auth middleware.
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  WARNING: JWT_SECRET is not set. Using insecure default. Set JWT_SECRET env var before deploying.');
}

// Stricter rate limit for auth endpoints (10 attempts per 15 min per IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts. Please try again later.' },
});
router.use(authLimiter);

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ============================================================
// POST /api/auth/register
// ============================================================
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Registration failed. Please try a different email.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    // Generate a stable firebaseUid-like value so existing schema constraints are met
    const firebaseUid = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const user = await prisma.user.create({
      data: {
        email,
        displayName: displayName?.trim() || null,
        passwordHash,
        firebaseUid,
        referralCode: generateReferralCode(),
        creditBalance: 1000,
      },
      select: { id: true, email: true, displayName: true, creditBalance: true },
    });

    // Record welcome bonus
    await prisma.transaction.create({
      data: {
        userId: user.id,
        amount: 1000,
        type: 'STARTING_BONUS',
        description: 'Welcome bonus credits',
      },
    });

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    return res.status(201).json({ success: true, data: { token, user } });
  } catch (err) {
    console.error('POST /auth/register error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create account' });
  }
});

// ============================================================
// POST /api/auth/login
// ============================================================
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, displayName: true, creditBalance: true, passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ success: false, error: 'auth/invalid-credential' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'auth/invalid-credential' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    const { passwordHash: _, ...safeUser } = user;
    return res.json({ success: true, data: { token, user: safeUser } });
  } catch (err) {
    console.error('POST /auth/login error:', err);
    return res.status(500).json({ success: false, error: 'Failed to sign in' });
  }
});

export default router;
