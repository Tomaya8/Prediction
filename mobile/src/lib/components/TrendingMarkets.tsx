import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../colors';
import { useRouter } from 'expo-router';

export interface TrendingMarket {
  id: string;
  title: string;
  category: string;
  volume24h: number;
  change24h: number;
  yesPrice: number;
  noPrice: number;
  participants: number;
}

interface TrendingMarketsProps {
  markets: TrendingMarket[];
  title?: string;
}

export const TrendingMarkets: React.FC<TrendingMarketsProps> = ({
  markets,
  title = '🔥 Trending Now',
}) => {
  const router = useRouter();

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(1)}M`;
    }
    if (volume >= 1000) {
      return `$${(volume / 1000).toFixed(1)}K`;
    }
    return `$${volume}`;
  };

  const handleMarketPress = (marketId: string) => {
    router.push(`/market/${marketId}`);
  };

  const getTrendIcon = (change: number) => {
    if (change > 5) return '🚀';
    if (change > 0) return '📈';
    if (change < -5) return '💥';
    return '📉';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity>
          <Text style={styles.seeAll}>See All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {markets.map((market) => (
          <TouchableOpacity
            key={market.id}
            style={styles.marketCard}
            onPress={() => handleMarketPress(market.id)}
            activeOpacity={0.7}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.category}>{market.category}</Text>
              <Text style={styles.trendIcon}>{getTrendIcon(market.change24h)}</Text>
            </View>

            <Text style={styles.marketTitle} numberOfLines={2}>
              {market.title}
            </Text>

            <View style={styles.priceContainer}>
              <View style={styles.priceItem}>
                <Text style={styles.priceLabel}>Yes</Text>
                <Text style={[styles.price, styles.yesPrice]}>
                  {(market.yesPrice * 100).toFixed(0)}¢
                </Text>
              </View>
              <View style={styles.priceItem}>
                <Text style={styles.priceLabel}>No</Text>
                <Text style={[styles.price, styles.noPrice]}>
                  {(market.noPrice * 100).toFixed(0)}¢
                </Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{formatVolume(market.volume24h)}</Text>
                <Text style={styles.statLabel}>24h Vol</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[
                  styles.statValue,
                  market.change24h >= 0 ? styles.positive : styles.negative,
                ]}>
                  {market.change24h >= 0 ? '+' : ''}{market.change24h}%
                </Text>
                <Text style={styles.statLabel}>24h</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{market.participants}</Text>
                <Text style={styles.statLabel}>Traders</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

// Mock data generator
export const generateMockTrendingMarkets = (): TrendingMarket[] => {
  const categories = ['Politics', 'Crypto', 'Sports', 'Tech', 'Science', 'Entertainment'];

  const mockMarkets: TrendingMarket[] = [
    {
      id: 'trending-1',
      title: 'Will Bitcoin reach $150K by end of 2025?',
      category: 'Crypto',
      volume24h: 2450000,
      change24h: 12.5,
      yesPrice: 0.65,
      noPrice: 0.35,
      participants: 3420,
    },
    {
      id: 'trending-2',
      title: 'Will Apple release AR glasses in 2025?',
      category: 'Tech',
      volume24h: 890000,
      change24h: 8.2,
      yesPrice: 0.42,
      noPrice: 0.58,
      participants: 1250,
    },
    {
      id: 'trending-3',
      title: 'Super Bowl 2026: Will Chiefs win?',
      category: 'Sports',
      volume24h: 1560000,
      change24h: -3.4,
      yesPrice: 0.55,
      noPrice: 0.45,
      participants: 2890,
    },
    {
      id: 'trending-4',
      title: 'Will AI pass Turing Test by June 2025?',
      category: 'Science',
      volume24h: 720000,
      change24h: 15.8,
      yesPrice: 0.72,
      noPrice: 0.28,
      participants: 980,
    },
    {
      id: 'trending-5',
      title: 'Will US enter recession in 2025?',
      category: 'Politics',
      volume24h: 1100000,
      change24h: -1.2,
      yesPrice: 0.38,
      noPrice: 0.62,
      participants: 2150,
    },
  ];

  return mockMarkets;
};

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  seeAll: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingRight: Spacing.lg,
  },
  marketCard: {
    width: 200,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md + 2,
    marginHorizontal: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  category: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trendIcon: {
    fontSize: FontSize.md,
  },
  marketTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 18,
    marginBottom: Spacing.md,
    minHeight: 36,
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  priceItem: {
    flex: 1,
  },
  priceLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  price: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
  },
  yesPrice: {
    color: Colors.yes,
  },
  noPrice: {
    color: Colors.no,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  positive: {
    color: Colors.yes,
  },
  negative: {
    color: Colors.no,
  },
});
