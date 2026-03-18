/**
 * Trades API Routes
 * RESTful endpoints for trading operations
 */

import { Router, Request, Response } from 'express';
import { PrismaClient, TradeType } from '@prisma/client';
import { executeBuy, executeSell, calculatePrices } from '../lib/lmsr';

const router = Router();
const prisma = new PrismaClient();

// ============================================
// TRADE ENDPOINTS
// ============================================

/**
 * POST /api/trades
 * Execute a trade (buy or sell)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Get user from auth middleware
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { marketId, outcomeId, quantity, type } = req.body;

    // Validation
    if (!marketId || !outcomeId || !quantity || !type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: marketId, outcomeId, quantity, type'
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Quantity must be positive'
      });
    }

    if (!['BUY', 'SELL'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Type must be BUY or SELL'
      });
    }

    // Get market with outcomes
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      include: {
        outcomes: true
      }
    });

    if (!market) {
      return res.status(404).json({
        success: false,
        error: 'Market not found'
      });
    }

    if (market.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: 'Market is not active for trading'
      });
    }

    if (new Date() > new Date(market.expiresAt)) {
      return res.status(400).json({
        success: false,
        error: 'Market has expired'
      });
    }

    // Find outcome
    const outcomeIndex = market.outcomes.findIndex(o => o.id === outcomeId);
    if (outcomeIndex === -1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid outcome'
      });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Prepare LMSR market
    const lmsrMarket = {
      id: market.id,
      liquidityB: market.liquidityB,
      outcomes: market.outcomes.map(o => ({
        id: o.id,
        name: o.name,
        quantity: parseFloat(o.quantity.toString())
      }))
    };

    let tradeResult;
    let isBuy = type === 'BUY';

    if (isBuy) {
      // Execute buy
      tradeResult = executeBuy(lmsrMarket, outcomeIndex, quantity, user.creditBalance);
    } else {
      // Check user's holding for sell
      const holding = await prisma.holding.findUnique({
        where: {
          userId_marketId_outcomeId: {
            userId,
            marketId,
            outcomeId
          }
        }
      });

      const currentHolding = holding ? parseFloat(holding.quantity.toString()) : 0;
      tradeResult = executeSell(lmsrMarket, outcomeIndex, quantity, currentHolding);
    }

    if (!tradeResult.success) {
      return res.status(400).json({
        success: false,
        error: tradeResult.error
      });
    }

    // Execute trade in transaction
    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();
      
      if (isBuy) {
        // Deduct credits
        await tx.user.update({
          where: { id: userId },
          data: {
            creditBalance: { decrement: tradeResult.cost! },
            totalCreditsSpent: { increment: tradeResult.cost! },
            totalTrades: { increment: 1 }
          }
        });

        // Record transaction
        await tx.transaction.create({
          data: {
            userId,
            amount: -tradeResult.cost!,
            type: 'TRADE_BUY',
            description: `Buy ${quantity} shares of ${market.outcomes[outcomeIndex].name}`,
            referenceId: market.id
          }
        });

        // Update or create holding
        const existingHolding = await tx.holding.findUnique({
          where: {
            userId_marketId_outcomeId: {
              userId,
              marketId,
              outcomeId
            }
          }
        });

        if (existingHolding) {
          // Calculate new average cost
          const totalCost = (existingHolding.quantity * existingHolding.avgCost) + tradeResult.cost!;
          const newQuantity = existingHolding.quantity + quantity;
          const newAvgCost = totalCost / newQuantity;

          await tx.holding.update({
            where: { id: existingHolding.id },
            data: {
              quantity: newQuantity,
              avgCost: newAvgCost,
              currentValue: Math.round(tradeResult.cost! * 100) / 100
            }
          });
        } else {
          await tx.holding.create({
            data: {
              userId,
              marketId,
              outcomeId,
              quantity,
              avgCost: tradeResult.cost! / quantity,
              currentValue: tradeResult.cost!
            }
          });
        }
      } else {
        // Add credits (revenue is negative cost)
        const revenue = -tradeResult.cost!;
        
        await tx.user.update({
          where: { id: userId },
          data: {
            creditBalance: { increment: revenue },
            totalCreditsEarned: { increment: revenue }
          }
        });

        // Record transaction
        await tx.transaction.create({
          data: {
            userId,
            amount: revenue,
            type: 'TRADE_SELL',
            description: `Sell ${quantity} shares of ${market.outcomes[outcomeIndex].name}`,
            referenceId: market.id
          }
        });

        // Update holding
        const holding = await tx.holding.findUnique({
          where: {
            userId_marketId_outcomeId: {
              userId,
              marketId,
              outcomeId
            }
          }
        });

        if (holding) {
          const newQuantity = holding.quantity - quantity;
          if (newQuantity <= 0) {
            await tx.holding.delete({
              where: { id: holding.id }
            });
          } else {
            await tx.holding.update({
              where: { id: holding.id },
              data: {
                quantity: newQuantity,
                currentValue: Math.round((newQuantity * tradeResult.prices![outcomeIndex]) * 100) / 100
              }
            });
          }
        }
      }

      // Update outcome quantity
      await tx.outcome.update({
        where: { id: outcomeId },
        data: {
          quantity: tradeResult.newQuantity,
          probability: tradeResult.prices![outcomeIndex]
        }
      });

      // Update market volume
      await tx.market.update({
        where: { id: marketId },
        data: {
          totalVolume: { increment: Math.abs(tradeResult.cost!) }
        }
      });

      // Record trade
      const trade = await tx.trade.create({
        data: {
          userId,
          marketId,
          outcomeId,
          type: isBuy ? TradeType.BUY : TradeType.SELL,
          quantity,
          pricePerShare: tradeResult.prices![outcomeIndex],
          totalCost: Math.abs(tradeResult.cost!)
        }
      });

      return trade;
    });

    // Emit WebSocket event for price update
    if (req.io) {
      req.io.to(`market:${marketId}`).emit('priceUpdate', {
        marketId,
        outcomeId,
        newQuantity: tradeResult.newQuantity,
        prices: tradeResult.prices
      });
    }

    res.status(201).json({
      success: true,
      data: {
        trade: result,
        cost: tradeResult.cost,
        newPrices: tradeResult.prices
      }
    });
  } catch (error) {
    console.error('Error executing trade:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute trade'
    });
  }
});

/**
 * GET /api/trades
 * Get user's trade history
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { marketId, limit = '50', offset = '0' } = req.query;

    const where: any = { userId };
    if (marketId) {
      where.marketId = marketId;
    }

    const trades = await prisma.trade.findMany({
      where,
      include: {
        market: {
          select: {
            id: true,
            title: true,
            category: true
          }
        },
        outcome: {
          select: {
            id: true,
            name: true,
            color: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    res.json({
      success: true,
      data: trades
    });
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trades'
    });
  }
});

/**
 * GET /api/trades/portfolio
 * Get user's portfolio (holdings)
 */
router.get('/portfolio', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const holdings = await prisma.holding.findMany({
      where: {
        userId,
        quantity: { gt: 0 }
      },
      include: {
        market: {
          select: {
            id: true,
            title: true,
            category: true,
            status: true,
            expiresAt: true,
            resolvedOutcomeId: true
          }
        },
        outcome: {
          select: {
            id: true,
            name: true,
            color: true,
            isWinner: true,
            probability: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Calculate total portfolio value
    let totalValue = 0;
    let totalCost = 0;

    const holdingsWithValue = holdings.map(h => {
      const value = h.quantity * h.outcome.probability;
      totalValue += value;
      totalCost += h.quantity * h.avgCost;
      
      return {
        ...h,
        currentValue: Math.round(value * 100) / 100,
        profitLoss: Math.round((value - (h.quantity * h.avgCost)) * 100) / 100,
        roi: h.avgCost > 0 ? ((value - (h.quantity * h.avgCost)) / (h.quantity * h.avgCost)) * 100 : 0
      };
    });

    res.json({
      success: true,
      data: {
        holdings: holdingsWithValue,
        summary: {
          totalValue: Math.round(totalValue * 100) / 100,
          totalCost: Math.round(totalCost * 100) / 100,
          totalProfitLoss: Math.round((totalValue - totalCost) * 100) / 100,
          holdingCount: holdings.length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch portfolio'
    });
  }
});

export default router;
