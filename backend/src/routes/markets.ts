/**
 * Markets API Routes
 * RESTful endpoints for market operations
 */

import { Router, Request, Response } from 'express';
import { PrismaClient, MarketCategory, MarketStatus } from '@prisma/client';
import { calculatePrices } from '../lib/lmsr';
import { authenticateUser } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Helpers to avoid repeated type casting
const getUser = (req: Request) => (req as any).user as { id: string; isAdmin?: boolean } | undefined;
const toLmsr = (m: { id: string; liquidityB: number; outcomes: { id: string; name: string; quantity: number }[] }) => ({
  id: m.id, liquidityParameter: m.liquidityB, outcomes: m.outcomes,
});

// ============================================
// STATIC ROUTES (must be defined before /:id to avoid conflicts)
// ============================================

/**
 * GET /api/markets/meta/categories
 * Get available market categories
 */
router.get('/meta/categories', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: Object.values(MarketCategory)
  });
});

/**
 * GET /api/markets/meta/trending
 * Get trending markets (by volume)
 */
router.get('/meta/trending', async (_req: Request, res: Response) => {
  try {
    const markets = await prisma.market.findMany({
      where: { status: MarketStatus.ACTIVE },
      include: {
        outcomes: {
          select: {
            id: true,
            name: true,
            color: true,
            quantity: true,
            probability: true
          }
        }
      },
      orderBy: { totalVolume: 'desc' },
      take: 10
    });

    res.json({
      success: true,
      data: markets
    });
  } catch (error) {
    console.error('Error fetching trending markets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trending markets'
    });
  }
});

// ============================================
// MARKET ENDPOINTS
// ============================================

/**
 * GET /api/markets
 * List all markets with optional filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { 
      category, 
      status = 'ACTIVE', 
      limit = '20', 
      offset = '0',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const where: any = {};
    
    if (category) {
      where.category = category as MarketCategory;
    }
    
    if (status) {
      where.status = status as MarketStatus;
    }

    // For non-admin users, only show ACTIVE or RESOLVED markets
    if (!getUser(req)?.isAdmin) {
      where.status = { in: [MarketStatus.ACTIVE, MarketStatus.RESOLVED] };
    }

    const markets = await prisma.market.findMany({
      where,
      include: {
        outcomes: {
          select: {
            id: true,
            name: true,
            color: true,
            quantity: true,
            probability: true,
            isWinner: true
          }
        },
        _count: {
          select: {
            trades: true,
            comments: true
          }
        }
      },
      orderBy: { [sortBy as string]: sortOrder },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    // Calculate current prices for each market
    const marketsWithPrices = markets.map(market => {
      const prices = calculatePrices(toLmsr(market));
      
      return {
        ...market,
        currentPrices: prices,
        outcomes: market.outcomes.map(o => ({
          ...o,
          currentPrice: prices[o.id]
        }))
      };
    });

    res.json({
      success: true,
      data: marketsWithPrices,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });
  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch markets'
    });
  }
});

/**
 * GET /api/markets/:id
 * Get single market details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const market = await prisma.market.findUnique({
      where: { id },
      include: {
        outcomes: {
          select: {
            id: true,
            name: true,
            color: true,
            quantity: true,
            probability: true,
            isWinner: true
          }
        },
        createdBy: {
          select: { id: true, displayName: true, avatarUrl: true }
        },
        _count: {
          select: {
            trades: true,
            comments: true
          }
        },
        comments: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true
              }
            }
          }
        }
      }
    });

    if (!market) {
      return res.status(404).json({
        success: false,
        error: 'Market not found'
      });
    }

    // Calculate current prices
    const prices = calculatePrices(toLmsr(market));

    res.json({
      success: true,
      data: {
        ...market,
        currentPrices: prices,
        outcomes: market.outcomes.map(o => ({
          ...o,
          currentPrice: prices[o.id]
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching market:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market'
    });
  }
});

/**
 * POST /api/markets
 * Create a new market (admin only)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Check admin permission
    if (!getUser(req)?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const { 
      title, 
      description, 
      category, 
      outcomes: outcomeNames,
      expiresAt,
      liquidityB = 1000
    } = req.body;

    // Validation
    if (!title || !category || !outcomeNames || !Array.isArray(outcomeNames) || outcomeNames.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Invalid market data. Need title, category, and at least 2 outcomes'
      });
    }

    if (!expiresAt || new Date(expiresAt) <= new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid expiry date'
      });
    }

    // Create market with outcomes in a transaction
    const market = await prisma.market.create({
      data: {
        title,
        description,
        category,
        expiresAt: new Date(expiresAt),
        liquidityB,
        status: MarketStatus.ACTIVE,
        outcomes: {
          create: outcomeNames.map((name: string, index: number) => ({
            name,
            color: index === 0 ? '#22c55e' : '#ef4444', // Green for first, red for second
            quantity: 0,
            probability: 1 / outcomeNames.length
          }))
        }
      },
      include: {
        outcomes: true
      }
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        action: 'CREATE_MARKET',
        entityType: 'Market',
        entityId: market.id,
        userId: getUser(req)!.id,
        details: { title, category, outcomeCount: outcomeNames.length }
      }
    });

    res.status(201).json({
      success: true,
      data: market
    });
  } catch (error) {
    console.error('Error creating market:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create market'
    });
  }
});

/**
 * POST /api/markets/:id/resolve
 * Resolve a market (admin only)
 */
router.post('/:id/resolve', async (req: Request, res: Response) => {
  try {
    // Check admin permission
    if (!getUser(req)?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const { id } = req.params;
    const { outcomeId } = req.body;

    // Find market
    const market = await prisma.market.findUnique({
      where: { id },
      include: {
        outcomes: true,
        trades: {
          include: {
            user: true
          }
        }
      }
    });

    if (!market) {
      return res.status(404).json({
        success: false,
        error: 'Market not found'
      });
    }

    if (market.status !== MarketStatus.ACTIVE) {
      return res.status(400).json({
        success: false,
        error: 'Market is not active'
      });
    }

    // Find winning outcome
    const winningOutcome = market.outcomes.find(o => o.id === outcomeId);
    if (!winningOutcome) {
      return res.status(400).json({
        success: false,
        error: 'Invalid outcome ID'
      });
    }

    // Get all holdings for this market
    const holdings = await prisma.holding.findMany({
      where: {
        marketId: id,
        quantity: { gt: 0 }
      },
      include: {
        user: true,
        outcome: true
      }
    });

    // Process in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update market status
      const updatedMarket = await tx.market.update({
        where: { id },
        data: {
          status: MarketStatus.RESOLVED,
          resolvedAt: new Date(),
          resolvedOutcomeId: outcomeId
        }
      });

      // Mark winning outcome
      await tx.outcome.update({
        where: { id: outcomeId },
        data: { isWinner: true }
      });

      // Credit winnings to holders
      const winningsTransactions = [];
      for (const holding of holdings) {
        if (holding.outcomeId === outcomeId) {
          // Winner: 1 credit per share
          const winnings = Math.floor(holding.quantity);
          
          if (winnings > 0) {
            // Update user balance
            await tx.user.update({
              where: { id: holding.userId },
              data: {
                creditBalance: { increment: winnings },
                totalCreditsEarned: { increment: winnings },
                winningTrades: { increment: 1 }
              }
            });

            // Record transaction
            await tx.transaction.create({
              data: {
                userId: holding.userId,
                amount: winnings,
                type: 'MARKET_RESOLVED',
                description: `Winnings from ${market.title}`,
                referenceId: market.id
              }
            });

            // Update holding to show resolved value
            await tx.holding.update({
              where: { id: holding.id },
              data: {
                currentValue: winnings,
                profitLoss: winnings - (holding.quantity * holding.avgCost)
              }
            });

            winningsTransactions.push({
              userId: holding.userId,
              amount: winnings
            });
          }
        } else {
          // Loser: value goes to zero
          await tx.holding.update({
            where: { id: holding.id },
            data: {
              currentValue: 0,
              profitLoss: -(holding.quantity * holding.avgCost)
            }
          });
        }
      }

      return { updatedMarket, winningsTransactions };
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        action: 'RESOLVE_MARKET',
        entityType: 'Market',
        entityId: id,
        userId: getUser(req)!.id,
        details: { outcomeId, winnersCount: result.winningsTransactions.length }
      }
    });

    // ──── Auto-resolve friend challenges for this market ────
    try {
      const acceptedChallenges = await prisma.friendChallenge.findMany({
        where: { marketId: id, status: 'ACCEPTED' },
      });

      for (const challenge of acceptedChallenges) {
        const challengerWon = challenge.challengerOutcomeId === outcomeId;
        const challengedWon = challenge.challengedOutcomeId === outcomeId;
        const totalPot = challenge.escrowCredits;

        let winnerId: string | null = null;
        let challengerPayout = 0;
        let challengedPayout = 0;

        if (challengerWon && !challengedWon) {
          // Challenger wins — gets full pot
          winnerId = challenge.challengerId;
          challengerPayout = totalPot;
        } else if (challengedWon && !challengerWon) {
          // Challenged wins — gets full pot
          winnerId = challenge.challengedId;
          challengedPayout = totalPot;
        } else {
          // Both right or both wrong — split evenly (refund)
          challengerPayout = Math.floor(totalPot / 2);
          challengedPayout = totalPot - challengerPayout;
        }

        await prisma.$transaction(async (tx) => {
          await tx.friendChallenge.update({
            where: { id: challenge.id },
            data: { status: 'COMPLETED', winnerId, escrowCredits: 0 },
          });

          if (challengerPayout > 0) {
            await tx.user.update({
              where: { id: challenge.challengerId },
              data: { creditBalance: { increment: challengerPayout } },
            });
            await tx.transaction.create({
              data: {
                userId: challenge.challengerId,
                amount: challengerPayout,
                type: 'MARKET_RESOLVED',
                description: `Challenge ${winnerId === challenge.challengerId ? 'won' : 'refund'}: ${market.title}`,
                referenceId: challenge.id,
              },
            });
          }

          if (challengedPayout > 0) {
            await tx.user.update({
              where: { id: challenge.challengedId },
              data: { creditBalance: { increment: challengedPayout } },
            });
            await tx.transaction.create({
              data: {
                userId: challenge.challengedId,
                amount: challengedPayout,
                type: 'MARKET_RESOLVED',
                description: `Challenge ${winnerId === challenge.challengedId ? 'won' : 'refund'}: ${market.title}`,
                referenceId: challenge.id,
              },
            });
          }
        });
      }
    } catch (challengeErr) {
      // Non-critical — log but don't fail the market resolution
      console.error('Error resolving challenges for market:', challengeErr);
    }

    // ──── Update tournament P&L for market resolution winnings ────
    try {
      for (const w of result.winningsTransactions) {
        const participations = await prisma.tournamentParticipant.findMany({
          where: { userId: w.userId, tournament: { status: 'ACTIVE' } },
          select: { id: true },
        });
        for (const p of participations) {
          await prisma.tournamentParticipant.update({
            where: { id: p.id },
            data: { pnl: { increment: w.amount } },
          });
        }
      }
    } catch (tournamentErr) {
      console.error('Error updating tournament PnL on resolution:', tournamentErr);
    }

    res.json({
      success: true,
      data: {
        market: result.updatedMarket,
        winningsDistributed: result.winningsTransactions.length
      }
    });
  } catch (error) {
    console.error('Error resolving market:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve market'
    });
  }
});

// (meta routes moved to top of file to avoid /:id conflict)

/**
 * POST /api/markets/:id/cancel
 * Cancel a market (admin only) — refunds all holders
 */
router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    if (!getUser(req)?.isAdmin) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { id } = req.params;
    const market = await prisma.market.findUnique({
      where: { id },
      include: { outcomes: true }
    });

    if (!market) return res.status(404).json({ success: false, error: 'Market not found' });
    if (market.status !== MarketStatus.ACTIVE) {
      return res.status(400).json({ success: false, error: 'Market is not active' });
    }

    const holdings = await prisma.holding.findMany({
      where: { marketId: id, quantity: { gt: 0 } }
    });

    await prisma.$transaction(async (tx) => {
      await tx.market.update({ where: { id }, data: { status: MarketStatus.CANCELLED } });

      for (const holding of holdings) {
        const refund = Math.round(holding.quantity * holding.avgCost);
        if (refund > 0) {
          await tx.user.update({
            where: { id: holding.userId },
            data: { creditBalance: { increment: refund } }
          });
          await tx.transaction.create({
            data: {
              userId: holding.userId,
              amount: refund,
              type: 'ADMIN_ADJUSTMENT',
              description: `Refund from cancelled market`,
              referenceId: id
            }
          });
        }
        await tx.holding.update({
          where: { id: holding.id },
          data: { currentValue: 0, profitLoss: -Math.round(holding.quantity * holding.avgCost) }
        });
      }
    });

    await prisma.auditLog.create({
      data: {
        action: 'CANCEL_MARKET',
        entityType: 'Market',
        entityId: id,
        userId: getUser(req)!.id,
        details: { refundedHolders: holdings.length }
      }
    });

    res.json({ success: true, data: { cancelled: true, refundedHolders: holdings.length } });
  } catch (error) {
    console.error('Error cancelling market:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel market' });
  }
});

// ============================================
// COMMENTS ENDPOINTS
// ============================================

/**
 * GET /api/markets/:id/comments
 * Paginated top-level comments with user info
 */
router.get('/:id/comments', async (req: Request, res: Response) => {
  try {
    const { limit = '20', offset = '0' } = req.query;

    const comments = await prisma.comment.findMany({
      where: { marketId: req.params.id, parentId: null },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        replies: {
          include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    return res.json({ success: true, data: comments });
  } catch (err) {
    console.error('GET /markets/:id/comments error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch comments' });
  }
});

/**
 * POST /api/markets/:id/comments
 * Create a new comment (auth required)
 */
router.post('/:id/comments', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { content, parentId } = req.body;
    const userId = getUser(req)!.id;

    if (!content?.trim()) {
      return res.status(400).json({ success: false, error: 'content is required' });
    }

    const market = await prisma.market.findUnique({ where: { id: req.params.id } });
    if (!market) return res.status(404).json({ success: false, error: 'Market not found' });

    const comment = await prisma.comment.create({
      data: {
        userId,
        marketId: req.params.id,
        content: content.trim(),
        parentId: parentId || null,
      },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    return res.status(201).json({ success: true, data: comment });
  } catch (err) {
    console.error('POST /markets/:id/comments error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create comment' });
  }
});

/**
 * POST /api/markets/:id/comments/:commentId/like
 * Increment likes on a comment
 */
router.post('/:id/comments/:commentId/like', authenticateUser, async (req: Request, res: Response) => {
  try {
    const comment = await prisma.comment.update({
      where: { id: req.params.commentId },
      data: { likes: { increment: 1 } },
      select: { id: true, likes: true },
    });

    return res.json({ success: true, data: comment });
  } catch (err) {
    console.error('POST /markets/:id/comments/:commentId/like error:', err);
    return res.status(500).json({ success: false, error: 'Failed to like comment' });
  }
});

export default router;
