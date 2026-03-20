import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../lib/colors';

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
          <Text style={styles.balanceIcon}>🔶</Text>
          <Text style={styles.balanceText}>{userBalance != null ? userBalance.toLocaleString() : '—'}</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search markets..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearButton}>✕</Text>
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
                    <View style={[styles.outcomeDot, { backgroundColor: outcome.color ?? '#888' }]} />
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
    flexWrap: 'wrap',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    gap: 6,
  },
  outcomeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
  },
  outcomeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
    flexShrink: 0,
  },
  outcomeName: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginRight: 4,
    flexShrink: 1,
  },
  outcomePrice: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 0,
  },
  outcomePriceWrap: {
    marginLeft: 'auto' as any,
  },
  moreOutcomes: {
    fontSize: 11,
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
    fontSize: 11,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  clearButton: {
    fontSize: 16,
    color: Colors.textSecondary,
    padding: 4,
  },
});
