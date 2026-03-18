/**
 * Users API Routes
 * RESTful endpoints for user management, credits, and profile
 */

import { Router, Request, Response } from 'express';
import { PrismaClient, TransactionType } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ============================================
// USER ENDPOINTS
// ============================================

/**
 * GET /api/users/me
 * Get current user's profile
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        creditBalance: true,
        totalCreditsEarned: true,
        totalCreditsSpent: true,
        totalTrades: true,
        winningTrades: true,
        totalWinnings: true,
        roi: true,
        currentStreak: true,
        longestStreak: true,
        isPremium: true,
        premiumExpiresAt: true,
        createdAt: true,
        lastActiveDate: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Calculate win rate
    const winRate = user.totalTrades > 0 
      ? (user.winningTrades / user.totalTrades) * 100 
      : 0;

    res.json({
      success: true,
      data: {
        ...user,
        winRate: Math.round(winRate * 100) / 100
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  }
});

/**
 * PUT /api/users/me
 * Update user profile
 */
router.put('/me', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { displayName, avatarUrl } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(displayName && { displayName }),
        ...(avatarUrl && { avatarUrl })
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        creditBalance: true
      }
    });

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user'
    });
  }
});

/**
 * GET /api/users/me/transactions
 * Get user's transaction history
 */
router.get('/me/transactions', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { type, limit = '50', offset = '0' } = req.query;

    const where: any = { userId };
    if (type) {
      where.type = type as TransactionType;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transactions'
    });
  }
});

/**
 * GET /api/users/me/stats
 * Get user's detailed statistics
 */
router.get('/me/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get recent activity
    const recentTrades = await prisma.trade.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        market: { select: { title: true } },
        outcome: { select: { name: true } }
      }
    });

    // Get achievements
    const achievements = await prisma.userAchievement.findMany({
      where: { userId },
      include: {
        achievement: true
      },
      orderBy: { earnedAt: 'desc' }
    });

    // Calculate win rate
    const winRate = user.totalTrades > 0 
      ? (user.winningTrades / user.totalTrades) * 100 
      : 0;

    // Calculate average trade size
    const avgTradeSize = user.totalTrades > 0 
      ? user.totalCreditsSpent / user.totalTrades 
      : 0;

    res.json({
      success: true,
      data: {
        overview: {
          creditBalance: user.creditBalance,
          totalCreditsEarned: user.totalCreditsEarned,
          totalCreditsSpent: user.totalCreditsSpent,
          totalTrades: user.totalTrades,
          winningTrades: user.winningTrades,
          winRate: Math.round(winRate * 100) / 100,
          roi: user.roi,
          avgTradeSize: Math.round(avgTradeSize * 100) / 100
        },
        streaks: {
          current: user.currentStreak,
          longest: user.longestStreak,
          lastActive: user.lastActiveDate
        },
        premium: {
          isPremium: user.isPremium,
          expiresAt: user.premiumExpiresAt
        },
        recentTrades,
        achievements: achievements.map(a => ({
          code: a.achievement.code,
          name: a.achievement.name,
          description: a.achievement.description,
          earnedAt: a.earnedAt
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats'
    });
  }
});

/**
 * POST /api/users/me/daily-reward
 * Claim daily login reward
 */
router.post('/me/daily-reward', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if already claimed today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (user.lastActiveDate && new Date(user.lastActiveDate) >= today) {
      return res.status(400).json({
        success: false,
        error: 'Daily reward already claimed',
        nextReward: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      });
    }

    // Calculate reward based on streak
    const baseReward = 50;
    const streakBonus = Math.min(user.currentStreak * 10, 100); // Max 100 bonus
    const totalReward = baseReward + streakBonus;

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        creditBalance: { increment: totalReward },
        totalCreditsEarned: { increment: totalReward },
        currentStreak: user.currentStreak + 1,
        longestStreak: Math.max(user.longestStreak, user.currentStreak + 1),
        lastActiveDate: new Date()
      }
    });

    // Record transaction
    await prisma.transaction.create({
      data: {
        userId,
        amount: totalReward,
        type: 'DAILY_REWARD',
        description: `Daily reward (streak: ${updatedUser.currentStreak})`
      }
    });

    // Check for streak achievements
    await checkAndAwardAchievements(userId, 'STREAK', updatedUser.currentStreak);

    res.json({
      success: true,
      data: {
        reward: totalReward,
        streak: updatedUser.currentStreak,
        balance: updatedUser.creditBalance
      }
    });
  } catch (error) {
    console.error('Error claiming daily reward:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to claim daily reward'
    });
  }
});

/**
 * POST /api/users/me/buy-credits
 * Purchase credits (mock - in production would integrate with payment processor)
 */
router.post('/me/buy-credits', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { packCode } = req.body;

    // Get credit pack
    const pack = await prisma.creditPack.findUnique({
      where: { code: packCode }
    });

    if (!pack || !pack.isActive) {
      return res.status(400).json({
        success: false,
        error: 'Invalid credit pack'
      });
    }

    // In production: Validate payment here
    // For now: Just add credits (mock purchase)

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        creditBalance: { increment: pack.credits },
        totalCreditsEarned: { increment: pack.credits }
      }
    });

    // Record transaction
    await prisma.transaction.create({
      data: {
        userId,
        amount: pack.credits,
        type: 'CREDIT_PURCHASE',
        description: `Purchased ${pack.name}`,
        referenceId: pack.id
      }
    });

    res.json({
      success: true,
      data: {
        creditsAdded: pack.credits,
        newBalance: user.creditBalance,
        pack: pack.name
      }
    });
  } catch (error) {
    console.error('Error purchasing credits:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to purchase credits'
    });
  }
});

/**
 * GET /api/users/credit-packs
 * Get available credit packs
 */
router.get('/credit-packs', async (req: Request, res: Response) => {
  try {
    const packs = await prisma.creditPack.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' }
    });

    res.json({
      success: true,
      data: packs
    });
  } catch (error) {
    console.error('Error fetching credit packs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch credit packs'
    });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function checkAndAwardAchievements(userId: string, type: string, value: number) {
  const achievements = await prisma.achievement.findMany({
    where: {
      criteriaType: type,
      criteriaValue: { lte: value }
    }
  });

  for (const achievement of achievements) {
    // Check if user already has this achievement
    const existing = await prisma.userAchievement.findUnique({
      where: {
        userId_achievementId: {
          userId,
          achievementId: achievement.id
        }
      }
    });

    if (!existing && achievement.creditReward > 0) {
      // Award achievement and credits
      await prisma.$transaction([
        prisma.userAchievement.create({
          data: {
            userId,
            achievementId: achievement.id
          }
        }),
        prisma.user.update({
          where: { id: userId },
          data: {
            creditBalance: { increment: achievement.creditReward },
            totalCreditsEarned: { increment: achievement.creditReward }
          }
        }),
        prisma.transaction.create({
          data: {
            userId,
            amount: achievement.creditReward,
            type: 'ACHIEVEMENT_REWARD',
            description: `Achievement: ${achievement.name}`
          }
        })
      ]);
    }
  }
}

export default router;
