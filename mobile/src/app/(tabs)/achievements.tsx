import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../../lib/colors';
import { apiClient } from '../../lib/api-client';

interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  iconUrl?: string;
  creditReward: number;
  criteriaType: string;
  criteriaValue: number;
  earned: boolean;
}

export default function AchievementsScreen() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = ['All', 'STREAK', 'TRADES', 'WINS', 'CREDITS'];

  const fetchAchievements = useCallback(async () => {
    try {
      const res = await apiClient.getAchievements();
      if (res.success && res.data) {
        setAchievements(res.data as Achievement[]);
        setError(null);
      } else {
        setError(res.error ?? 'Failed to load achievements');
      }
    } catch {
      setError('Failed to load achievements');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAchievements();
  };

  const filteredAchievements = selectedCategory === 'All'
    ? achievements
    : achievements.filter(a => a.criteriaType === selectedCategory);

  const unlockedCount = achievements.filter(a => a.earned).length;
  const totalRewards = achievements
    .filter(a => a.earned)
    .reduce((sum, a) => sum + a.creditReward, 0);

  const getIconForType = (type: string): string => {
    switch (type) {
      case 'STREAK': return '🔥';
      case 'TRADES': return '📊';
      case 'WINS': return '🏆';
      case 'CREDITS': return '💰';
      default: return '⭐';
    }
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
        <TouchableOpacity onPress={() => { setLoading(true); fetchAchievements(); }} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Stats */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{unlockedCount}</Text>
          <Text style={styles.statLabel}>Unlocked</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{achievements.length - unlockedCount}</Text>
          <Text style={styles.statLabel}>Remaining</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, styles.rewardValue]}>{totalRewards}</Text>
          <Text style={styles.statLabel}>Earned</Text>
        </View>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesScroll}
        contentContainerStyle={styles.categoriesContent}
      >
        {categories.map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryButton,
              selectedCategory === category && styles.categoryButtonActive,
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text style={[
              styles.categoryText,
              selectedCategory === category && styles.categoryTextActive,
            ]}>
              {category === 'All' ? 'All' : category.charAt(0) + category.slice(1).toLowerCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Achievements List */}
      <ScrollView
        style={styles.achievementsList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {filteredAchievements.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏅</Text>
            <Text style={styles.emptyText}>No achievements found</Text>
          </View>
        ) : (
          filteredAchievements.map((achievement) => (
            <View
              key={achievement.id}
              style={[
                styles.achievementCard,
                achievement.earned && styles.achievementUnlocked,
              ]}
            >
              <View style={[
                styles.iconContainer,
                !achievement.earned && styles.iconLocked,
              ]}>
                <Text style={styles.icon}>{getIconForType(achievement.criteriaType)}</Text>
              </View>

              <View style={styles.achievementContent}>
                <Text style={[
                  styles.achievementTitle,
                  !achievement.earned && styles.textLocked,
                ]}>
                  {achievement.name}
                </Text>
                <Text style={styles.achievementDescription}>
                  {achievement.description}
                </Text>
              </View>

              <View style={styles.rewardContainer}>
                {achievement.earned ? (
                  <Text style={styles.unlockedBadge}>✓</Text>
                ) : (
                  <View style={styles.rewardBadge}>
                    <Text style={styles.rewardAmount}>+{achievement.creditReward}</Text>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
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
  statsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    margin: Spacing.lg,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  rewardValue: {
    color: Colors.primary,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  categoriesScroll: {
    maxHeight: 50,
  },
  categoriesContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  categoryButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    marginRight: Spacing.sm,
  },
  categoryButtonActive: {
    backgroundColor: Colors.primary,
  },
  categoryText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: Colors.textPrimary,
  },
  achievementsList: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    padding: Spacing.xxxl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: Spacing.md,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: FontSize.lg,
  },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    opacity: 0.7,
  },
  achievementUnlocked: {
    opacity: 1,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconLocked: {
    backgroundColor: Colors.background,
  },
  icon: {
    fontSize: 24,
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  achievementDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  textLocked: {
    color: Colors.textSecondary,
  },
  rewardContainer: {
    marginLeft: Spacing.md,
  },
  rewardBadge: {
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.md,
  },
  rewardAmount: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  unlockedBadge: {
    fontSize: 24,
    color: Colors.primary,
    fontWeight: 'bold',
  },
});
