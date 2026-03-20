import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../lib/colors';
import {
  PriceChart,
  VolumeChart,
  generateMockPriceHistory,
  generateMockVolumeData,
  Comments,
  NewsLinks,
  generateMockNews,
  OrderBook,
  generateMockOrderBook,
} from '../../lib/components';
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
    { id: 'yes', name: 'Yes', color: '#22C55E', currentPrice: 0.65 },
    { id: 'no', name: 'No', color: '#EF4444', currentPrice: 0.35 },
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
  const [executingTrade, setExecutingTrade] = useState(false);

  // Chart data state - will be updated when market data loads
  const [priceHistory, setPriceHistory] = useState(() => generateMockPriceHistory(0.65, 30));
  const [volumeData] = useState(() => generateMockVolumeData(30));

  // Comments, news, order book
  const [comments, setComments] = useState<any[]>([]);
  const [news] = useState(() => generateMockNews(market.title));
  const [orderBook, setOrderBook] = useState(() => generateMockOrderBook(0.65));

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
          const firstPrice = (Object.values(fetchedMarket.prices)[0] as number) || 0.5;
          setPriceHistory(generateMockPriceHistory(firstPrice, 30));
          setOrderBook(generateMockOrderBook(firstPrice));
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

  // Fetch user profile for real balance
  useEffect(() => {
    apiClient.getProfile().then(res => {
      if (res.success && res.data) setUserBalance(res.data.creditBalance);
    });
  }, []);

  // Live preview: given credits to spend → calculate shares + actual cost
  useEffect(() => {
    const amt = parseInt(credits) || 0;
    if (!selectedOutcome || amt <= 0) {
      setPreviewShares(null);
      setPreviewActualCost(null);
      return;
    }
    const mId = Array.isArray(id) ? id[0] : id || '1';
    apiClient.previewByCost({ marketId: mId, outcomeId: selectedOutcome, credits: amt })
      .then(res => {
        if (res.success && res.data) {
          setPreviewShares(res.data.shares);
          setPreviewActualCost(res.data.actualCost);
        }
      });
  }, [selectedOutcome, credits, id]);

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
    if (res.success && res.data) setComments(res.data);
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
    if (!previewShares || previewShares <= 0) {
      Alert.alert('Error', 'Enter an amount to spend');
      return;
    }

    const cost = previewActualCost ?? 0;
    const selectedOutcomeData = market.outcomes.find(o => o.id === selectedOutcome);

    if (tradeType === 'BUY' && userBalance !== null && cost > userBalance) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }

    Alert.alert(
      'Confirm Trade',
      `Buy ${previewShares} shares of "${selectedOutcomeData?.name}" for ${cost} credits?\nMax payout: ${previewShares} credits`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setExecutingTrade(true);
            try {
              const mktId = Array.isArray(id) ? id[0] : id || '1';
              const response = await apiClient.executeTrade({
                marketId: mktId,
                outcomeId: selectedOutcome,
                amount: previewShares,
              });

              if (response.success && response.data) {
                const result: TradeResult = response.data;
                setUserBalance(result.newBalance);
                setPreviewShares(null);
                setPreviewActualCost(null);
                Alert.alert(
                  'Trade Placed!',
                  `Bought ${previewShares} shares of ${selectedOutcomeData?.name}.\nCost: ${result.cost} credits\nMax payout: ${previewShares} credits\nBalance: ${result.newBalance} credits`
                );
                fetchMarketData();
              } else {
                Alert.alert('Error', response.error || 'Trade failed');
              }
            } catch (err) {
              Alert.alert('Error', 'Failed to execute trade. Please try again.');
              console.error('Trade error:', err);
            } finally {
              setExecutingTrade(false);
            }
          }
        },
      ]
    );
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
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Market Header */}
        <View style={styles.header}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{market.category}</Text>
          </View>
          <Text style={styles.title}>{market.title}</Text>
          <Text style={styles.description}>{market.description}</Text>
        </View>

        {/* Price History Chart */}
        <View style={styles.probabilitySection}>
          <Text style={styles.sectionTitle}>Price History</Text>
          <PriceChart data={priceHistory} />
        </View>

        {/* Volume Chart */}
        <View style={styles.volumeSection}>
          <VolumeChart data={volumeData} />
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
                  <View style={[styles.outcomeDot, { backgroundColor: outcome.color ?? '#888' }]} />
                  <Text style={styles.outcomeName} numberOfLines={1}>{outcome.name}</Text>
                </View>
                <Text style={[styles.outcomePrice, { color: outcome.color ?? Colors.textSecondary }]}>
                  {((outcome.currentPrice || 0) * 100).toFixed(0)}¢
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Amount Input */}
          <Text style={styles.inputLabel}>Amount to spend (credits)</Text>
          <TextInput
            style={styles.quantityInput}
            value={credits}
            onChangeText={setCredits}
            keyboardType="numeric"
            placeholder="50"
            placeholderTextColor="#666"
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
          </View>

          {/* Execute Button */}
          <TouchableOpacity
            style={[
              styles.executeButton,
              tradeType === 'BUY' ? styles.executeBuy : styles.executeSell,
              (!selectedOutcome || !previewShares || executingTrade) && styles.executeDisabled,
            ]}
            onPress={handleTrade}
            disabled={!selectedOutcome || !previewShares || executingTrade}
          >
            {executingTrade
              ? <ActivityIndicator color={Colors.textPrimary} />
              : <Text style={styles.executeButtonText}>
                  {previewShares
                    ? `${tradeType === 'BUY' ? 'BUY' : 'SELL'} ${previewShares} SHARES`
                    : tradeType === 'BUY' ? 'BUY' : 'SELL'}
                </Text>
            }
          </TouchableOpacity>
        </View>

        {/* Challenge a Friend */}
        <TouchableOpacity
          style={styles.challengeSection}
          onPress={() => router.push('/(tabs)/friends')}
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

        {/* Order Book */}
        <OrderBook yesOrders={orderBook.yes} noOrders={orderBook.no} />

        {/* Related News */}
        <NewsLinks marketId={market.id} news={news} />

        {/* Comments Section */}
        <Comments
          marketId={market.id}
          comments={comments}
          onAddComment={handleAddComment}
          onLikeComment={handleLikeComment}
        />
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
    padding: 16,
  },
  categoryBadge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  categoryText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  probabilitySection: {
    padding: 16,
    paddingTop: 0,
  },
  volumeSection: {
    padding: 16,
    paddingTop: 0,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  probabilityBar: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
  },
  probabilityContainer: {
    height: 24,
    backgroundColor: Colors.background,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  probabilityFill: {
    height: '100%',
    borderRadius: 12,
  },
  probabilityLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  probabilityText: {
    fontSize: 14,
    fontWeight: '700',
  },
  infoSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  infoValue: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  tradingSection: {
    padding: 16,
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  balanceContainer: {
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
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
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
    fontSize: 16,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: Colors.textPrimary,
  },
  inputLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
  },
  outcomesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  outcomeButton: {
    width: '48%',
    flexDirection: 'column',
    alignItems: 'flex-start',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
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
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 6,
    flexShrink: 1,
  },
  outcomePrice: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 16,
  },
  quantityInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickAmountButton: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  quickAmountText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  costSummary: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  costLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  costValue: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  costValuePositive: {
    color: Colors.primary,
  },
  payoutRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
    marginTop: 4,
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
    borderRadius: 12,
    paddingVertical: 16,
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
    fontSize: 16,
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
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
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
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
  },
  challengeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  challengeIcon: {
    fontSize: 28,
  },
  challengeTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  challengeSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  challengeArrow: {
    fontSize: 28,
    color: Colors.primary,
    fontWeight: '600',
  },
});
