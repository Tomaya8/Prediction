/**
 * Trades API Routes
 * Handles trade execution, portfolio, and market-price endpoints via LMSR
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { calculateBuyCost, calculateAllPrices, calculatePrice, calculateSharesForCost } from '../lib/lmsr';
import { authenticateUser } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const getUser = (req: Request) => (req as any).user as { id: string; isAdmin?: boolean } | undefined;

/**
 * Update tournament P&L for a user after a trade.
 * Tracks the credit delta (negative for buys, positive for sells) on all
 * active tournaments the user has joined.
 */
async function updateTournamentPnl(userId: string, creditDelta: number) {
  try {
    // Find active tournaments this user has joined
    const participations = await prisma.tournamentParticipant.findMany({
      where: {
        userId,
        tournament: { status: 'ACTIVE' },
      },
      select: { id: true },
    });
    if (participations.length === 0) return;

    // Increment P&L for each active tournament participation
    await Promise.all(
      participations.map(p =>
        prisma.tournamentParticipant.update({
          where: { id: p.id },
          data: { pnl: { increment: creditDelta } },
        })
      )
    );
  } catch (err) {
    // Non-critical — log but don't fail the trade
    console.error('updateTournamentPnl error:', err);
  }
}

// Helper to build LMSR-compatible market object from Prisma market
function toLmsrMarket(market: { id: string; liquidityB: number; outcomes: { id: string; name: string; quantity: number }[] }) {
  return {
    id: market.id,
    liquidityParameter: market.liquidityB,
    outcomes: market.outcomes.map(o => ({
      id: o.id,
      name: o.name,
      quantity: o.quantity,
    })),
  };
}

// ============================================================
// GET /api/trades/markets — list all markets with LMSR prices
// ============================================================
router.get('/markets', async (req: Request, res: Response) => {
  try {
    const { category, status = 'ACTIVE', limit = '20', offset = '0' } = req.query;

    const where: any = { status: status as string };
    if (category) where.category = category as string;

    const markets = await prisma.market.findMany({
      where,
      include: {
        outcomes: { select: { id: true, name: true, color: true, quantity: true, probability: true } },
      },
      orderBy: { totalVolume: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const result = markets.map(m => {
      const lmsr = toLmsrMarket(m);
      const prices = calculateAllPrices(lmsr);
      return { ...m, prices };
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('GET /trades/markets error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch markets' });
  }
});

// ============================================================
// GET /api/trades/markets/:id — single market with LMSR prices
// ============================================================
router.get('/markets/:id', async (req: Request, res: Response) => {
  try {
    const market = await prisma.market.findUnique({
      where: { id: req.params.id },
      include: {
        outcomes: { select: { id: true, name: true, color: true, quantity: true, probability: true, isWinner: true } },
        comments: {
          include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
          where: { parentId: null },
        },
      },
    });

    if (!market) {
      return res.status(404).json({ success: false, error: 'Market not found' });
    }

    const lmsr = toLmsrMarket(market);
    const prices = calculateAllPrices(lmsr);

    return res.json({ success: true, data: { ...market, prices } });
  } catch (err) {
    console.error('GET /trades/markets/:id error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch market' });
  }
});

// ============================================================
// POST /api/trades/preview — preview cost before executing (no auth required)
// ============================================================
router.post('/preview', async (req: Request, res: Response) => {
  try {
    const { marketId, outcomeId, amount } = req.body;
    if (!marketId || !outcomeId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Missing fields' });
    }
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      include: { outcomes: { select: { id: true, name: true, quantity: true } } },
    });
    if (!market) return res.status(404).json({ success: false, error: 'Market not found' });
    const lmsr = toLmsrMarket(market);
    const cost = Math.max(1, Math.round(calculateBuyCost(lmsr, outcomeId, amount)));
    const pricePerShare = cost / amount;
    return res.json({ success: true, data: { cost, pricePerShare, amount } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to preview trade' });
  }
});

// ============================================================
// POST /api/trades/preview-by-cost — given credits to spend, return shares + payout
// ============================================================
router.post('/preview-by-cost', async (req: Request, res: Response) => {
  try {
    const { marketId, outcomeId, credits } = req.body;
    if (!marketId || !outcomeId || !credits || credits <= 0) {
      return res.status(400).json({ success: false, error: 'Missing fields' });
    }
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      include: { outcomes: { select: { id: true, name: true, quantity: true } } },
    });
    if (!market) return res.status(404).json({ success: false, error: 'Market not found' });
    const lmsr = toLmsrMarket(market);
    const shares = calculateSharesForCost(lmsr, outcomeId, credits);
    if (shares === 0) {
      return res.json({ success: true, data: { shares: 0, actualCost: 0, maxPayout: 0, pricePerShare: 0 } });
    }
    const actualCost = Math.max(1, Math.round(calculateBuyCost(lmsr, outcomeId, shares)));
    return res.json({ success: true, data: { shares, actualCost, maxPayout: shares, pricePerShare: actualCost / shares } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to preview trade' });
  }
});

// ============================================================
// POST /api/trades/trade — execute a buy trade
// ============================================================
router.post('/trade', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { marketId, outcomeId, amount } = req.body;
    const userId = getUser(req)!.id;

    if (!marketId || !outcomeId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Missing or invalid fields: marketId, outcomeId, amount required' });
    }

    const market = await prisma.market.findUnique({
      where: { id: marketId },
      include: { outcomes: { select: { id: true, name: true, quantity: true } } },
    });

    if (!market) return res.status(404).json({ success: false, error: 'Market not found' });
    if (market.status !== 'ACTIVE') return res.status(400).json({ success: false, error: 'Market is not active' });

    const outcome = market.outcomes.find(o => o.id === outcomeId);
    if (!outcome) return res.status(404).json({ success: false, error: 'Outcome not found' });

    const lmsr = toLmsrMarket(market);
    const cost = Math.max(1, Math.round(calculateBuyCost(lmsr, outcomeId, amount)));
    const pricePerShare = cost / amount;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { creditBalance: true } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.creditBalance < cost) return res.status(400).json({ success: false, error: 'Insufficient credits' });

    // Execute in a transaction
    const newBalance = await prisma.$transaction(async (tx) => {
      // Update outcome quantity
      await tx.outcome.update({
        where: { id: outcomeId },
        data: { quantity: { increment: amount } },
      });

      // Deduct user balance
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          creditBalance: { decrement: cost },
          totalCreditsSpent: { increment: cost },
          totalTrades: { increment: 1 },
        },
        select: { creditBalance: true },
      });

      // Record trade
      await tx.trade.create({
        data: {
          userId,
          marketId,
          outcomeId,
          type: 'BUY',
          quantity: amount,
          pricePerShare,
          totalCost: cost,
        },
      });

      // Upsert holding
      const existing = await tx.holding.findUnique({
        where: { userId_marketId_outcomeId: { userId, marketId, outcomeId } },
      });
      if (existing) {
        const newQty = existing.quantity + amount;
        const newAvgCost = (existing.avgCost * existing.quantity + pricePerShare * amount) / newQty;
        await tx.holding.update({
          where: { id: existing.id },
          data: { quantity: newQty, avgCost: newAvgCost },
        });
      } else {
        await tx.holding.create({
          data: { userId, marketId, outcomeId, quantity: amount, avgCost: pricePerShare },
        });
      }

      // Record transaction
      await tx.transaction.create({
        data: {
          userId,
          amount: -cost,
          type: 'TRADE_BUY',
          description: `Bought ${amount} shares of ${outcome.name}`,
          referenceId: marketId,
        },
      });

      // Update market volume
      await tx.market.update({
        where: { id: marketId },
        data: { totalVolume: { increment: cost } },
      });

      return updatedUser.creditBalance;
    });

    // Get updated prices
    const updatedMarket = await prisma.market.findUnique({
      where: { id: marketId },
      include: { outcomes: { select: { id: true, name: true, quantity: true } } },
    });
    const updatedPrices = calculateAllPrices(toLmsrMarket(updatedMarket!));

    // Track tournament P&L (buy = negative delta)
    await updateTournamentPnl(userId, -cost);

    // Broadcast price update via WebSocket
    const { broadcastPriceUpdate } = require('../index');
    broadcastPriceUpdate(marketId, updatedPrices);

    return res.json({
      success: true,
      data: { cost, newBalance, prices: updatedPrices, shares: amount },
    });
  } catch (err) {
    console.error('POST /trades/trade error:', err);
    return res.status(500).json({ success: false, error: 'Failed to execute trade' });
  }
});

// ============================================================
// GET /api/trades/portfolio/:userId — user portfolio with P&L
// ============================================================
router.get('/portfolio/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const holdings = await prisma.holding.findMany({
      where: { userId, quantity: { gt: 0 } },
      include: {
        market: {
          include: {
            outcomes: { select: { id: true, name: true, quantity: true } },
          },
        },
        outcome: { select: { id: true, name: true, color: true, isWinner: true } },
      },
    });

    const portfolio = holdings.map(h => {
      const lmsr = toLmsrMarket(h.market);
      const currentPrice = calculatePrice(lmsr, h.outcomeId);
      const currentValue = Math.round(currentPrice * h.quantity * 100) / 100;
      const costBasis = Math.round(h.avgCost * h.quantity * 100) / 100;
      const profitLoss = Math.round((currentValue - costBasis) * 100) / 100;

      return {
        id: h.id,
        marketId: h.marketId,
        marketTitle: h.market.title,
        marketStatus: h.market.status,
        outcomeId: h.outcomeId,
        outcomeName: h.outcome.name,
        outcomeColor: h.outcome.color,
        isWinner: h.outcome.isWinner,
        quantity: h.quantity,
        avgCost: h.avgCost,
        currentPrice,
        currentValue,
        costBasis,
        profitLoss,
      };
    });

    return res.json({ success: true, data: portfolio });
  } catch (err) {
    console.error('GET /trades/portfolio/:userId error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch portfolio' });
  }
});

// ============================================================
// POST /api/trades/sell — sell shares (exit a position)
// ============================================================
router.post('/sell', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { marketId, outcomeId, amount } = req.body;
    const userId = getUser(req)!.id;

    if (!marketId || !outcomeId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Missing or invalid fields: marketId, outcomeId, amount required' });
    }

    const market = await prisma.market.findUnique({
      where: { id: marketId },
      include: { outcomes: { select: { id: true, name: true, quantity: true } } },
    });

    if (!market) return res.status(404).json({ success: false, error: 'Market not found' });
    if (market.status !== 'ACTIVE') return res.status(400).json({ success: false, error: 'Market is not active' });

    const outcome = market.outcomes.find(o => o.id === outcomeId);
    if (!outcome) return res.status(404).json({ success: false, error: 'Outcome not found' });

    // Check user has enough shares to sell
    const holding = await prisma.holding.findUnique({
      where: { userId_marketId_outcomeId: { userId, marketId, outcomeId } },
    });

    if (!holding || holding.quantity < amount) {
      return res.status(400).json({ success: false, error: `Insufficient shares. You own ${holding?.quantity ?? 0}` });
    }

    // LMSR sell cost: selling N shares = negative buy cost for -N shares
    // Revenue = -calculateBuyCost(market, outcomeId, -amount)
    const lmsr = toLmsrMarket(market);
    const revenue = Math.max(0, Math.round(-calculateBuyCost(lmsr, outcomeId, -amount)));

    const newBalance = await prisma.$transaction(async (tx) => {
      // Decrease outcome quantity
      await tx.outcome.update({
        where: { id: outcomeId },
        data: { quantity: { decrement: amount } },
      });

      // Credit user balance
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          creditBalance: { increment: revenue },
          totalCreditsEarned: { increment: revenue },
          totalTrades: { increment: 1 },
        },
        select: { creditBalance: true },
      });

      // Record trade
      await tx.trade.create({
        data: {
          userId,
          marketId,
          outcomeId,
          type: 'SELL',
          quantity: amount,
          pricePerShare: revenue / amount,
          totalCost: revenue,
        },
      });

      // Update holding
      const newQty = holding.quantity - amount;
      if (newQty <= 0) {
        await tx.holding.delete({ where: { id: holding.id } });
      } else {
        await tx.holding.update({
          where: { id: holding.id },
          data: { quantity: newQty },
        });
      }

      // Record transaction
      await tx.transaction.create({
        data: {
          userId,
          amount: revenue,
          type: 'TRADE_SELL',
          description: `Sold ${amount} shares of ${outcome.name}`,
          referenceId: marketId,
        },
      });

      // Update market volume
      await tx.market.update({
        where: { id: marketId },
        data: { totalVolume: { increment: revenue } },
      });

      return updatedUser.creditBalance;
    });

    // Get updated prices
    const updatedMarket = await prisma.market.findUnique({
      where: { id: marketId },
      include: { outcomes: { select: { id: true, name: true, quantity: true } } },
    });
    const updatedPrices = calculateAllPrices(toLmsrMarket(updatedMarket!));

    // Track tournament P&L (sell = positive delta)
    await updateTournamentPnl(userId, revenue);

    // Broadcast price update via WebSocket
    const { broadcastPriceUpdate } = require('../index');
    broadcastPriceUpdate(marketId, updatedPrices);

    return res.json({
      success: true,
      data: { revenue, newBalance, prices: updatedPrices, shares: amount },
    });
  } catch (err) {
    console.error('POST /trades/sell error:', err);
    return res.status(500).json({ success: false, error: 'Failed to execute sell trade' });
  }
});

// NOTE: Market resolution is handled by POST /api/markets/:id/resolve in markets.ts
// The duplicate resolve endpoint has been removed to avoid inconsistency.

export default router;
