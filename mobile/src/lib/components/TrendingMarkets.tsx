import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  title = 'Trending Now',
}) => {
  const router = useRouter();

  if (markets.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="trending-up" size={18} color={Colors.primary} />
          <Text style={styles.title}>{title}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {markets.map((market) => (
          <TouchableOpacity
            key={market.id}
            style={styles.card}
            onPress={() => router.push(`/market/${market.id}`)}
            activeOpacity={0.7}
          >
            <Text style={styles.category}>{market.category}</Text>
            <Text style={styles.marketTitle} numberOfLines={2}>{market.title}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.yesPrice}>{(market.yesPrice * 100).toFixed(0)}¢ Yes</Text>
              <Text style={styles.noPrice}>{(market.noPrice * 100).toFixed(0)}¢ No</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  card: {
    width: 160,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  category: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  marketTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 17,
    marginBottom: Spacing.sm,
    minHeight: 34,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  yesPrice: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.yes,
  },
  noPrice: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.no,
  },
});
