import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Colors } from '../../lib/colors';

// Mock user data
const MOCK_USER = {
  id: '1',
  displayName: 'Player123',
  email: 'player@example.com',
  avatarUrl: null,
  creditBalance: 1000,
  totalTrades: 15,
  winningTrades: 11,
  winRate: 73,
  currentStreak: 5,
  longestStreak: 12,
  achievements: [
    { id: '1', name: 'First Steps', icon: '🎯', earned: true },
    { id: '2', name: '10 Trades', icon: '📊', earned: true },
    { id: '3', name: 'Win Streak 5', icon: '🔥', earned: true },
    { id: '4', name: 'Win Streak 10', icon: '⚡', earned: false },
    { id: '5', name: 'Big Winner', icon: '💰', earned: false },
  ],
};

const CREDIT_PACKS = [
  { id: 'starter', name: 'Starter Pack', credits: 1000, price: '$0.99' },
  { id: 'pro', name: 'Pro Pack', credits: 5000, price: '$4.99' },
  { id: 'vip', name: 'VIP Pack', credits: 25000, price: '$19.99' },
  { id: 'whale', name: 'Whale Pack', credits: 100000, price: '$49.99' },
];

export default function ProfileScreen() {
  const [user] = useState(MOCK_USER);

  const handleBuyCredits = (pack: typeof CREDIT_PACKS[0]) => {
    Alert.alert(
      'Purchase Credits',
      `Buy ${pack.name} for ${pack.price}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Buy', onPress: () => Alert.alert('Success', `Added ${pack.credits} credits!`) },
      ]
    );
  };

  const handleClaimDailyReward = () => {
    Alert.alert('Daily Reward', '🎁 +100 credits claimed!', [{ text: 'Awesome!' }]);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
          <Text style={styles.displayName}>{user.displayName}</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.balanceLabel}>Credit Balance</Text>
              <View style={styles.balanceValue}>
                <Text style={styles.balanceIcon}>🔶</Text>
                <Text style={styles.balanceText}>{user.creditBalance.toLocaleString()}</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.buyButton}
              onPress={() => Alert.alert('Buy Credits', 'Select a pack below')}
            >
              <Text style={styles.buyButtonText}>+ Buy</Text>
            </TouchableOpacity>
          </View>
          
          {/* Daily Reward */}
          <TouchableOpacity style={styles.dailyReward} onPress={handleClaimDailyReward}>
            <Text style={styles.dailyRewardIcon}>🎁</Text>
            <View style={styles.dailyRewardContent}>
              <Text style={styles.dailyRewardTitle}>Daily Reward</Text>
              <Text style={styles.dailyRewardText}>🔥 {user.currentStreak} day streak</Text>
            </View>
            <Text style={styles.dailyRewardButton}>Claim</Text>
          </TouchableOpacity>
        </View>

        {/* Statistics */}
        <Text style={styles.sectionTitle}>Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{user.totalTrades}</Text>
            <Text style={styles.statLabel}>Total Trades</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, styles.positive]}>{user.winRate}%</Text>
            <Text style={styles.statLabel}>Win Rate</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>🔥 {user.currentStreak}</Text>
            <Text style={styles.statLabel}>Current Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>⚡ {user.longestStreak}</Text>
            <Text style={styles.statLabel}>Best Streak</Text>
          </View>
        </View>

        {/* Credit Packs */}
        <Text style={styles.sectionTitle}>Buy Credits</Text>
        <View style={styles.packsGrid}>
          {CREDIT_PACKS.map((pack) => (
            <TouchableOpacity
              key={pack.id}
              style={styles.packCard}
              onPress={() => handleBuyCredits(pack)}
            >
              <Text style={styles.packName}>{pack.name}</Text>
              <Text style={styles.packCredits}>+{pack.credits.toLocaleString()} 🔶</Text>
              <Text style={styles.packPrice}>{pack.price}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Achievements */}
        <Text style={styles.sectionTitle}>Achievements</Text>
        <View style={styles.achievementsGrid}>
          {user.achievements.map((achievement) => (
            <View 
              key={achievement.id} 
              style={[
                styles.achievementCard,
                !achievement.earned && styles.achievementLocked
              ]}
            >
              <Text style={styles.achievementIcon}>{achievement.icon}</Text>
              <Text style={[
                styles.achievementName,
                !achievement.earned && styles.achievementNameLocked
              ]}>
                {achievement.name}
              </Text>
            </View>
          ))}
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            ⚠️ Credits have no real-world value. This is not gambling.
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
  header: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 40,
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  balanceText: {
    color: Colors.primary,
    fontSize: 28,
    fontWeight: '700',
  },
  buyButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  buyButtonText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  dailyReward: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
  },
  dailyRewardIcon: {
    fontSize: 24,
    marginRight: 12,
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
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    color: Colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  positive: {
    color: Colors.primary,
  },
  packsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  packCard: {
    width: '50%',
    padding: 4,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  packName: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  packCredits: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  packPrice: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  achievementCard: {
    width: '25%',
    padding: 4,
    alignItems: 'center',
  },
  achievementLocked: {
    opacity: 0.4,
  },
  achievementCardInner: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    width: '100%',
  },
  achievementIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  achievementName: {
    color: Colors.textSecondary,
    fontSize: 10,
    textAlign: 'center',
  },
  achievementNameLocked: {
    color: Colors.textMuted,
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
