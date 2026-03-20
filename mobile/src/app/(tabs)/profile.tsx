import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../lib/colors';
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
              <Ionicons name="star" size={14} color="#F59E0B" />
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
            <Ionicons name="flame-outline" size={24} color="#F59E0B" />
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
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  displayName: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  email: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    gap: 4,
  },
  premiumText: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '600',
  },
  balanceCard: {
    backgroundColor: Colors.surface,
    margin: 16,
    borderRadius: 16,
    padding: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  balanceValue: {
    color: Colors.primary,
    fontSize: 28,
    fontWeight: '700',
  },
  dailyReward: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  dailyRewardContent: {
    flex: 1,
  },
  dailyRewardTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  dailyRewardText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  dailyRewardButton: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  statCard: {
    width: '50%',
    padding: 4,
  },
  statCardInner: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  positive: {
    color: Colors.primary,
  },
  negative: {
    color: Colors.danger,
  },
  streakRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
  },
  streakCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    margin: 4,
    gap: 4,
  },
  streakValue: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  streakLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  earningsCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  earningsLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  earningsValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  earningsTotal: {
    marginTop: 4,
    paddingTop: 8,
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
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    gap: 8,
  },
  signOutText: {
    color: Colors.danger,
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  disclaimerText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
});
