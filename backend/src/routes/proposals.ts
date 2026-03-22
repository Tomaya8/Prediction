/**
 * Market Proposals API Routes
 * Users propose markets → community upvotes → admin approves/rejects
 */

import { Router, Request, Response } from 'express';
import { PrismaClient, MarketCategory, MarketStatus } from '@prisma/client';
import { authenticateUser, requireAdmin } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();
const getUser = (req: Request) => (req as any).user as { id: string; isAdmin?: boolean } | undefined;

// ============================================================
// POST /api/proposals — submit a new market proposal
// ============================================================
router.post('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = getUser(req)!.id;
    const { title, description, category, outcomes, suggestedExpiry, resolutionCriteria, sourceUrl } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }
    if (!category) {
      return res.status(400).json({ success: false, error: 'Category is required' });
    }
    if (!suggestedExpiry || new Date(suggestedExpiry) <= new Date()) {
      return res.status(400).json({ success: false, error: 'Valid future expiry date required' });
    }

    const outcomeList = Array.isArray(outcomes) && outcomes.length >= 2
      ? outcomes.map((o: string) => o.trim()).filter(Boolean)
      : ['Yes', 'No'];

    if (outcomeList.length < 2) {
      return res.status(400).json({ success: false, error: 'At least 2 outcomes required' });
    }

    // Rate limit: max 5 pending proposals per user
    const pendingCount = await prisma.marketProposal.count({
      where: { createdById: userId, status: 'PENDING' },
    });
    if (pendingCount >= 5) {
      return res.status(429).json({ success: false, error: 'You have too many pending proposals. Wait for review.' });
    }

    // Check for duplicate titles
    const duplicate = await prisma.marketProposal.findFirst({
      where: { title: { equals: title.trim(), mode: 'insensitive' }, status: 'PENDING' },
    });
    if (duplicate) {
      return res.status(409).json({ success: false, error: 'A similar proposal already exists. Try upvoting it instead.' });
    }

    const proposal = await prisma.marketProposal.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        category: category as MarketCategory,
        outcomes: outcomeList,
        suggestedExpiry: new Date(suggestedExpiry),
        resolutionCriteria: resolutionCriteria?.trim() || null,
        sourceUrl: sourceUrl?.trim() || null,
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, displayName: true } },
      },
    });

    return res.status(201).json({ success: true, data: proposal });
  } catch (err) {
    console.error('POST /proposals error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create proposal' });
  }
});

// ============================================================
// GET /api/proposals — list proposals (public, sorted by upvotes)
// ============================================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status = 'PENDING', limit = '20', offset = '0', sort = 'upvotes' } = req.query;

    const where: any = {};
    if (status !== 'ALL') where.status = status as string;

    const orderBy = sort === 'newest'
      ? { createdAt: 'desc' as const }
      : { upvotes: 'desc' as const };

    const proposals = await prisma.marketProposal.findMany({
      where,
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        _count: { select: { votes: true } },
      },
      orderBy,
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    // If user is authenticated, mark which proposals they've voted on
    const userId = getUser(req)?.id;
    let votedIds = new Set<string>();
    if (userId) {
      const myVotes = await prisma.proposalVote.findMany({
        where: { userId, proposalId: { in: proposals.map(p => p.id) } },
        select: { proposalId: true },
      });
      votedIds = new Set(myVotes.map(v => v.proposalId));
    }

    const result = proposals.map(p => ({
      ...p,
      hasVoted: votedIds.has(p.id),
      _count: undefined,
    }));

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('GET /proposals error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch proposals' });
  }
});

// ============================================================
// GET /api/proposals/mine — current user's proposals
// ============================================================
router.get('/mine', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = getUser(req)!.id;

    const proposals = await prisma.marketProposal.findMany({
      where: { createdById: userId },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: proposals });
  } catch (err) {
    console.error('GET /proposals/mine error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch proposals' });
  }
});

// ============================================================
// POST /api/proposals/:id/vote — upvote a proposal
// ============================================================
router.post('/:id/vote', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = getUser(req)!.id;
    const proposalId = req.params.id;

    const proposal = await prisma.marketProposal.findUnique({ where: { id: proposalId } });
    if (!proposal) return res.status(404).json({ success: false, error: 'Proposal not found' });
    if (proposal.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: 'Can only vote on pending proposals' });
    }

    // Check if already voted
    const existing = await prisma.proposalVote.findUnique({
      where: { proposalId_userId: { proposalId, userId } },
    });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Already voted on this proposal' });
    }

    await prisma.$transaction([
      prisma.proposalVote.create({ data: { proposalId, userId } }),
      prisma.marketProposal.update({
        where: { id: proposalId },
        data: { upvotes: { increment: 1 } },
      }),
    ]);

    return res.json({ success: true, data: { message: 'Vote recorded' } });
  } catch (err) {
    console.error('POST /proposals/:id/vote error:', err);
    return res.status(500).json({ success: false, error: 'Failed to vote' });
  }
});

// ============================================================
// POST /api/proposals/:id/approve — admin approves → creates market
// ============================================================
router.post('/:id/approve', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const proposalId = req.params.id;
    const { adminNotes, liquidityB = 1000 } = req.body;

    const proposal = await prisma.marketProposal.findUnique({ where: { id: proposalId } });
    if (!proposal) return res.status(404).json({ success: false, error: 'Proposal not found' });
    if (proposal.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: 'Proposal is not pending' });
    }

    const PALETTE = ['#22C55E', '#EF4444', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

    const result = await prisma.$transaction(async (tx) => {
      // Create the actual market
      const market = await tx.market.create({
        data: {
          title: proposal.title,
          description: proposal.description,
          category: proposal.category,
          expiresAt: proposal.suggestedExpiry,
          liquidityB,
          status: MarketStatus.ACTIVE,
          createdById: proposal.createdById,
          outcomes: {
            create: proposal.outcomes.map((name, i) => ({
              name,
              color: PALETTE[i % PALETTE.length],
              quantity: 0,
              probability: 1 / proposal.outcomes.length,
            })),
          },
        },
        include: { outcomes: true },
      });

      // Update proposal status
      await tx.marketProposal.update({
        where: { id: proposalId },
        data: {
          status: 'APPROVED',
          adminNotes: adminNotes || null,
          marketId: market.id,
        },
      });

      // Reward the proposer with 50 credits
      await tx.user.update({
        where: { id: proposal.createdById },
        data: {
          creditBalance: { increment: 50 },
          totalCreditsEarned: { increment: 50 },
        },
      });

      await tx.transaction.create({
        data: {
          userId: proposal.createdById,
          amount: 50,
          type: 'ACHIEVEMENT_REWARD',
          description: `Market proposal approved: ${proposal.title}`,
          referenceId: market.id,
        },
      });

      return market;
    });

    return res.json({ success: true, data: { market: result, message: 'Proposal approved and market created' } });
  } catch (err) {
    console.error('POST /proposals/:id/approve error:', err);
    return res.status(500).json({ success: false, error: 'Failed to approve proposal' });
  }
});

// ============================================================
// POST /api/proposals/:id/reject — admin rejects
// ============================================================
router.post('/:id/reject', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const proposalId = req.params.id;
    const { adminNotes } = req.body;

    const proposal = await prisma.marketProposal.findUnique({ where: { id: proposalId } });
    if (!proposal) return res.status(404).json({ success: false, error: 'Proposal not found' });
    if (proposal.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: 'Proposal is not pending' });
    }

    await prisma.marketProposal.update({
      where: { id: proposalId },
      data: {
        status: 'REJECTED',
        adminNotes: adminNotes || 'Does not meet market criteria',
      },
    });

    return res.json({ success: true, data: { message: 'Proposal rejected' } });
  } catch (err) {
    console.error('POST /proposals/:id/reject error:', err);
    return res.status(500).json({ success: false, error: 'Failed to reject proposal' });
  }
});

export default router;
