import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../lib/colors';

// Mock data for demonstration
const MOCK_MARKETS = [
  {
    id: '1',
    title: 'Will Bitcoin exceed $100k by Dec 2024?',
    description: 'Bitcoin reaching $100,000 USD on any major exchange',
    category: 'CRYPTO',
    expiresAt: '2024-12-31',
    totalVolume: 25000,
    outcomes: [
      { id: 'yes', name: 'Yes', color: '#22C55E', currentPrice: 0.65 },
      { id: 'no', name: 'No', color: '#EF4444', currentPrice: 0.35 },
    ],
  },
  {
    id: '2',
    title: 'Will Trump win the 2024 Presidential Election?',
    description: 'Donald Trump wins the 2024 US Presidential Election',
    category: 'POLITICS',
    expiresAt: '2024-11-05',
    totalVolume: 52000,
    outcomes: [
      { id: 'yes', name: 'Yes', color: '#22C55E', currentPrice: 0.52 },
      { id: 'no', name: 'No', color: '#EF4444', currentPrice: 0.48 },
    ],
  },
  {
    id: '3',
    title: 'Will Taylor Swift announce retirement in 2024?',
    description: 'Taylor Swift announces retirement from music',
    category: 'ENTERTAINMENT',
    expiresAt: '2024-12-31',
    totalVolume: 8500,
    outcomes: [
      { id: 'yes', name: 'Yes', color: '#22C55E', currentPrice: 0.15 },
      { id: 'no', name: 'No', color: '#EF4444', currentPrice: 0.85 },
    ],
  },
  {
    id: '4',
    title: 'Will ETH hit $5k in 2024?',
    description: 'Ethereum reaches $5,000 USD',
    category: 'CRYPTO',
    expiresAt: '2024-12-31',
    totalVolume: 18000,
    outcomes: [
      { id: 'yes', name: 'Yes', color: '#22C55E', currentPrice: 0.42 },
      { id: 'no', name: 'No', color: '#EF4444', currentPrice: 0.58 },
    ],
  },
];

const CATEGORIES = ['All', 'Politics', 'Sports', 'Crypto', 'Entertainment', 'Science'];

export default function MarketsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [markets] = useState(MOCK_MARKETS);
  const [userBalance] = useState(1000); // Demo starting balance

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toString();
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `${days}d left`;
    return 'Expiring soon';
  };

  const filteredMarkets = selectedCategory === 'All' 
    ? markets 
    : markets.filter(m => m.category === selectedCategory.toUpperCase());

  return (
    <View style={styles.container}>
      {/* Header with balance */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Markets</Text>
          <Text style={styles.headerSubtitle}>Predict the future, earn credits</Text>
        </View>
        <View style={styles.balanceBadge}>
          <Text style={styles.balanceIcon}>🔶</Text>
          <Text style={styles.balanceText}>{userBalance.toLocaleString()}</Text>
        </View>
      </View>

      {/* Categories */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryButton,
              selectedCategory === category && styles.categoryButtonActive
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text style={[
              styles.categoryText,
              selectedCategory === category && styles.categoryTextActive
            ]}>
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Markets List */}
      <ScrollView
        style={styles.marketsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" />
        }
      >
        {filteredMarkets.map((market) => (
          <TouchableOpacity
            key={market.id}
            style={styles.marketCard}
            onPress={() => router.push(`/market/${market.id}`)}
          >
            {/* Market Header */}
            <View style={styles.marketHeader}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{market.category}</Text>
              </View>
              <Text style={styles.timeRemaining}>{getTimeRemaining(market.expiresAt)}</Text>
            </View>

            {/* Market Title */}
            <Text style={styles.marketTitle}>{market.title}</Text>
            <Text style={styles.marketDescription}>{market.description}</Text>

            {/* Outcomes */}
            <View style={styles.outcomesContainer}>
              {market.outcomes.map((outcome) => (
                <View key={outcome.id} style={styles.outcomeItem}>
                  <View style={[styles.outcomeDot, { backgroundColor: outcome.color }]} />
                  <Text style={styles.outcomeName}>{outcome.name}</Text>
                  <Text style={[styles.outcomePrice, { color: outcome.color }]}>
                    {(outcome.currentPrice * 100).toFixed(0)}%
                  </Text>
                </View>
              ))}
            </View>

            {/* Market Footer */}
            <View style={styles.marketFooter}>
              <Text style={styles.volumeText}>
                📊 {formatVolume(market.totalVolume)} credits
              </Text>
            </View>
          </TouchableOpacity>
        ))}

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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  balanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  balanceIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  balanceText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  categoriesContainer: {
    maxHeight: 50,
    marginBottom: 8,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: Colors.primary,
  },
  categoryText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: Colors.textPrimary,
  },
  marketsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  marketCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  marketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryBadgeText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  timeRemaining: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '600',
  },
  marketTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  marketDescription: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  outcomesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  outcomeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  outcomeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  outcomeName: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
  outcomePrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  marketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  volumeText: {
    color: Colors.textSecondary,
    fontSize: 12,
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
