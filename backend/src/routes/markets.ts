/**
 * Markets API Routes
 * RESTful endpoints for market operations
 */

import { Router, Request, Response } from 'express';
import { PrismaClient, MarketCategory, MarketStatus } from '@prisma/client';
import { calculatePrices } from '../lib/lmsr';

const router = Router();
const prisma = new PrismaClient();

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
    if (!req.user?.isAdmin) {
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
      const lmsrMarket = {
        id: market.id,
        liquidityB: market.liquidityB,
        outcomes: market.outcomes.map(o => ({
          id: o.id,
          name: o.name,
          quantity: o.quantity
        }))
      };
      
      const prices = calculatePrices(lmsrMarket);
      
      return {
        ...market,
        currentPrices: prices,
        outcomes: market.outcomes.map((o, i) => ({
          ...o,
          currentPrice: prices[i]
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
    const lmsrMarket = {
      id: market.id,
      liquidityB: market.liquidityB,
      outcomes: market.outcomes.map(o => ({
        id: o.id,
        name: o.name,
        quantity: o.quantity
      }))
    };
    
    const prices = calculatePrices(lmsrMarket);

    res.json({
      success: true,
      data: {
        ...market,
        currentPrices: prices,
        outcomes: market.outcomes.map((o, i) => ({
          ...o,
          currentPrice: prices[i]
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
    if (!req.user?.isAdmin) {
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
        userId: req.user.id,
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
    if (!req.user?.isAdmin) {
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
        userId: req.user.id,
        details: { outcomeId, winnersCount: result.winningsTransactions.length }
      }
    });

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

/**
 * GET /api/markets/categories
 * Get available market categories
 */
router.get('/meta/categories', async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: Object.values(MarketCategory)
  });
});

/**
 * GET /api/markets/trending
 * Get trending markets (by volume)
 */
router.get('/meta/trending', async (req: Request, res: Response) => {
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

export default router;
