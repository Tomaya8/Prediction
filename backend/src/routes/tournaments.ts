/**
 * Tournaments API Routes
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser, requireAdmin } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();
const getUser = (req: Request) => (req as any).user as { id: string; isAdmin?: boolean } | undefined;

// POST /api/tournaments/tick — auto-transition statuses (call from cron or admin)
router.post('/tick', async (req: Request, res: Response) => {
  try {
    const now = new Date();

    // UPCOMING -> ACTIVE when startsAt has passed
    const activated = await prisma.tournament.updateMany({
      where: { status: 'UPCOMING', startsAt: { lte: now } },
      data: { status: 'ACTIVE' },
    });

    // Notify but don't auto-resolve (admin should resolve to distribute prizes)
    // Just surface tournaments that have ended but aren't resolved yet
    const overdueCount = await prisma.tournament.count({
      where: { status: 'ACTIVE', endsAt: { lte: now } },
    });

    return res.json({
      success: true,
      data: {
        activatedCount: activated.count,
        overdueCount,
        message: overdueCount > 0
          ? `${overdueCount} tournament(s) have ended and need resolution`
          : 'All up to date',
      },
    });
  } catch (err) {
    console.error('POST /tournaments/tick error:', err);
    return res.status(500).json({ success: false, error: 'Failed to process tournament tick' });
  }
});

// GET /api/tournaments — list tournaments
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const where: any = {};
    if (status) where.status = status as string;

    const tournaments = await prisma.tournament.findMany({
      where,
      include: {
        _count: { select: { participants: true } },
      },
      orderBy: { startsAt: 'asc' },
    });

    const result = tournaments.map(t => ({
      ...t,
      participants: t._count.participants,
      _count: undefined,
    }));

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('GET /tournaments error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch tournaments' });
  }
});

// GET /api/tournaments/:id — single tournament
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { participants: true } },
      },
    });

    if (!tournament) {
      return res.status(404).json({ success: false, error: 'Tournament not found' });
    }

    return res.json({
      success: true,
      data: { ...tournament, participants: tournament._count.participants, _count: undefined },
    });
  } catch (err) {
    console.error('GET /tournaments/:id error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch tournament' });
  }
});

// GET /api/tournaments/:id/leaderboard — ranked participants
router.get('/:id/leaderboard', async (req: Request, res: Response) => {
  try {
    const participants = await prisma.tournamentParticipant.findMany({
      where: { tournamentId: req.params.id },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { pnl: 'desc' },
    });

    return res.json({ success: true, data: participants });
  } catch (err) {
    console.error('GET /tournaments/:id/leaderboard error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
  }
});

// POST /api/tournaments/:id/join — join tournament
router.post('/:id/join', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = getUser(req)!.id;
    const tournamentId = req.params.id;

    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) return res.status(404).json({ success: false, error: 'Tournament not found' });
    if (tournament.status === 'COMPLETED' || tournament.status === 'CANCELLED') {
      return res.status(400).json({ success: false, error: 'Tournament is not open for joining' });
    }

    const participantCount = await prisma.tournamentParticipant.count({ where: { tournamentId } });
    if (participantCount >= tournament.maxParticipants) {
      return res.status(400).json({ success: false, error: 'Tournament is full' });
    }

    const existing = await prisma.tournamentParticipant.findUnique({
      where: { tournamentId_userId: { tournamentId, userId } },
    });
    if (existing) return res.status(400).json({ success: false, error: 'Already joined this tournament' });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { creditBalance: true } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.creditBalance < tournament.entryFee) {
      return res.status(400).json({ success: false, error: 'Insufficient credits for entry fee' });
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.tournamentParticipant.create({ data: { tournamentId, userId } });
      if (tournament.entryFee > 0) {
        await tx.user.update({
          where: { id: userId },
          data: { creditBalance: { decrement: tournament.entryFee } },
        });
        await tx.transaction.create({
          data: {
            userId,
            amount: -tournament.entryFee,
            type: 'TRADE_BUY',
            description: `Tournament entry: ${tournament.name}`,
            referenceId: tournamentId,
          },
        });
      }
    });

    return res.json({ success: true, data: { message: 'Joined tournament successfully' } });
  } catch (err) {
    console.error('POST /tournaments/:id/join error:', err);
    return res.status(500).json({ success: false, error: 'Failed to join tournament' });
  }
});

// POST /api/tournaments/:id/resolve — resolve tournament, distribute prizes (admin only)
router.post('/:id/resolve', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const tournamentId = req.params.id;

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        participants: {
          include: { user: { select: { id: true, displayName: true } } },
          orderBy: { pnl: 'desc' },
        },
      },
    });

    if (!tournament) return res.status(404).json({ success: false, error: 'Tournament not found' });
    if (tournament.status === 'COMPLETED') {
      return res.status(400).json({ success: false, error: 'Tournament already resolved' });
    }
    if (tournament.status === 'CANCELLED') {
      return res.status(400).json({ success: false, error: 'Tournament is cancelled' });
    }

    const participants = tournament.participants;
    if (participants.length === 0) {
      await prisma.tournament.update({ where: { id: tournamentId }, data: { status: 'COMPLETED' } });
      return res.json({ success: true, data: { message: 'Tournament resolved with no participants', winners: [] } });
    }

    // Parse prize distribution: { first: number, second: number, third: number }
    const prizes = (tournament.prizes as any) || {};
    const prizeSlots = [
      { rank: 1, amount: prizes.first || 0 },
      { rank: 2, amount: prizes.second || 0 },
      { rank: 3, amount: prizes.third || 0 },
    ].filter(p => p.amount > 0);

    const winners: { rank: number; userId: string; displayName: string; pnl: number; prize: number }[] = [];

    await prisma.$transaction(async (tx: any) => {
      // Mark tournament as completed
      await tx.tournament.update({ where: { id: tournamentId }, data: { status: 'COMPLETED' } });

      // Distribute prizes to top participants
      for (const slot of prizeSlots) {
        const participant = participants[slot.rank - 1];
        if (!participant) continue;

        await tx.user.update({
          where: { id: participant.userId },
          data: {
            creditBalance: { increment: slot.amount },
            totalCreditsEarned: { increment: slot.amount },
            totalWinnings: { increment: slot.amount },
          },
        });

        await tx.transaction.create({
          data: {
            userId: participant.userId,
            amount: slot.amount,
            type: 'ACHIEVEMENT_REWARD',
            description: `Tournament prize (${slot.rank === 1 ? '1st' : slot.rank === 2 ? '2nd' : '3rd'} place): ${tournament.name}`,
            referenceId: tournamentId,
          },
        });

        winners.push({
          rank: slot.rank,
          userId: participant.userId,
          displayName: participant.user.displayName || 'Anonymous',
          pnl: participant.pnl,
          prize: slot.amount,
        });
      }
    });

    return res.json({ success: true, data: { message: 'Tournament resolved', winners } });
  } catch (err) {
    console.error('POST /tournaments/:id/resolve error:', err);
    return res.status(500).json({ success: false, error: 'Failed to resolve tournament' });
  }
});

// POST /api/tournaments — create tournament (admin only)
router.post('/', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, description, type, entryFee, prizePool, maxParticipants, startsAt, endsAt, prizes } = req.body;

    if (!name || !type || !startsAt || !endsAt) {
      return res.status(400).json({ success: false, error: 'name, type, startsAt, endsAt are required' });
    }

    const tournament = await prisma.tournament.create({
      data: {
        name,
        description,
        type,
        entryFee: entryFee || 0,
        prizePool: prizePool || 0,
        maxParticipants: maxParticipants || 500,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        prizes,
      },
    });

    return res.status(201).json({ success: true, data: tournament });
  } catch (err) {
    console.error('POST /tournaments error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create tournament' });
  }
});

export default router;
