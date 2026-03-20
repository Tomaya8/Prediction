/**
 * Leaderboard API Routes
 * RESTful endpoints for rankings and gamification
 */

import { Router, Request, Response } from 'express';
import { PrismaClient, LeaderboardPeriod, ScoreType } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const getUser = (req: Request) => (req as any).user as { id: string; isAdmin?: boolean } | undefined;

// ============================================
// LEADERBOARD ENDPOINTS
// ============================================

/**
 * GET /api/leaderboard
 * Get global leaderboard
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { period = 'ALL_TIME', scoreType = 'CREDITS', limit = '50' } = req.query;

    // Try to get from snapshot first
    const snapshot = await prisma.leaderboardSnapshot.findFirst({
      where: {
        period: period as LeaderboardPeriod,
        scoreType: scoreType as ScoreType,
        recordedAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Within last hour
        }
      },
      orderBy: { recordedAt: 'desc' }
    });

    let leaderboard;

    if (snapshot) {
      // Get users from snapshot
      const snapshots = await prisma.leaderboardSnapshot.findMany({
        where: {
          period: period as LeaderboardPeriod,
          scoreType: scoreType as ScoreType,
          recordedAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000)
          }
        },
        orderBy: { rank: 'asc' },
        take: parseInt(limit as string),
      });

      const userIds = snapshots.map(s => s.userId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, displayName: true, avatarUrl: true }
      });
      const userMap = Object.fromEntries(users.map(u => [u.id, u]));

      leaderboard = snapshots.map(s => ({
        rank: s.rank,
        userId: s.userId,
        displayName: userMap[s.userId]?.displayName,
        avatarUrl: userMap[s.userId]?.avatarUrl,
        score: s.score
      }));
    } else {
      // Calculate live leaderboard using DB-level sort + pagination
      const take = Math.min(parseInt(limit as string) || 50, 100);
      const users = await prisma.user.findMany({
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          creditBalance: true,
          roi: true,
          totalTrades: true,
          winningTrades: true,
        },
        orderBy: scoreType === 'ROI' ? { roi: 'desc' } : { creditBalance: 'desc' },
        take,
      });

      leaderboard = users.map((u, index) => ({
        rank: index + 1,
        userId: u.id,
        displayName: u.displayName || 'Anonymous',
        avatarUrl: u.avatarUrl,
        score: scoreType === 'ROI' ? u.roi : u.creditBalance,
        winRate: u.totalTrades > 0 ? Math.round((u.winningTrades / u.totalTrades) * 100) : 0,
        totalTrades: u.totalTrades,
      }));
    }

    // Get current user's rank if authenticated
    let userRank = null;
    if (getUser(req)?.id) {
      const userEntry = leaderboard.find((l: any) => l.userId === getUser(req)?.id);
      if (userEntry) {
        userRank = userEntry.rank;
      }
    }

    res.json({
      success: true,
      data: {
        leaderboard,
        period,
        scoreType,
        userRank
      }
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard'
    });
  }
});

/**
 * GET /api/leaderboard/me
 * Get current user's rank and nearby users
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const userId = getUser(req)?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { scoreType = 'CREDITS' } = req.query;

    // Get all users sorted by score
    const users = await prisma.user.findMany({
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        creditBalance: true,
        roi: true,
        totalTrades: true,
        winningTrades: true
      },
      orderBy: scoreType === 'ROI' ? { roi: 'desc' } : { creditBalance: 'desc' }
    });

    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const rank = userIndex + 1;
    const user = users[userIndex];

    // Get 3 users above and below
    const start = Math.max(0, userIndex - 3);
    const end = Math.min(users.length, userIndex + 4);
    const nearby = users.slice(start, end).map((u, i) => ({
      rank: start + i + 1,
      userId: u.id,
      displayName: u.displayName || 'Anonymous',
      avatarUrl: u.avatarUrl,
      score: scoreType === 'ROI' ? u.roi : u.creditBalance,
      isCurrentUser: u.id === userId
    }));

    res.json({
      success: true,
      data: {
        rank,
        score: scoreType === 'ROI' ? user.roi : user.creditBalance,
        nearby,
        totalUsers: users.length
      }
    });
  } catch (error) {
    console.error('Error fetching user rank:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rank'
    });
  }
});

/**
 * GET /api/leaderboard/achievements
 * Get all achievements
 */
router.get('/achievements', async (req: Request, res: Response) => {
  try {
    const achievements = await prisma.achievement.findMany({
      orderBy: { criteriaValue: 'asc' }
    });

    // Get user's earned achievements if authenticated
    let userAchievements: string[] = [];
    if (getUser(req)?.id) {
      const userAchievementsData = await prisma.userAchievement.findMany({
        where: { userId: getUser(req)!.id },
        select: { achievementId: true }
      });
      userAchievements = userAchievementsData.map(a => a.achievementId);
    }

    const achievementsWithStatus = achievements.map(a => ({
      id: a.id,
      code: a.code,
      name: a.name,
      description: a.description,
      iconUrl: a.iconUrl,
      creditReward: a.creditReward,
      criteriaType: a.criteriaType,
      criteriaValue: a.criteriaValue,
      earned: userAchievements.includes(a.id)
    }));

    res.json({
      success: true,
      data: achievementsWithStatus
    });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch achievements'
    });
  }
});

/**
 * GET /api/leaderboard/achievements/me
 * Get current user's achievements
 */
router.get('/achievements/me', async (req: Request, res: Response) => {
  try {
    const userId = getUser(req)?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId },
      include: {
        achievement: true
      },
      orderBy: { earnedAt: 'desc' }
    });

    const totalCreditsEarned = userAchievements.reduce(
      (sum, a) => sum + a.achievement.creditReward, 
      0
    );

    res.json({
      success: true,
      data: {
        achievements: userAchievements.map(ua => ({
          code: ua.achievement.code,
          name: ua.achievement.name,
          description: ua.achievement.description,
          iconUrl: ua.achievement.iconUrl,
          creditReward: ua.achievement.creditReward,
          earnedAt: ua.earnedAt
        })),
        totalEarned: totalCreditsEarned,
        count: userAchievements.length
      }
    });
  } catch (error) {
    console.error('Error fetching user achievements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch achievements'
    });
  }
});

/**
 * POST /api/leaderboard/refresh
 * Refresh leaderboard snapshot (admin only)
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    // Check admin permission
    if (!getUser(req)?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const { period = 'ALL_TIME' } = req.body;

    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        creditBalance: true,
        roi: true
      }
    });

    // Sort by credits
    const byCredits = [...users].sort((a, b) => b.creditBalance - a.creditBalance);
    
    // Sort by ROI (only users with trades)
    const withTrades = users.filter(u => u.roi !== 0);
    const byRoi = [...withTrades].sort((a, b) => b.roi - a.roi);

    // Create snapshots
    const now = new Date();
    
    await prisma.$transaction([
      // Credit leaderboard
      ...byCredits.map((user, index) => 
        prisma.leaderboardSnapshot.create({
          data: {
            period: period as LeaderboardPeriod,
            userId: user.id,
            rank: index + 1,
            score: user.creditBalance,
            scoreType: ScoreType.CREDITS,
            recordedAt: now
          }
        })
      ),
      // ROI leaderboard
      ...byRoi.map((user, index) => 
        prisma.leaderboardSnapshot.create({
          data: {
            period: period as LeaderboardPeriod,
            userId: user.id,
            rank: index + 1,
            score: user.roi,
            scoreType: ScoreType.ROI,
            recordedAt: now
          }
        })
      )
    ]);

    res.json({
      success: true,
      data: {
        creditLeaders: byCredits.slice(0, 10).map((u, i) => ({
          rank: i + 1,
          userId: u.id,
          score: u.creditBalance
        })),
        roiLeaders: byRoi.slice(0, 10).map((u, i) => ({
          rank: i + 1,
          userId: u.id,
          score: u.roi
        }))
      }
    });
  } catch (error) {
    console.error('Error refreshing leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh leaderboard'
    });
  }
});

export default router;
