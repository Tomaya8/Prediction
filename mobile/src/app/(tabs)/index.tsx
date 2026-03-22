import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../lib/colors';

import { TrendingMarkets } from '../../lib/components';
import { apiClient, type Market } from '../../lib/api-client';
import { getStoredUser } from '../../lib/auth';

const CATEGORIES = ['All', 'Politics', 'Sports', 'Crypto', 'Entertainment', 'Science', 'Technology', 'Business'];

export default function MarketsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [markets, setMarkets] = useState<Market[]>([]);
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch markets from API
  const fetchMarkets = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await apiClient.getMarkets();

      if (response.success && response.data) {
        setMarkets(response.data);
      } else {
        setError(response.error || 'Failed to load markets');
      }
    } catch (err) {
      console.error('Error fetching markets:', err);
      setError('Failed to load markets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchMarkets();
    apiClient.getProfile().then(res => {
      if (res.success && res.data) setUserBalance(res.data.creditBalance);
    });
  }, [fetchMarkets]);

  const onRefresh = useCallback(() => {
    fetchMarkets(true);
  }, [fetchMarkets]);

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

  // Derive trending markets from real API data — no fake IDs
  const trendingMarkets = markets.slice(0, 5).map(m => ({
    id: m.id,
    title: m.title,
    category: m.category,
    volume24h: m.totalVolume,
    change24h: 0,
    yesPrice: m.prices ? (Object.values(m.prices)[0] as number) : 0.5,
    noPrice: m.prices ? (Object.values(m.prices)[1] as number) : 0.5,
    participants: 0,
  }));

  const filteredMarkets = markets.filter(m => {
    const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory.toUpperCase();
    const matchesSearch = searchQuery === '' ||
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <View style={styles.container}>
      {/* Header with balance */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Markets</Text>
          <Text style={styles.headerSubtitle}>Predict the future, earn credits</Text>
        </View>
        <View style={styles.balanceBadge}>
          <Ionicons name="diamond-outline" size={16} color={Colors.warning} style={{ marginRight: 6 }} />
          <Text style={styles.balanceText}>{userBalance != null ? userBalance.toLocaleString() : '—'}</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} style={{ marginRight: 10 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search markets..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-outline" size={18} color={Colors.textSecondary} style={{ padding: Spacing.xs }} />
          </TouchableOpacity>
        )}
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

      {/* Trending Markets */}
      <TrendingMarkets markets={trendingMarkets} />

      {/* Markets List */}
      <ScrollView
        style={styles.marketsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
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
            </View>

            {/* Market Title */}
            <Text style={styles.marketTitle} numberOfLines={2}>{market.title}</Text>

            {/* Outcomes — top 4, each as a row */}
            <View style={styles.outcomesContainer}>
              {market.outcomes.slice(0, 4).map((outcome) => {
                const price = (market.prices?.[outcome.id] ?? outcome.currentPrice) || 0;
                const pct = Math.round(price * 100);
                return (
                  <View key={outcome.id} style={styles.outcomeItem}>
                    <View style={[styles.outcomeDot, { backgroundColor: outcome.color ?? Colors.textMuted }]} />
                    <Text style={styles.outcomeName} numberOfLines={1}>{outcome.name}</Text>
                    <View style={styles.outcomePriceWrap}>
                      <Text style={[styles.outcomePrice, { color: pct >= 50 ? Colors.primary : Colors.textSecondary }]}>
                        {pct}¢
                      </Text>
                    </View>
                  </View>
                );
              })}
              {market.outcomes.length > 4 && (
                <Text style={styles.moreOutcomes}>+{market.outcomes.length - 4} more</Text>
              )}
            </View>

            {/* Market Footer */}
            <View style={styles.marketFooter}>
              <Text style={styles.volumeText}>
                {formatVolume(market.totalVolume)} credits vol
              </Text>
              <Text style={styles.expiryText}>{getTimeRemaining(market.expiresAt)}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* Disclaimer */}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSize.title,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  balanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.xl,
  },
  balanceText: {
    color: Colors.primary,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  categoriesContainer: {
    maxHeight: 50,
    marginBottom: Spacing.sm,
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
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: Colors.textPrimary,
  },
  marketsList: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  marketCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  marketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  categoryBadge: {
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: 10,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  categoryBadgeText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  timeRemaining: {
    color: Colors.danger,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  marketTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  marketDescription: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  outcomesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: 10,
    marginBottom: Spacing.md,
    gap: 6,
  },
  outcomeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
  },
  outcomeDot: {
    width: Spacing.sm,
    height: Spacing.sm,
    borderRadius: Spacing.xs,
    marginRight: 6,
    flexShrink: 0,
  },
  outcomeName: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '500',
    marginRight: Spacing.xs,
    flexShrink: 1,
  },
  outcomePrice: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    flexShrink: 0,
  },
  outcomePriceWrap: {
    marginLeft: 'auto' as any,
  },
  moreOutcomes: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    paddingVertical: 2,
    paddingLeft: 14,
  },
  marketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expiryText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  volumeText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
  },
  disclaimer: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  disclaimerText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
});
