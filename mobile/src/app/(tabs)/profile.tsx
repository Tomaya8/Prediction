import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize } from '../../lib/colors';
import { apiClient } from '../../lib/api-client';
import { signOut } from '../../lib/auth';

interface ProfileData {
  id: string;
  email: string;
  displayName?: string;
  creditBalance: number;
  totalCreditsEarned: number;
  totalCreditsSpent: number;
  totalTrades: number;
  winningTrades: number;
  totalWinnings: number;
  winRate: number;
  roi: number;
  currentStreak: number;
  longestStreak: number;
  isPremium: boolean;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await apiClient.getProfile();
      if (res.success && res.data) {
        setProfile(res.data as unknown as ProfileData);
        setError(null);
      } else {
        setError(res.error ?? 'Failed to load profile');
      }
    } catch {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  const handleClaimDailyReward = async () => {
    const res = await apiClient.claimDailyReward();
    if (res.success && res.data) {
      Alert.alert('Daily Reward', `+${res.data.reward} credits! Streak: ${res.data.streak} days`);
      fetchProfile();
    } else {
      Alert.alert('Daily Reward', res.error ?? 'Already claimed today');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    apiClient.setAuthToken(null);
    router.replace('/auth');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Not signed in'}</Text>
        <TouchableOpacity onPress={() => { setLoading(true); fetchProfile(); }} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const initials = profile.displayName
    ? profile.displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : profile.email.charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.displayName}>{profile.displayName || 'Anonymous'}</Text>
          <Text style={styles.email}>{profile.email}</Text>
          {profile.isPremium && (
            <View style={styles.premiumBadge}>
              <Ionicons name="star" size={14} color={Colors.warning} />
              <Text style={styles.premiumText}>Premium</Text>
            </View>
          )}
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.balanceLabel}>Credit Balance</Text>
              <Text style={styles.balanceValue}>{profile.creditBalance.toLocaleString()}</Text>
            </View>
          </View>

          {/* Daily Reward */}
          <TouchableOpacity style={styles.dailyReward} onPress={handleClaimDailyReward}>
            <Ionicons name="gift-outline" size={22} color={Colors.primary} />
            <View style={styles.dailyRewardContent}>
              <Text style={styles.dailyRewardTitle}>Daily Reward</Text>
              <Text style={styles.dailyRewardText}>{profile.currentStreak} day streak</Text>
            </View>
            <Text style={styles.dailyRewardButton}>Claim</Text>
          </TouchableOpacity>
        </View>

        {/* Statistics */}
        <Text style={styles.sectionTitle}>Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statCardInner}>
              <Text style={styles.statValue}>{profile.totalTrades}</Text>
              <Text style={styles.statLabel}>Total Trades</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statCardInner}>
              <Text style={[styles.statValue, profile.winRate >= 50 ? styles.positive : styles.negative]}>
                {profile.winRate.toFixed(1)}%
              </Text>
              <Text style={styles.statLabel}>Win Rate</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statCardInner}>
              <Text style={[styles.statValue, profile.roi >= 0 ? styles.positive : styles.negative]}>
                {profile.roi.toFixed(1)}%
              </Text>
              <Text style={styles.statLabel}>ROI</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statCardInner}>
              <Text style={styles.statValue}>{profile.totalWinnings.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Total Winnings</Text>
            </View>
          </View>
        </View>

        {/* Streaks */}
        <Text style={styles.sectionTitle}>Streaks</Text>
        <View style={styles.streakRow}>
          <View style={styles.streakCard}>
            <Ionicons name="flame-outline" size={24} color={Colors.warning} />
            <Text style={styles.streakValue}>{profile.currentStreak}</Text>
            <Text style={styles.streakLabel}>Current</Text>
          </View>
          <View style={styles.streakCard}>
            <Ionicons name="flash-outline" size={24} color={Colors.accent} />
            <Text style={styles.streakValue}>{profile.longestStreak}</Text>
            <Text style={styles.streakLabel}>Best</Text>
          </View>
        </View>

        {/* Earnings Summary */}
        <Text style={styles.sectionTitle}>Earnings</Text>
        <View style={styles.earningsCard}>
          <View style={styles.earningsRow}>
            <Text style={styles.earningsLabel}>Credits Earned</Text>
            <Text style={[styles.earningsValue, styles.positive]}>+{profile.totalCreditsEarned.toLocaleString()}</Text>
          </View>
          <View style={styles.earningsRow}>
            <Text style={styles.earningsLabel}>Credits Spent</Text>
            <Text style={[styles.earningsValue, styles.negative]}>-{profile.totalCreditsSpent.toLocaleString()}</Text>
          </View>
          <View style={[styles.earningsRow, styles.earningsTotal]}>
            <Text style={styles.earningsTotalLabel}>Net</Text>
            <Text style={[
              styles.earningsTotalValue,
              profile.totalCreditsEarned - profile.totalCreditsSpent >= 0 ? styles.positive : styles.negative,
            ]}>
              {(profile.totalCreditsEarned - profile.totalCreditsSpent >= 0 ? '+' : '')}
              {(profile.totalCreditsEarned - profile.totalCreditsSpent).toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Get More Credits */}
        <Text style={styles.sectionTitle}>Get More Credits</Text>
        <View style={styles.creditPacksRow}>
          {[
            { code: 'starter', name: 'Starter', credits: 500, icon: 'flash-outline' },
            { code: 'pro', name: 'Pro', credits: '2K', icon: 'rocket-outline' },
            { code: 'whale', name: 'Whale', credits: '10K', icon: 'diamond-outline' },
          ].map(pack => (
            <TouchableOpacity
              key={pack.code}
              style={styles.creditPackCard}
              onPress={async () => {
                Alert.alert('Get Credits', `Add ${pack.credits} credits to your balance?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Get', onPress: async () => {
                    const res = await apiClient.buyCredits(pack.code);
                    if (res.success) {
                      setProfile(prev => prev ? { ...prev, creditBalance: res.data.newBalance } : prev);
                      Alert.alert('Credits Added!', `+${res.data.creditsAdded} credits. New balance: ${res.data.newBalance}`);
                    }
                  }},
                ]);
              }}
            >
              <Ionicons name={pack.icon as any} size={24} color={Colors.primary} />
              <Text style={styles.creditPackCredits}>+{pack.credits}</Text>
              <Text style={styles.creditPackName}>{pack.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

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
  content: {
    flex: 1,
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
  header: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: {
    fontSize: FontSize.title,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  displayName: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  email: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    marginTop: Spacing.xs,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warningMuted,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  premiumText: {
    color: Colors.warning,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  balanceCard: {
    backgroundColor: Colors.surface,
    margin: Spacing.lg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  balanceLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  balanceValue: {
    color: Colors.primary,
    fontSize: FontSize.title,
    fontWeight: '700',
  },
  dailyReward: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  dailyRewardContent: {
    flex: 1,
  },
  dailyRewardTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  dailyRewardText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
  },
  dailyRewardButton: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '700',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
  },
  statCard: {
    width: '50%',
    padding: Spacing.xs,
  },
  statCardInner: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: Spacing.xl,
    fontWeight: '700',
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  positive: {
    color: Colors.primary,
  },
  negative: {
    color: Colors.danger,
  },
  streakRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  streakCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    margin: Spacing.xs,
    gap: Spacing.xs,
  },
  streakValue: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  streakLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
  },
  earningsCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  earningsLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  earningsValue: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  earningsTotal: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  earningsTotalLabel: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  earningsTotalValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  creditPacksRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.lg },
  creditPackCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.lg, alignItems: 'center', gap: Spacing.xs, borderWidth: 1, borderColor: Colors.border },
  creditPackCredits: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.primary },
  creditPackName: { fontSize: FontSize.xs, color: Colors.textSecondary },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xxl,
    marginBottom: Spacing.lg,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  signOutText: {
    color: Colors.danger,
    fontSize: FontSize.lg,
    fontWeight: '600',
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
