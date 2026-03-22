/**
 * Admin API Routes — Stats, User Management
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser, requireAdmin } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// All admin routes require auth + admin role
router.use(authenticateUser, requireAdmin);

// GET /api/admin/stats — dashboard statistics
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [totalUsers, activeUsers, totalMarkets, volumeResult] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: { lastActiveDate: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
      prisma.market.count({ where: { status: 'ACTIVE' } }),
      prisma.market.aggregate({ _sum: { totalVolume: true } }),
    ]);

    // Daily stats for the past 7 days
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });

    const dailyStats = await Promise.all(
      days.map(async (dayStart) => {
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        const [users, volume] = await Promise.all([
          prisma.user.count({ where: { createdAt: { gte: dayStart, lte: dayEnd } } }),
          prisma.trade.aggregate({
            where: { createdAt: { gte: dayStart, lte: dayEnd } },
            _sum: { totalCost: true },
          }),
        ]);

        return {
          name: dayStart.toLocaleDateString('en', { weekday: 'short' }),
          users,
          volume: volume._sum.totalCost || 0,
        };
      })
    );

    return res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        totalMarkets,
        totalVolume: volumeResult._sum.totalVolume || 0,
        dailyStats,
      },
    });
  } catch (err) {
    console.error('GET /admin/stats error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// GET /api/admin/users — list all users with search
router.get('/users', async (req: Request, res: Response) => {
  try {
    const { search, limit = '50', offset = '0' } = req.query;

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search as string, mode: 'insensitive' } },
        { displayName: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        displayName: true,
        creditBalance: true,
        totalWinnings: true,
        totalTrades: true,
        isAdmin: true,
        createdAt: true,
        lastActiveDate: true,
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    return res.json({ success: true, data: users });
  } catch (err) {
    console.error('GET /admin/users error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// POST /api/admin/users/:id/credits — add/remove credits
router.post('/users/:id/credits', async (req: Request, res: Response) => {
  try {
    const { amount, reason } = req.body;
    if (!amount || typeof amount !== 'number') {
      return res.status(400).json({ success: false, error: 'amount (number) required' });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        creditBalance: { increment: amount },
        ...(amount > 0 ? { totalCreditsEarned: { increment: amount } } : {}),
      },
      select: { id: true, displayName: true, creditBalance: true },
    });

    await prisma.transaction.create({
      data: {
        userId: req.params.id,
        amount,
        type: 'ADMIN_ADJUSTMENT',
        description: reason || `Admin adjustment: ${amount > 0 ? '+' : ''}${amount} credits`,
      },
    });

    return res.json({ success: true, data: user });
  } catch (err) {
    console.error('POST /admin/users/:id/credits error:', err);
    return res.status(500).json({ success: false, error: 'Failed to adjust credits' });
  }
});

// POST /api/admin/users/:id/ban — ban/unban user
router.post('/users/:id/ban', async (req: Request, res: Response) => {
  try {
    const { banned = true } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isBanned: banned },
      select: { id: true, displayName: true, email: true, isBanned: true },
    });

    return res.json({ success: true, data: { ...user, message: user.isBanned ? 'User banned' : 'User unbanned' } });
  } catch (err) {
    console.error('POST /admin/users/:id/ban error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update ban status' });
  }
});

// POST /api/admin/sync-markets — trigger market sync from external sources
router.post('/sync-markets', async (_req: Request, res: Response) => {
  try {
    const { syncMarkets } = require('../scripts/sync-markets');
    const result = await syncMarkets();
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('POST /admin/sync-markets error:', err);
    return res.status(500).json({ success: false, error: 'Failed to sync markets' });
  }
});

export default router;
