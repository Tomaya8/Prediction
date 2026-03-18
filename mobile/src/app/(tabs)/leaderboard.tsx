import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors } from '../../lib/colors';

// Mock leaderboard data
const MOCK_LEADERBOARD = {
  topThree: [
    { rank: 1, name: 'CryptoKing', credits: 52000, avatar: '👑' },
    { rank: 2, name: 'PoliticalPundit', credits: 48500, avatar: '🎯' },
    { rank: 3, name: 'SportsBettor', credits: 45200, avatar: '⚽' },
  ],
  rest: [
    { rank: 4, name: 'Entertainer', credits: 42000, avatar: '🎬' },
    { rank: 5, name: 'ScienceGuy', credits: 38500, avatar: '🔬' },
    { rank: 6, name: 'MarketMaker', credits: 35200, avatar: '📈' },
    { rank: 7, name: 'PredictionPro', credits: 31000, avatar: '🎯' },
    { rank: 8, name: 'TrendFollower', credits: 28500, avatar: '📊' },
  ],
  user: {
    rank: 47,
    name: 'You',
    credits: 1000,
    avatar: '👤',
  },
};

export default function LeaderboardScreen() {
  const [period, setPeriod] = useState('ALL_TIME');
  const [scoreType, setScoreType] = useState('CREDITS');
  const [leaderboard] = useState(MOCK_LEADERBOARD);

  const periods = ['Daily', 'Weekly', 'All Time'];
  const scoreTypes = ['Credits', 'ROI'];

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  return (
    <View style={styles.container}>
      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <View style={styles.periodTabs}>
          {periods.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.tab, period === p && styles.tabActive]}
              onPress={() => setPeriod(p.toUpperCase().replace(' ', '_'))}
            >
              <Text style={[styles.tabText, period === p && styles.tabTextActive]}>
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Top 3 Podium */}
        <View style={styles.podium}>
          {/* 2nd Place */}
          <View style={[styles.podiumItem, styles.podiumSecond]}>
            <Text style={styles.podiumAvatar}>{leaderboard.topThree[1].avatar}</Text>
            <Text style={styles.podiumName}>{leaderboard.topThree[1].name}</Text>
            <Text style={styles.podiumRank}>🥈</Text>
            <Text style={styles.podiumCredits}>{leaderboard.topThree[1].credits.toLocaleString()}</Text>
          </View>

          {/* 1st Place */}
          <View style={[styles.podiumItem, styles.podiumFirst]}>
            <Text style={styles.podiumAvatar}>{leaderboard.topThree[0].avatar}</Text>
            <Text style={styles.podiumName}>{leaderboard.topThree[0].name}</Text>
            <Text style={styles.podiumRank}>🥇</Text>
            <Text style={styles.podiumCredits}>{leaderboard.topThree[0].credits.toLocaleString()}</Text>
          </View>

          {/* 3rd Place */}
          <View style={[styles.podiumItem, styles.podiumThird]}>
            <Text style={styles.podiumAvatar}>{leaderboard.topThree[2].avatar}</Text>
            <Text style={styles.podiumName}>{leaderboard.topThree[2].name}</Text>
            <Text style={styles.podiumRank}>🥉</Text>
            <Text style={styles.podiumCredits}>{leaderboard.topThree[2].credits.toLocaleString()}</Text>
          </View>
        </View>

        {/* Rest of Leaderboard */}
        <View style={styles.listContainer}>
          {leaderboard.rest.map((user) => (
            <View key={user.rank} style={styles.listItem}>
              <Text style={styles.listRank}>{user.rank}</Text>
              <Text style={styles.listAvatar}>{user.avatar}</Text>
              <Text style={styles.listName}>{user.name}</Text>
              <Text style={styles.listCredits}>{user.credits.toLocaleString()}</Text>
            </View>
          ))}
        </View>

        {/* User's Rank */}
        <View style={styles.userSection}>
          <Text style={styles.userSectionTitle}>Your Rank</Text>
          <View style={styles.userCard}>
            <Text style={styles.listRank}>{leaderboard.user.rank}</Text>
            <Text style={styles.listAvatar}>{leaderboard.user.avatar}</Text>
            <Text style={styles.listName}>{leaderboard.user.name}</Text>
            <Text style={styles.listCredits}>{leaderboard.user.credits.toLocaleString()}</Text>
          </View>
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
  tabContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
  },
  podium: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  podiumItem: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
  },
  podiumFirst: {
    paddingBottom: 24,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  podiumSecond: {
    paddingBottom: 16,
  },
  podiumThird: {
    paddingBottom: 12,
  },
  podiumAvatar: {
    fontSize: 32,
    marginBottom: 8,
  },
  podiumName: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  podiumRank: {
    fontSize: 20,
    marginBottom: 4,
  },
  podiumCredits: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  listRank: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
    width: 30,
  },
  listAvatar: {
    fontSize: 24,
    marginRight: 12,
  },
  listName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  listCredits: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  userSection: {
    padding: 16,
  },
  userSectionTitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '20',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
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
