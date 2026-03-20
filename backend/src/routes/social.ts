/**
 * Social API Routes — Friends, Challenges, Referrals
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();
const getUser = (req: Request) => (req as any).user as { id: string; isAdmin?: boolean } | undefined;

// ——— FRIENDS ———

// GET /api/social/friends — list users the current user follows
router.get('/friends', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = getUser(req)!.id;

    const follows = await prisma.follow.findMany({
      where: { followerId: userId },
      include: {
        following: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            creditBalance: true,
            totalTrades: true,
            winningTrades: true,
          },
        },
      },
    });

    const friends = follows.map(f => ({
      ...f.following,
      winRate: f.following.totalTrades > 0
        ? Math.round((f.following.winningTrades / f.following.totalTrades) * 100)
        : 0,
    }));

    return res.json({ success: true, data: friends });
  } catch (err) {
    console.error('GET /social/friends error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch friends' });
  }
});

// POST /api/social/follow/:userId — follow a user
router.post('/follow/:userId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const followerId = getUser(req)!.id;
    const followingId = req.params.userId;

    if (followerId === followingId) {
      return res.status(400).json({ success: false, error: 'Cannot follow yourself' });
    }

    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId, followingId } },
      create: { followerId, followingId },
      update: {},
    });

    return res.json({ success: true, data: { message: 'Following user' } });
  } catch (err) {
    console.error('POST /social/follow error:', err);
    return res.status(500).json({ success: false, error: 'Failed to follow user' });
  }
});

// DELETE /api/social/follow/:userId — unfollow
router.delete('/follow/:userId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const followerId = getUser(req)!.id;
    const followingId = req.params.userId;

    await prisma.follow.deleteMany({ where: { followerId, followingId } });

    return res.json({ success: true, data: { message: 'Unfollowed user' } });
  } catch (err) {
    console.error('DELETE /social/follow error:', err);
    return res.status(500).json({ success: false, error: 'Failed to unfollow user' });
  }
});

// ——— CHALLENGES ———

// GET /api/social/challenges — challenges for current user
router.get('/challenges', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = getUser(req)!.id;

    const challenges = await prisma.friendChallenge.findMany({
      where: {
        OR: [{ challengerId: userId }, { challengedId: userId }],
      },
      include: {
        challenger: { select: { id: true, displayName: true, avatarUrl: true } },
        challenged: { select: { id: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: challenges });
  } catch (err) {
    console.error('GET /social/challenges error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch challenges' });
  }
});

// POST /api/social/challenges — create a challenge
router.post('/challenges', authenticateUser, async (req: Request, res: Response) => {
  try {
    const challengerId = getUser(req)!.id;
    const { challengedId, marketId, challengerOutcomeId, amount } = req.body;

    if (!challengedId || !marketId || !challengerOutcomeId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'challengedId, marketId, challengerOutcomeId, amount required' });
    }

    const user = await prisma.user.findUnique({ where: { id: challengerId }, select: { creditBalance: true } });
    if (!user || user.creditBalance < amount) {
      return res.status(400).json({ success: false, error: 'Insufficient credits' });
    }

    const market = await prisma.market.findUnique({ where: { id: marketId } });
    if (!market || market.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, error: 'Market not found or not active' });
    }

    const challenge = await prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id: challengerId },
        data: { creditBalance: { decrement: amount } },
      });

      return tx.friendChallenge.create({
        data: {
          challengerId,
          challengedId,
          marketId,
          challengerOutcomeId,
          amount,
          escrowCredits: amount,
          status: 'PENDING',
        },
      });
    });

    return res.status(201).json({ success: true, data: challenge });
  } catch (err) {
    console.error('POST /social/challenges error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create challenge' });
  }
});

// PUT /api/social/challenges/:id/accept
router.put('/challenges/:id/accept', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = getUser(req)!.id;
    const { challengedOutcomeId } = req.body;

    const challenge = await prisma.friendChallenge.findUnique({ where: { id: req.params.id } });
    if (!challenge) return res.status(404).json({ success: false, error: 'Challenge not found' });
    if (challenge.challengedId !== userId) return res.status(403).json({ success: false, error: 'Not your challenge' });
    if (challenge.status !== 'PENDING') return res.status(400).json({ success: false, error: 'Challenge is not pending' });
    if (!challengedOutcomeId) return res.status(400).json({ success: false, error: 'challengedOutcomeId required' });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { creditBalance: true } });
    if (!user || user.creditBalance < challenge.amount) {
      return res.status(400).json({ success: false, error: 'Insufficient credits' });
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id: userId },
        data: { creditBalance: { decrement: challenge.amount } },
      });
      await tx.friendChallenge.update({
        where: { id: challenge.id },
        data: {
          status: 'ACCEPTED',
          challengedOutcomeId,
          escrowCredits: challenge.escrowCredits + challenge.amount,
        },
      });
    });

    return res.json({ success: true, data: { message: 'Challenge accepted' } });
  } catch (err) {
    console.error('PUT /social/challenges/:id/accept error:', err);
    return res.status(500).json({ success: false, error: 'Failed to accept challenge' });
  }
});

// PUT /api/social/challenges/:id/decline
router.put('/challenges/:id/decline', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = getUser(req)!.id;

    const challenge = await prisma.friendChallenge.findUnique({ where: { id: req.params.id } });
    if (!challenge) return res.status(404).json({ success: false, error: 'Challenge not found' });
    if (challenge.challengedId !== userId) return res.status(403).json({ success: false, error: 'Not your challenge' });
    if (challenge.status !== 'PENDING') return res.status(400).json({ success: false, error: 'Challenge is not pending' });

    await prisma.$transaction(async (tx: any) => {
      // Refund only the challenger's original wager (not the full escrow which could include both sides)
      await tx.user.update({
        where: { id: challenge.challengerId },
        data: { creditBalance: { increment: challenge.amount } },
      });
      await tx.friendChallenge.update({
        where: { id: challenge.id },
        data: { status: 'DECLINED', escrowCredits: 0 },
      });
    });

    return res.json({ success: true, data: { message: 'Challenge declined' } });
  } catch (err) {
    console.error('PUT /social/challenges/:id/decline error:', err);
    return res.status(500).json({ success: false, error: 'Failed to decline challenge' });
  }
});

// POST /api/social/challenges/timeout — auto-decline stale PENDING challenges (>48h)
// and auto-refund ACCEPTED challenges whose markets have been cancelled
router.post('/challenges/timeout', async (req: Request, res: Response) => {
  try {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago

    // 1. Auto-decline stale PENDING challenges
    const stalePending = await prisma.friendChallenge.findMany({
      where: { status: 'PENDING', createdAt: { lt: cutoff } },
    });

    let declinedCount = 0;
    for (const challenge of stalePending) {
      await prisma.$transaction(async (tx: any) => {
        await tx.user.update({
          where: { id: challenge.challengerId },
          data: { creditBalance: { increment: challenge.amount } },
        });
        await tx.friendChallenge.update({
          where: { id: challenge.id },
          data: { status: 'DECLINED', escrowCredits: 0 },
        });
      });
      declinedCount++;
    }

    // 2. Auto-refund ACCEPTED challenges on cancelled markets
    const acceptedChallenges = await prisma.friendChallenge.findMany({
      where: { status: 'ACCEPTED' },
    });

    let refundedCount = 0;
    for (const challenge of acceptedChallenges) {
      const market = await prisma.market.findUnique({
        where: { id: challenge.marketId },
        select: { status: true },
      });
      if (market && market.status === 'CANCELLED') {
        const half = Math.floor(challenge.escrowCredits / 2);
        const remainder = challenge.escrowCredits - half;
        await prisma.$transaction(async (tx: any) => {
          await tx.user.update({
            where: { id: challenge.challengerId },
            data: { creditBalance: { increment: half } },
          });
          await tx.user.update({
            where: { id: challenge.challengedId },
            data: { creditBalance: { increment: remainder } },
          });
          await tx.friendChallenge.update({
            where: { id: challenge.id },
            data: { status: 'COMPLETED', winnerId: null, escrowCredits: 0 },
          });
        });
        refundedCount++;
      }
    }

    return res.json({
      success: true,
      data: { declinedCount, refundedCount },
    });
  } catch (err) {
    console.error('POST /social/challenges/timeout error:', err);
    return res.status(500).json({ success: false, error: 'Failed to process timeouts' });
  }
});

// ——— REFERRALS ———

// GET /api/social/referral — current user's referral info
router.get('/referral', authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: getUser(req)!.id },
      select: { referralCode: true, referralCount: true },
    });

    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    return res.json({
      success: true,
      data: {
        referralCode: user.referralCode || '',
        referralCount: user.referralCount,
        creditsEarned: user.referralCount * 200,
      },
    });
  } catch (err) {
    console.error('GET /social/referral error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch referral info' });
  }
});

export default router;
