import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors } from '../../lib/colors';

// Mock portfolio data
const MOCK_PORTFOLIO = {
  totalValue: 165,
  totalCost: 100,
  profitLoss: 65,
  roi: 65,
  holdings: [
    {
      id: '1',
      marketTitle: 'Will Bitcoin exceed $100k?',
      outcome: 'Yes',
      quantity: 100,
      currentPrice: 0.65,
      cost: 50,
      value: 65,
      pnl: 15,
    },
    {
      id: '2',
      marketTitle: 'Will Trump win 2024?',
      outcome: 'Yes',
      quantity: 100,
      currentPrice: 0.52,
      cost: 50,
      value: 52,
      pnl: 2,
    },
  ],
  resolved: [
    {
      id: '3',
      marketTitle: 'Olympics 2024 Gold',
      outcome: 'USA Wins',
      quantity: 50,
      result: 'won',
      winnings: 40,
    },
  ],
};

export default function PortfolioScreen() {
  const [portfolio] = useState(MOCK_PORTFOLIO);

  return (
    <View style={styles.container}>
      {/* Header Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total Value</Text>
          <Text style={styles.statValue}>{portfolio.totalValue.toFixed(0)}</Text>
          <Text style={styles.statCurrency}>credits</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total Cost</Text>
          <Text style={styles.statValue}>{portfolio.totalCost.toFixed(0)}</Text>
          <Text style={styles.statCurrency}>credits</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>P&L</Text>
          <Text style={[
            styles.statValue,
            portfolio.profitLoss >= 0 ? styles.positive : styles.negative
          ]}>
            {portfolio.profitLoss >= 0 ? '+' : ''}{portfolio.profitLoss.toFixed(0)}
          </Text>
          <Text style={[
            styles.statCurrency,
            portfolio.roi >= 0 ? styles.positive : styles.negative
          ]}>
            ({portfolio.roi >= 0 ? '+' : ''}{portfolio.roi.toFixed(0)}%)
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Active Positions */}
        <Text style={styles.sectionTitle}>Active Positions</Text>
        {portfolio.holdings.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>No active positions</Text>
            <Text style={styles.emptySubtext}>Start trading to build your portfolio</Text>
          </View>
        ) : (
          portfolio.holdings.map((holding) => (
            <View key={holding.id} style={styles.holdingCard}>
              <View style={styles.holdingHeader}>
                <Text style={styles.holdingMarket}>{holding.marketTitle}</Text>
                <View style={styles.outcomeBadge}>
                  <View style={[styles.outcomeDot, { backgroundColor: Colors.yes }]} />
                  <Text style={styles.outcomeText}>{holding.outcome}</Text>
                </View>
              </View>
              <View style={styles.holdingDetails}>
                <View style={styles.holdingRow}>
                  <Text style={styles.holdingLabel}>Shares</Text>
                  <Text style={styles.holdingValue}>{holding.quantity}</Text>
                </View>
                <View style={styles.holdingRow}>
                  <Text style={styles.holdingLabel}>Current Price</Text>
                  <Text style={styles.holdingValue}>{(holding.currentPrice * 100).toFixed(0)}%</Text>
                </View>
                <View style={styles.holdingRow}>
                  <Text style={styles.holdingLabel}>Value</Text>
                  <Text style={styles.holdingValue}>{holding.value.toFixed(0)} credits</Text>
                </View>
                <View style={styles.holdingRow}>
                  <Text style={styles.holdingLabel}>Cost</Text>
                  <Text style={styles.holdingValue}>{holding.cost.toFixed(0)} credits</Text>
                </View>
                <View style={[styles.holdingRow, styles.pnlRow]}>
                  <Text style={styles.holdingLabel}>P&L</Text>
                  <Text style={[
                    styles.holdingValue,
                    holding.pnl >= 0 ? styles.positive : styles.negative
                  ]}>
                    {holding.pnl >= 0 ? '+' : ''}{holding.pnl.toFixed(0)} credits
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.sellButton}>
                <Text style={styles.sellButtonText}>Sell</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* Resolved Markets */}
        {portfolio.resolved.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Resolved Markets</Text>
            {portfolio.resolved.map((item) => (
              <View key={item.id} style={styles.resolvedCard}>
                <View style={styles.holdingHeader}>
                  <Text style={styles.holdingMarket}>{item.marketTitle}</Text>
                  <View style={[
                    styles.resultBadge,
                    item.result === 'won' ? styles.wonBadge : styles.lostBadge
                  ]}>
                    <Text style={styles.resultText}>
                      {item.result === 'won' ? '✅ Won' : '❌ Lost'}
                    </Text>
                  </View>
                </View>
                <View style={styles.resolvedDetails}>
                  <Text style={styles.resolvedText}>
                    {item.outcome} • {item.quantity} shares
                  </Text>
                  {item.result === 'won' && (
                    <Text style={styles.winningsText}>
                      +{item.winnings} credits
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
    alignItems: 'center',
    marginBottom: 12,
  },
  holdingMarket: {
    color: Colors.textPrimary,
    fontSize: 16,
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
  sellButton: {
    backgroundColor: Colors.danger,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  sellButtonText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
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
