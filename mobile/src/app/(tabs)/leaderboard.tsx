import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../lib/colors';
import { apiClient } from '../../lib/api-client';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  score: number;
  winRate?: number;
  totalTrades?: number;
  isCurrentUser?: boolean;
}

type ScoreType = 'credits' | 'roi';

export default function LeaderboardScreen() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scoreType, setScoreType] = useState<ScoreType>('credits');
  const [userRank, setUserRank] = useState<number | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await apiClient.getLeaderboard(scoreType);
      if (res.success && res.data) {
        const data = res.data as any;
        setLeaderboard(data.leaderboard ?? data);
        setUserRank(data.userRank ?? null);
        setError(null);
      } else {
        setError(res.error ?? 'Failed to load leaderboard');
      }
    } catch {
      setError('Failed to load leaderboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scoreType]);

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaderboard();
  };

  const formatScore = (score: number) => {
    if (scoreType === 'roi') return `${score.toFixed(1)}%`;
    if (score >= 1000) return `${(score / 1000).toFixed(1)}K`;
    return score.toLocaleString();
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return Colors.gold;
    if (rank === 2) return Colors.silver;
    if (rank === 3) return Colors.bronze;
    return Colors.textSecondary;
  };

  const getRankIcon = (rank: number): string => {
    if (rank === 1) return 'trophy';
    if (rank === 2) return 'medal-outline';
    if (rank === 3) return 'ribbon-outline';
    return '';
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => { setLoading(true); fetchLeaderboard(); }} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Score type toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleButton, scoreType === 'credits' && styles.toggleActive]}
          onPress={() => setScoreType('credits')}
        >
          <Ionicons name="diamond-outline" size={16} color={scoreType === 'credits' ? Colors.textPrimary : Colors.textSecondary} />
          <Text style={[styles.toggleText, scoreType === 'credits' && styles.toggleTextActive]}>Credits</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, scoreType === 'roi' && styles.toggleActive]}
          onPress={() => setScoreType('roi')}
        >
          <Ionicons name="trending-up-outline" size={16} color={scoreType === 'roi' ? Colors.textPrimary : Colors.textSecondary} />
          <Text style={[styles.toggleText, scoreType === 'roi' && styles.toggleTextActive]}>ROI</Text>
        </TouchableOpacity>
      </View>

      {/* User rank banner */}
      {userRank != null && (
        <View style={styles.userRankBanner}>
          <Text style={styles.userRankLabel}>Your Rank</Text>
          <Text style={styles.userRankValue}>#{userRank}</Text>
        </View>
      )}

      {/* Leaderboard list */}
      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {leaderboard.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={40} color={Colors.textMuted} style={{ marginBottom: Spacing.md }} />
            <Text style={styles.emptyText}>No rankings yet</Text>
            <Text style={styles.emptySubtext}>Start trading to appear on the leaderboard</Text>
          </View>
        ) : (
          leaderboard.map((entry) => {
            const rankIcon = getRankIcon(entry.rank);
            return (
              <View
                key={entry.userId}
                style={[styles.entryCard, entry.isCurrentUser && styles.currentUserCard]}
              >
                {/* Rank */}
                <View style={styles.rankContainer}>
                  {rankIcon ? (
                    <Ionicons name={rankIcon as any} size={22} color={getRankColor(entry.rank)} />
                  ) : (
                    <Text style={[styles.rankText, { color: getRankColor(entry.rank) }]}>
                      {entry.rank}
                    </Text>
                  )}
                </View>

                {/* Avatar */}
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(entry.displayName || 'A').charAt(0).toUpperCase()}
                  </Text>
                </View>

                {/* User info */}
                <View style={styles.userInfo}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {entry.displayName || 'Anonymous'}
                    {entry.isCurrentUser ? ' (You)' : ''}
                  </Text>
                  {entry.totalTrades != null && (
                    <Text style={styles.userStats}>
                      {entry.totalTrades} trades
                      {entry.winRate != null ? ` · ${entry.winRate.toFixed(0)}% win` : ''}
                    </Text>
                  )}
                </View>

                {/* Score */}
                <Text style={styles.scoreText}>{formatScore(entry.score)}</Text>
              </View>
            );
          })
        )}

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            Credits have no real-world value. This is not gambling.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: Colors.danger,
    fontSize: 15,
    marginBottom: Spacing.md,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  retryText: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  toggleContainer: {
    flexDirection: 'row',
    margin: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.xs,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  toggleActive: {
    backgroundColor: Colors.primary,
  },
  toggleText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: Colors.textPrimary,
  },
  userRankBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  userRankLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  userRankValue: {
    color: Colors.primary,
    fontSize: 24,
    fontWeight: '700',
  },
  list: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    padding: Spacing.xxxl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
  },
  emptyText: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  emptySubtext: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    marginTop: Spacing.xs,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  currentUserCard: {
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  rankContainer: {
    width: 30,
    alignItems: 'center',
  },
  rankText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  userStats: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  scoreText: {
    color: Colors.primary,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  disclaimer: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  disclaimerText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
});
