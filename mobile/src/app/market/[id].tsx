import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize } from '../../lib/colors';
import { Comments, showToast, showConfirm } from '../../lib/components';
import { apiClient, type Market, type TradeResult } from '../../lib/api-client';
import websocketService from '../../lib/websocket';

// Default market data for fallback
const DEFAULT_MARKET: Market = {
  id: '1',
  title: 'Will Bitcoin exceed $100k by Dec 2024?',
  description: 'Bitcoin reaching $100,000 USD on any major exchange before December 31, 2024.',
  category: 'CRYPTO',
  expiresAt: '2024-12-31',
  totalVolume: 25000,
  outcomes: [
    { id: 'yes', name: 'Yes', color: Colors.yes, currentPrice: 0.65 },
    { id: 'no', name: 'No', color: Colors.no, currentPrice: 0.35 },
  ],
};

export default function MarketDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [market, setMarket] = useState<Market>(DEFAULT_MARKET);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [credits, setCredits] = useState('50');
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [previewShares, setPreviewShares] = useState<number | null>(null);
  const [previewActualCost, setPreviewActualCost] = useState<number | null>(null);
  const [sellPreviewRevenue, setSellPreviewRevenue] = useState<number | null>(null);
  const [executingTrade, setExecutingTrade] = useState(false);
  const [userHoldings, setUserHoldings] = useState<Record<string, number>>({});

  // Comments
  const [comments, setComments] = useState<any[]>([]);

  // Fetch market data from API
  const fetchMarketData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const marketId = Array.isArray(id) ? id[0] : id || '1';
      const response = await apiClient.getMarket(marketId);

      if (response.success && response.data) {
        const fetchedMarket = response.data;

        // Merge LMSR prices map into each outcome's currentPrice
        if (fetchedMarket.prices) {
          const pricesMap = fetchedMarket.prices!;
          fetchedMarket.outcomes = fetchedMarket.outcomes.map((o: any) => ({
            ...o,
            currentPrice: pricesMap[o.id] ?? o.currentPrice ?? 0,
          }));
        }

        setMarket(fetchedMarket);
      } else {
        setError(response.error || 'Failed to load market');
      }
    } catch (err) {
      setError('Failed to load market. Please try again.');
      console.error('Error fetching market:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  // Fetch user profile for real balance + holdings
  useEffect(() => {
    apiClient.getProfile().then(async (res) => {
      if (res.success && res.data) {
        setUserBalance(res.data.creditBalance);
        const portfolioRes = await apiClient.getPortfolio(res.data.id);
        if (portfolioRes.success && portfolioRes.data) {
          const mId = Array.isArray(id) ? id[0] : id || '';
          const h: Record<string, number> = {};
          for (const item of portfolioRes.data as any[]) {
            if (item.marketId === mId) h[item.outcomeId] = item.quantity || 0;
          }
          setUserHoldings(h);
        }
      }
    });
  }, [id]);

  // Live preview: given credits to spend → calculate shares + actual cost
  useEffect(() => {
    const amt = parseInt(credits) || 0;
    if (!selectedOutcome || amt <= 0) {
      setPreviewShares(null);
      setPreviewActualCost(null);
      setSellPreviewRevenue(null);
      return;
    }
    const mId = Array.isArray(id) ? id[0] : id || '1';

    if (tradeType === 'BUY') {
      setSellPreviewRevenue(null);
      apiClient.previewByCost({ marketId: mId, outcomeId: selectedOutcome, credits: amt })
        .then(res => {
          if (res.success && res.data) {
            setPreviewShares(res.data.shares);
            setPreviewActualCost(res.data.actualCost);
          }
        });
    } else {
      setPreviewShares(null);
      setPreviewActualCost(null);
      apiClient.previewSell({ marketId: mId, outcomeId: selectedOutcome, amount: amt })
        .then(res => {
          if (res.success && res.data) {
            setSellPreviewRevenue(res.data.revenue);
          }
        });
    }
  }, [selectedOutcome, credits, id, tradeType]);

  // Initial data fetch
  useEffect(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  // Subscribe to real-time price updates via WebSocket
  useEffect(() => {
    const marketId = Array.isArray(id) ? id[0] : id;
    if (!marketId) return;

    // Subscribe to price updates for this market
    const handlePriceUpdate = (data: { marketId: string; prices: Record<string, number> }) => {
      if (data.marketId === marketId) {
        setMarket(prev => ({
          ...prev,
          prices: data.prices,
          outcomes: prev.outcomes.map(o => ({
            ...o,
            currentPrice: data.prices[o.id] || o.currentPrice,
          })),
        }));
      }
    };

    const unsubscribe = websocketService.on('PRICE_UPDATE', handlePriceUpdate);
    websocketService.connect();

    return () => {
      unsubscribe();
    };
  }, [id]);

  const marketId = Array.isArray(id) ? id[0] : id || '1';

  const fetchComments = useCallback(async () => {
    const res = await apiClient.getComments(marketId);
    if (res.success && res.data) {
      // Map API format to Comment component format
      setComments(res.data.map((c: any) => ({
        id: c.id,
        userId: c.userId || c.user?.id || '',
        userName: c.user?.displayName || c.userName || 'Anonymous',
        content: c.content || '',
        createdAt: c.createdAt?._seconds ? new Date(c.createdAt._seconds * 1000).toISOString() : c.createdAt || new Date().toISOString(),
        likes: c.likes || 0,
      })));
    }
  }, [marketId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const handleAddComment = async (content: string) => {
    const res = await apiClient.postComment(marketId, content);
    if (res.success) fetchComments();
    else Alert.alert('Error', res.error || 'Failed to post comment');
  };

  const handleLikeComment = async (commentId: string) => {
    await apiClient.likeComment(marketId, commentId);
    fetchComments();
  };

  // Execute trade via API
  const handleTrade = async () => {
    if (!selectedOutcome) {
      Alert.alert('Error', 'Please select an outcome');
      return;
    }

    const selectedOutcomeData = market.outcomes.find(o => o.id === selectedOutcome);
    const mktId = Array.isArray(id) ? id[0] : id || '1';
    const isBuy = tradeType === 'BUY';

    if (isBuy) {
      if (!previewShares || previewShares <= 0) {
        Alert.alert('Error', 'Enter an amount to spend');
        return;
      }
      const cost = previewActualCost ?? 0;
      if (userBalance !== null && cost > userBalance) {
        Alert.alert('Error', 'Insufficient balance');
        return;
      }

      showConfirm({
        title: 'Confirm Trade',
        message: `Buy ${previewShares} shares of "${selectedOutcomeData?.name}" for ${cost} credits?\nMax payout: ${previewShares} credits`,
        confirmText: 'Buy',
        onConfirm: async () => {
          setExecutingTrade(true);
          try {
            // Pass maxCost for slippage protection (allow 5% above preview)
            const maxCost = Math.ceil((previewActualCost || 0) * 1.05);
            const response = await apiClient.executeTrade({ marketId: mktId, outcomeId: selectedOutcome, amount: previewShares, maxCost });
            if (response.success && response.data) {
              const result: TradeResult = response.data;
              setUserBalance(result.newBalance);
              setUserHoldings(prev => ({ ...prev, [selectedOutcome]: (prev[selectedOutcome] || 0) + previewShares }));
              setPreviewShares(null);
              setPreviewActualCost(null);
              showToast({ message: `Bought ${previewShares} shares of ${selectedOutcomeData?.name}`, type: 'success' });
              fetchMarketData();
              // Check for new achievements after trade
              apiClient.checkAchievements().then(r => {
                if (r.success && r.data?.newlyEarned?.length > 0) {
                  setTimeout(() => showToast({ message: `Achievement unlocked: ${r.data.newlyEarned.join(', ')}`, type: 'success' }), 2000);
                }
              });
            } else {
              showToast({ message: response.error || 'Trade failed', type: 'error' });
            }
          } catch (err) {
            showToast({ message: 'Failed to execute trade.', type: 'error' });
          } finally {
            setExecutingTrade(false);
          }
        },
      });
    } else {
      // SELL flow
      const ownedShares = userHoldings[selectedOutcome] || 0;
      const sellAmount = parseInt(credits) || 0;
      if (sellAmount <= 0) {
        Alert.alert('Error', 'Enter number of shares to sell');
        return;
      }
      if (sellAmount > ownedShares) {
        Alert.alert('Error', `You only own ${ownedShares} shares of ${selectedOutcomeData?.name}`);
        return;
      }

      showConfirm({
        title: 'Confirm Sell',
        message: `Sell ${sellAmount} shares of "${selectedOutcomeData?.name}"?`,
        confirmText: 'Sell',
        destructive: true,
        onConfirm: async () => {
          setExecutingTrade(true);
          try {
            const response = await apiClient.sellShares({ marketId: mktId, outcomeId: selectedOutcome, amount: sellAmount });
            if (response.success && response.data) {
              setUserBalance(response.data.newBalance);
              setUserHoldings(prev => ({ ...prev, [selectedOutcome]: Math.max(0, (prev[selectedOutcome] || 0) - sellAmount) }));
              showToast({ message: `Sold ${sellAmount} shares for ${response.data.revenue} credits`, type: 'success' });
              fetchMarketData();
            } else {
              showToast({ message: response.error || 'Sell failed', type: 'error' });
            }
          } catch (err) {
            showToast({ message: 'Failed to sell shares.', type: 'error' });
          } finally {
            setExecutingTrade(false);
          }
        },
      });
    }
  };

  // Show loading state
  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading market...</Text>
      </View>
    );
  }

  // Show error state when market didn't load (still showing default stub)
  if (error && market.id === DEFAULT_MARKET.id) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchMarketData()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Market Header */}
        <View style={styles.header}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{market.category}</Text>
          </View>
          <Text style={styles.title}>{market.title}</Text>
          <Text style={styles.description}>{market.description}</Text>
          {(market as any).createdBy?.displayName && (
            <Text style={styles.proposedBy}>
              Proposed by {(market as any).createdBy.displayName}
            </Text>
          )}
        </View>

        {/* Market Info */}
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📊 Total Volume</Text>
            <Text style={styles.infoValue}>{market.totalVolume.toLocaleString()} credits</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📅 Expires</Text>
            <Text style={styles.infoValue}>
              {new Date(market.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>
        </View>

        {/* Trading Section */}
        <View style={styles.tradingSection}>
          <Text style={styles.sectionTitle}>Trade</Text>

          {/* Balance */}
          <View style={styles.balanceContainer}>
            <Text style={styles.balanceLabel}>Your Balance</Text>
            <Text style={styles.balanceValue}>
              {userBalance !== null ? `${userBalance.toLocaleString()} credits` : '—'}
            </Text>
          </View>

          {/* Buy/Sell Toggle */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, tradeType === 'BUY' && styles.toggleBuy]}
              onPress={() => setTradeType('BUY')}
            >
              <Text style={[styles.toggleText, tradeType === 'BUY' && styles.toggleTextActive]}>Buy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, tradeType === 'SELL' && styles.toggleSell]}
              onPress={() => setTradeType('SELL')}
            >
              <Text style={[styles.toggleText, tradeType === 'SELL' && styles.toggleTextActive]}>Sell</Text>
            </TouchableOpacity>
          </View>

          {/* Outcome Selection */}
          <Text style={styles.inputLabel}>Select Outcome</Text>
          <View style={styles.outcomesContainer}>
            {market.outcomes.map((outcome) => (
              <TouchableOpacity
                key={outcome.id}
                style={[
                  styles.outcomeButton,
                  selectedOutcome === outcome.id && styles.outcomeButtonSelected,
                  selectedOutcome === outcome.id && { borderColor: outcome.color ?? Colors.primary },
                ]}
                onPress={() => setSelectedOutcome(outcome.id)}
              >
                <View style={styles.outcomeButtonHeader}>
                  <View style={[styles.outcomeDot, { backgroundColor: outcome.color ?? Colors.textMuted }]} />
                  <Text style={styles.outcomeName} numberOfLines={1}>{outcome.name}</Text>
                </View>
                <Text style={[styles.outcomePrice, { color: outcome.color ?? Colors.textSecondary }]}>
                  {((outcome.currentPrice || 0) * 100).toFixed(0)}¢
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Amount Input */}
          <Text style={styles.inputLabel}>
            {tradeType === 'BUY' ? 'Amount to spend (credits)' : `Shares to sell${selectedOutcome ? ` (own: ${userHoldings[selectedOutcome] || 0})` : ''}`}
          </Text>
          <TextInput
            style={styles.quantityInput}
            value={credits}
            onChangeText={setCredits}
            keyboardType="numeric"
            placeholder="50"
            placeholderTextColor={Colors.textMuted}
          />

          {/* Quick Amounts */}
          <View style={styles.quickAmounts}>
            {[10, 50, 100, 500].map((amount) => (
              <TouchableOpacity
                key={amount}
                style={styles.quickAmountButton}
                onPress={() => setCredits(amount.toString())}
              >
                <Text style={styles.quickAmountText}>{amount}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Order Summary */}
          <View style={styles.costSummary}>
            {tradeType === 'BUY' ? (
              <>
                <View style={styles.costRow}>
                  <Text style={styles.costLabel}>You'll receive</Text>
                  <Text style={styles.costValue}>
                    {previewShares != null ? `${previewShares} shares` : '—'}
                  </Text>
                </View>
                <View style={styles.costRow}>
                  <Text style={styles.costLabel}>Estimated cost</Text>
                  <Text style={styles.costValue}>
                    {previewActualCost != null ? `-${previewActualCost} credits` : '—'}
                  </Text>
                </View>
                <View style={[styles.costRow, styles.payoutRow]}>
                  <Text style={[styles.costLabel, styles.payoutLabel]}>Max payout</Text>
                  <Text style={[styles.costValue, styles.payoutValue]}>
                    {previewShares != null ? `+${previewShares} credits` : '—'}
                  </Text>
                </View>
                {previewActualCost != null && userBalance !== null && (
                  <View style={styles.costRow}>
                    <Text style={styles.costLabel}>Balance after</Text>
                    <Text style={styles.costValue}>{(userBalance - previewActualCost).toLocaleString()} credits</Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <View style={styles.costRow}>
                  <Text style={styles.costLabel}>Shares to sell</Text>
                  <Text style={styles.costValue}>{parseInt(credits) || 0}</Text>
                </View>
                <View style={[styles.costRow, styles.payoutRow]}>
                  <Text style={[styles.costLabel, styles.payoutLabel]}>You'll receive</Text>
                  <Text style={[styles.costValue, styles.payoutValue]}>
                    {sellPreviewRevenue != null ? `+${sellPreviewRevenue} credits` : '—'}
                  </Text>
                </View>
                {sellPreviewRevenue != null && userBalance !== null && (
                  <View style={styles.costRow}>
                    <Text style={styles.costLabel}>Balance after</Text>
                    <Text style={styles.costValue}>{(userBalance + sellPreviewRevenue).toLocaleString()} credits</Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Execute Button */}
          <TouchableOpacity
            style={[
              styles.executeButton,
              tradeType === 'BUY' ? styles.executeBuy : styles.executeSell,
              (!selectedOutcome || executingTrade || (tradeType === 'BUY' ? !previewShares : !(parseInt(credits) > 0))) && styles.executeDisabled,
            ]}
            onPress={handleTrade}
            disabled={!selectedOutcome || executingTrade || (tradeType === 'BUY' ? !previewShares : !(parseInt(credits) > 0))}
          >
            {executingTrade
              ? <ActivityIndicator color={Colors.textPrimary} />
              : <Text style={styles.executeButtonText}>
                  {previewShares
                    ? `${tradeType === 'BUY' ? 'BUY' : 'SELL'} ${tradeType === 'BUY' ? previewShares : (parseInt(credits) || 0)} SHARES`
                    : tradeType === 'BUY' ? 'BUY' : 'SELL'}
                </Text>
            }
          </TouchableOpacity>
        </View>

        {/* Challenge a Friend */}
        <TouchableOpacity
          style={styles.challengeSection}
          onPress={() => {
            router.back();
            setTimeout(() => router.push('/(tabs)/friends'), 100);
          }}
        >
          <View style={styles.challengeLeft}>
            <Text style={styles.challengeIcon}>🎯</Text>
            <View>
              <Text style={styles.challengeTitle}>Challenge a Friend</Text>
              <Text style={styles.challengeSubtitle}>Bet against a friend on this market</Text>
            </View>
          </View>
          <Text style={styles.challengeArrow}>›</Text>
        </TouchableOpacity>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            Credits have no real-world value. This is not gambling.
          </Text>
        </View>

        {/* Comments Section */}
        <Comments
          marketId={market.id}
          comments={comments}
          onAddComment={handleAddComment}
          onLikeComment={handleLikeComment}
        />
        <View style={{ height: 120 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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
    padding: Spacing.lg,
  },
  categoryBadge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    alignSelf: 'flex-start',
    marginBottom: Spacing.md,
  },
  categoryText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  description: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  infoSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  infoLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  infoValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  tradingSection: {
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    marginBottom: Spacing.lg,
  },
  balanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  balanceLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  balanceValue: {
    color: Colors.primary,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderRadius: 10,
  },
  toggleBuy: {
    backgroundColor: Colors.primary,
  },
  toggleSell: {
    backgroundColor: Colors.danger,
  },
  toggleText: {
    color: Colors.textSecondary,
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: Colors.textPrimary,
  },
  inputLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  outcomesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  outcomeButton: {
    width: '48%',
    flexDirection: 'column',
    alignItems: 'flex-start',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  outcomeButtonSelected: {
    backgroundColor: Colors.surfaceHighlight,
  },
  outcomeButtonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  outcomeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  outcomeName: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '500',
    marginLeft: 6,
    flexShrink: 1,
  },
  outcomePrice: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    marginLeft: Spacing.lg,
  },
  quantityInput: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  quickAmountButton: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  quickAmountText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  costSummary: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  costLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  costValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  costValuePositive: {
    color: Colors.primary,
  },
  payoutRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  payoutLabel: {
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  payoutValue: {
    color: Colors.primary,
    fontWeight: '700',
  },
  executeButton: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  executeBuy: {
    backgroundColor: Colors.primary,
  },
  executeSell: {
    backgroundColor: Colors.danger,
  },
  executeDisabled: {
    backgroundColor: Colors.textMuted,
  },
  executeButtonText: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  disclaimer: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  disclaimerText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    marginTop: Spacing.md,
  },
  errorText: {
    color: Colors.danger,
    fontSize: FontSize.md,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: 10,
  },
  retryButtonText: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  challengeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  challengeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  challengeIcon: {
    fontSize: 28,
  },
  challengeTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  challengeSubtitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  challengeArrow: {
    fontSize: 28,
    color: Colors.primary,
    fontWeight: '600',
  },
  proposedBy: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: Spacing.sm,
  },
});
