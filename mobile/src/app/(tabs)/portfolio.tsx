import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Colors } from '../../lib/colors';
import { apiClient } from '../../lib/api-client';
import { getStoredUser } from '../../lib/auth';

interface Holding {
  id: string;
  marketId: string;
  marketTitle: string;
  marketStatus: string;
  outcomeId: string;
  outcomeName: string;
  outcomeColor?: string;
  isWinner: boolean;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  currentValue: number;
  costBasis: number;
  profitLoss: number;
}

function fmtPnl(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0 || Object.is(rounded, -0)) return '0 credits';
  return (rounded > 0 ? '+' : '') + rounded + ' credits';
}

export default function PortfolioScreen() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    const user = await getStoredUser();
    if (!user) {
      setError('Not signed in');
      setLoading(false);
      return;
    }
    const res = await apiClient.getPortfolio(user.id);
    if (res.success && res.data) {
      setHoldings(res.data as unknown as Holding[]);
      setError(null);
    } else {
      setError(res.error ?? 'Failed to load portfolio');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPortfolio();
    setRefreshing(false);
  };

  const activeHoldings = holdings.filter(h => h.marketStatus === 'ACTIVE');
  const resolvedHoldings = holdings.filter(h => h.marketStatus === 'RESOLVED');

  const totalValue = activeHoldings.reduce((s, h) => s + h.currentValue, 0);
  const totalCost = activeHoldings.reduce((s, h) => s + h.costBasis, 0);
  const profitLoss = totalValue - totalCost;
  const roi = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;

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
        <TouchableOpacity onPress={() => { setLoading(true); fetchPortfolio(); }} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total Value</Text>
          <Text style={styles.statValue}>{totalValue.toFixed(0)}</Text>
          <Text style={styles.statCurrency}>credits</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total Cost</Text>
          <Text style={styles.statValue}>{totalCost.toFixed(0)}</Text>
          <Text style={styles.statCurrency}>credits</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>P&L</Text>
          <Text style={[styles.statValue, Math.round(profitLoss) > 0 ? styles.positive : Math.round(profitLoss) < 0 ? styles.negative : {}]}>
            {Math.round(profitLoss) === 0 || Object.is(Math.round(profitLoss), -0) ? '0' : (profitLoss > 0 ? '+' : '') + Math.round(profitLoss)}
          </Text>
          <Text style={[styles.statCurrency, Math.round(roi) > 0 ? styles.positive : Math.round(roi) < 0 ? styles.negative : {}]}>
            ({Math.round(roi) > 0 ? '+' : ''}{Math.round(roi) === 0 || Object.is(Math.round(roi), -0) ? '0' : Math.round(roi)}%)
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Active Positions */}
        <Text style={styles.sectionTitle}>Active Positions</Text>
        {activeHoldings.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>No active positions</Text>
            <Text style={styles.emptySubtext}>Start trading to build your portfolio</Text>
          </View>
        ) : (
          activeHoldings.map(holding => (
            <View key={holding.id} style={styles.holdingCard}>
              <View style={styles.holdingHeader}>
                <Text style={styles.holdingMarket} numberOfLines={2}>{holding.marketTitle}</Text>
                <View style={styles.outcomeBadge}>
                  <View style={[styles.outcomeDot, { backgroundColor: holding.outcomeColor ?? Colors.yes }]} />
                  <Text style={styles.outcomeText}>{holding.outcomeName}</Text>
                </View>
              </View>
              <View style={styles.holdingDetails}>
                <View style={styles.holdingRow}>
                  <Text style={styles.holdingLabel}>Shares</Text>
                  <Text style={styles.holdingValue}>{holding.quantity.toFixed(2)}</Text>
                </View>
                <View style={styles.holdingRow}>
                  <Text style={styles.holdingLabel}>Current Price</Text>
                  <Text style={styles.holdingValue}>{(holding.currentPrice * 100).toFixed(0)}%</Text>
                </View>
                <View style={styles.holdingRow}>
                  <Text style={styles.holdingLabel}>Value</Text>
                  <Text style={styles.holdingValue}>{holding.currentValue.toFixed(0)} credits</Text>
                </View>
                <View style={styles.holdingRow}>
                  <Text style={styles.holdingLabel}>Cost</Text>
                  <Text style={styles.holdingValue}>{holding.costBasis.toFixed(0)} credits</Text>
                </View>
                <View style={[styles.holdingRow, styles.pnlRow]}>
                  <Text style={styles.holdingLabel}>P&L</Text>
                  <Text style={[styles.holdingValue, holding.profitLoss >= 0.5 ? styles.positive : holding.profitLoss <= -0.5 ? styles.negative : styles.holdingValue]}>
                    {fmtPnl(holding.profitLoss)}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}

        {/* Resolved Markets */}
        {resolvedHoldings.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Resolved Markets</Text>
            {resolvedHoldings.map(item => (
              <View key={item.id} style={styles.resolvedCard}>
                <View style={styles.holdingHeader}>
                  <Text style={styles.holdingMarket} numberOfLines={2}>{item.marketTitle}</Text>
                  <View style={[styles.resultBadge, item.isWinner ? styles.wonBadge : styles.lostBadge]}>
                    <Text style={styles.resultText}>
                      {item.isWinner ? '✅ Won' : '❌ Lost'}
                    </Text>
                  </View>
                </View>
                <View style={styles.resolvedDetails}>
                  <Text style={styles.resolvedText}>
                    {item.outcomeName} • {item.quantity.toFixed(2)} shares
                  </Text>
                  {item.isWinner && (
                    <Text style={styles.winningsText}>
                      +{Math.floor(item.quantity)} credits
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </>
        )}

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
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    margin: 16,
    borderRadius: 16,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  statCurrency: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  positive: {
    color: Colors.primary,
  },
  negative: {
    color: Colors.danger,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: Colors.surface,
    borderRadius: 16,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  holdingCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  holdingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  holdingMarket: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  outcomeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  outcomeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  outcomeText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '500',
  },
  holdingDetails: {
    marginBottom: 12,
  },
  holdingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  pnlRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  holdingLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  holdingValue: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  resolvedCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  resultBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  wonBadge: {
    backgroundColor: Colors.primary + '20',
  },
  lostBadge: {
    backgroundColor: Colors.danger + '20',
  },
  resultText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resolvedDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resolvedText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  winningsText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
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
