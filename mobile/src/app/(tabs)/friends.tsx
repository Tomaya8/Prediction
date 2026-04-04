// Versus — Comparative Asset Predictions
// "Which asset will perform better?"
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../lib/colors';
import { useStyles } from '../../lib/useStyles';
import { apiClient } from '../../lib/api-client';
import { showToast } from '../../lib/components';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTimeRemaining(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatPrice(price: number, symbol: string): string {
  if (symbol.includes('/')) return price.toFixed(4); // Forex
  if (price > 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${price.toFixed(2)}`;
}

function changeColor(change: number): string {
  return change > 0 ? '#22C55E' : change < 0 ? '#EF4444' : Colors.textSecondary;
}

function changeArrow(change: number): string {
  return change > 0 ? '▲' : change < 0 ? '▼' : '—';
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═════════════════════════════════════════════════════════════════════════════

export default function VersusScreen() {
  const styles = useStyles(createStyles);
  const [matchups, setMatchups] = useState<any[]>([]);
  const [recentResults, setRecentResults] = useState<any[]>([]);
  const [myPicks, setMyPicks] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);

  // Custom confirm modal state
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmData, setConfirmData] = useState<{
    matchupId: string; pick: 'A' | 'B'; matchup: any;
    assetName: string; assetColor: string; odds: number; fee: number; payout: number;
  } | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const res = await apiClient.getVersusMatchups();
      if (res.success && res.data) {
        setMatchups(res.data.matchups || []);
        setRecentResults(res.data.recentResults || []);
        setMyPicks(res.data.myPicks || {});
      }
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePick = (matchupId: string, pick: 'A' | 'B', matchup: any) => {
    const assetName = pick === 'A' ? matchup.assetA.symbol : matchup.assetB.symbol;
    const assetColor = pick === 'A' ? matchup.assetA.color : matchup.assetB.color;
    const odds = pick === 'A' ? matchup.oddsA : matchup.oddsB;
    const fee = matchup.entryFee || 25;
    const payout = Math.round(fee * odds);
    setConfirmData({ matchupId, pick, matchup, assetName, assetColor, odds, fee, payout });
    setConfirmVisible(true);
  };

  const executePickConfirm = async () => {
    if (!confirmData) return;
    const { matchupId, pick, assetName, fee, payout } = confirmData;
    setConfirmVisible(false);
    setPicking(`${matchupId}_${pick}`);
    const res = await apiClient.pickVersus(matchupId, pick);
    setPicking(null);
    if (res.success) {
      showToast({ message: `Picked ${assetName}! Potential payout: ${payout} credits`, type: 'success' });
      setMyPicks(prev => ({ ...prev, [matchupId]: { pick, amount: fee } }));
      fetchData(true);
    } else {
      Alert.alert('Error', res.error || 'Failed to place pick');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Which asset wins?</Text>
          <Text style={styles.headerSub}>Pick the better performer. Backed by real market data.</Text>
        </View>

        {matchups.length === 0 && recentResults.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>⚔️</Text>
            <Text style={styles.emptyTitle}>No Matchups Yet</Text>
            <Text style={styles.emptyText}>New matchups are created daily. Check back soon!</Text>
          </View>
        ) : (
          <>
            {/* Active Matchups */}
            {matchups.map(m => {
              const myPick = myPicks[m.id];
              const hasPicked = !!myPick;
              const totalPicks = (m.picksA || 0) + (m.picksB || 0);
              const pctA = totalPicks > 0 ? Math.round((m.picksA / totalPicks) * 100) : 50;
              const pctB = 100 - pctA;

              return (
                <View key={m.id} style={styles.card}>
                  {/* VS Header */}
                  <View style={styles.vsHeader}>
                    <View style={styles.assetSide}>
                      <View style={[styles.assetDot, { backgroundColor: m.assetA.color }]} />
                      <Text style={styles.assetSymbol}>{m.assetA.symbol}</Text>
                    </View>
                    <View style={styles.vsBadge}>
                      <Text style={styles.vsText}>VS</Text>
                    </View>
                    <View style={[styles.assetSide, { alignItems: 'flex-end' }]}>
                      <Text style={styles.assetSymbol}>{m.assetB.symbol}</Text>
                      <View style={[styles.assetDot, { backgroundColor: m.assetB.color }]} />
                    </View>
                  </View>

                  {/* Prices + Changes */}
                  <View style={styles.priceRow}>
                    <View style={styles.priceCol}>
                      <Text style={styles.priceValue}>{formatPrice(m.assetA.priceAtCreation, m.assetA.symbol)}</Text>
                      <Text style={[styles.changeText, { color: changeColor(m.assetA.change7d) }]}>
                        {changeArrow(m.assetA.change7d)} {m.assetA.change7d > 0 ? '+' : ''}{m.assetA.change7d.toFixed(2)}%
                      </Text>
                      <Text style={styles.changePeriod}>7 days</Text>
                    </View>
                    <View style={[styles.priceCol, { alignItems: 'flex-end' }]}>
                      <Text style={styles.priceValue}>{formatPrice(m.assetB.priceAtCreation, m.assetB.symbol)}</Text>
                      <Text style={[styles.changeText, { color: changeColor(m.assetB.change7d) }]}>
                        {changeArrow(m.assetB.change7d)} {m.assetB.change7d > 0 ? '+' : ''}{m.assetB.change7d.toFixed(2)}%
                      </Text>
                      <Text style={styles.changePeriod}>7 days</Text>
                    </View>
                  </View>

                  {/* Insights */}
                  {m.insights && m.insights.length > 0 && (
                    <View style={styles.insightsBox}>
                      <View style={styles.insightsHeader}>
                        <Ionicons name="bulb-outline" size={14} color={Colors.warning} />
                        <Text style={styles.insightsLabel}>Market Insight</Text>
                      </View>
                      {m.insights.map((insight: string, i: number) => (
                        <Text key={i} style={styles.insightText}>{insight}</Text>
                      ))}
                    </View>
                  )}

                  {/* Pick Distribution Bar */}
                  {totalPicks > 0 && (
                    <View style={styles.distributionRow}>
                      <Text style={styles.distLabel}>{pctA}%</Text>
                      <View style={styles.distBar}>
                        <View style={[styles.distFillA, { width: `${pctA}%`, backgroundColor: m.assetA.color }]} />
                        <View style={[styles.distFillB, { width: `${pctB}%`, backgroundColor: m.assetB.color }]} />
                      </View>
                      <Text style={styles.distLabel}>{pctB}%</Text>
                    </View>
                  )}

                  {/* Pick Buttons */}
                  {!hasPicked ? (
                    <View style={styles.pickRow}>
                      <TouchableOpacity
                        style={[styles.pickButton, { borderColor: m.assetA.color }]}
                        onPress={() => handlePick(m.id, 'A', m)}
                        disabled={picking !== null}
                      >
                        {picking === `${m.id}_A` ? (
                          <ActivityIndicator size="small" color={m.assetA.color} />
                        ) : (
                          <>
                            <Text style={[styles.pickAsset, { color: m.assetA.color }]}>{m.assetA.symbol}</Text>
                            <Text style={styles.pickOdds}>{m.oddsA}x</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.pickButton, { borderColor: m.assetB.color }]}
                        onPress={() => handlePick(m.id, 'B', m)}
                        disabled={picking !== null}
                      >
                        {picking === `${m.id}_B` ? (
                          <ActivityIndicator size="small" color={m.assetB.color} />
                        ) : (
                          <>
                            <Text style={[styles.pickAsset, { color: m.assetB.color }]}>{m.assetB.symbol}</Text>
                            <Text style={styles.pickOdds}>{m.oddsB}x</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.pickedSection}>
                      <View style={styles.pickedBanner}>
                        <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                        <Text style={styles.pickedText}>
                          You picked {myPick.pick === 'A' ? m.assetA.symbol : m.assetB.symbol}
                        </Text>
                        <Text style={styles.pickedOdds}>{myPick.pick === 'A' ? m.oddsA : m.oddsB}x</Text>
                      </View>
                      <View style={styles.pickedDetails}>
                        <View style={styles.pickedDetail}>
                          <Text style={styles.pickedDetailLabel}>Entry</Text>
                          <Text style={styles.pickedDetailValue}>{m.entryFee} credits</Text>
                        </View>
                        <View style={styles.pickedDetailDivider} />
                        <View style={styles.pickedDetail}>
                          <Text style={styles.pickedDetailLabel}>If you win</Text>
                          <Text style={[styles.pickedDetailValue, { color: '#22C55E' }]}>
                            +{Math.round(m.entryFee * (myPick.pick === 'A' ? m.oddsA : m.oddsB))} credits
                          </Text>
                        </View>
                        <View style={styles.pickedDetailDivider} />
                        <View style={styles.pickedDetail}>
                          <Text style={styles.pickedDetailLabel}>If you lose</Text>
                          <Text style={[styles.pickedDetailValue, { color: '#EF4444' }]}>-{m.entryFee} credits</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Footer */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.footerFee}>{m.entryFee} credits</Text>
                    <Text style={styles.footerTime}>⏱️ {getTimeRemaining(m.expiresAt)}</Text>
                  </View>
                </View>
              );
            })}

            {/* Recent Results */}
            {recentResults.length > 0 && (
              <View style={styles.resultsSection}>
                <Text style={styles.resultsTitle}>Recent Results</Text>
                {recentResults.map((m: any) => (
                  <View key={m.id} style={styles.resultCard}>
                    <View style={styles.resultHeader}>
                      <Text style={styles.resultAssets}>
                        {m.assetA.symbol} vs {m.assetB.symbol}
                      </Text>
                      <View style={[styles.resultWinnerBadge, {
                        backgroundColor: m.winner === 'A' ? m.assetA.color + '20' : m.winner === 'B' ? m.assetB.color + '20' : Colors.surface,
                      }]}>
                        <Text style={[styles.resultWinnerText, {
                          color: m.winner === 'A' ? m.assetA.color : m.winner === 'B' ? m.assetB.color : Colors.textSecondary,
                        }]}>
                          {m.winner === 'TIE' ? 'Tie' : `${m.winner === 'A' ? m.assetA.symbol : m.assetB.symbol} won`}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.resultChanges}>
                      <Text style={[styles.resultChange, { color: changeColor(m.changeA || 0) }]}>
                        {m.assetA.symbol}: {m.changeA > 0 ? '+' : ''}{m.changeA?.toFixed(2)}%
                      </Text>
                      <Text style={[styles.resultChange, { color: changeColor(m.changeB || 0) }]}>
                        {m.assetB.symbol}: {m.changeB > 0 ? '+' : ''}{m.changeB?.toFixed(2)}%
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* How It Works */}
        <View style={styles.howCard}>
          <Text style={styles.howTitle}>How Versus Works</Text>
          {[
            'Two assets go head-to-head for a set time period',
            'Pick which asset will increase more (or decrease less)',
            'Odds are set by recent market momentum — underdogs pay more',
            'When time expires, % change is compared. Winner takes the payout!',
          ].map((rule, i) => (
            <View key={i} style={styles.howItem}>
              <View style={styles.howNumber}><Text style={styles.howNumberText}>{i + 1}</Text></View>
              <Text style={styles.howText}>{rule}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Custom Confirm Modal */}
      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {confirmData && (
              <>
                <View style={styles.modalHeader}>
                  <View style={[styles.modalAssetDot, { backgroundColor: confirmData.assetColor }]} />
                  <Text style={styles.modalTitle}>Pick {confirmData.assetName}?</Text>
                </View>

                <Text style={styles.modalSubtitle}>
                  You're betting {confirmData.assetName} will outperform{' '}
                  {confirmData.pick === 'A' ? confirmData.matchup.assetB.symbol : confirmData.matchup.assetA.symbol}
                </Text>

                <View style={styles.modalStats}>
                  <View style={styles.modalStat}>
                    <Text style={styles.modalStatLabel}>Entry</Text>
                    <Text style={styles.modalStatValue}>{confirmData.fee} credits</Text>
                  </View>
                  <View style={styles.modalStatDivider} />
                  <View style={styles.modalStat}>
                    <Text style={styles.modalStatLabel}>Payout</Text>
                    <Text style={[styles.modalStatValue, { color: '#22C55E' }]}>
                      {confirmData.payout} credits
                    </Text>
                  </View>
                  <View style={styles.modalStatDivider} />
                  <View style={styles.modalStat}>
                    <Text style={styles.modalStatLabel}>Odds</Text>
                    <Text style={[styles.modalStatValue, { color: confirmData.assetColor }]}>
                      {confirmData.odds}x
                    </Text>
                  </View>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setConfirmVisible(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalConfirmBtn, { backgroundColor: confirmData.assetColor }]}
                    onPress={executePickConfirm}
                  >
                    <Text style={styles.modalConfirmText}>Pick {confirmData.assetName}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STYLES — Dark card aesthetic, trading terminal feel
// ═════════════════════════════════════════════════════════════════════════════

function createStyles() { return StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },

  // Header
  header: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, paddingBottom: Spacing.md },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  headerSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },

  // Card — dark background even in light mode for "terminal" feel
  card: {
    backgroundColor: '#1A1A2E',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },

  // VS Header
  vsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  assetSide: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  assetDot: { width: 12, height: 12, borderRadius: 6 },
  assetSymbol: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  vsBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  vsText: { fontSize: FontSize.sm, fontWeight: '800', color: 'rgba(255,255,255,0.5)', letterSpacing: 2 },

  // Prices
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.lg },
  priceCol: {},
  priceValue: { fontSize: FontSize.lg, fontWeight: '700', color: '#FFFFFF' },
  changeText: { fontSize: FontSize.md, fontWeight: '600', marginTop: 2 },
  changePeriod: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.4)', marginTop: 1 },

  // Insights
  insightsBox: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.lg, borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  insightsHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  insightsLabel: { fontSize: FontSize.xs, fontWeight: '700', color: '#F59E0B', textTransform: 'uppercase', letterSpacing: 1 },
  insightText: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', lineHeight: 18, marginBottom: Spacing.xs },

  // Distribution
  distributionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  distLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)', width: 30, textAlign: 'center' },
  distBar: { flex: 1, height: 6, borderRadius: 3, flexDirection: 'row', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)' },
  distFillA: { height: 6, borderTopLeftRadius: 3, borderBottomLeftRadius: 3 },
  distFillB: { height: 6, borderTopRightRadius: 3, borderBottomRightRadius: 3 },

  // Pick Buttons
  pickRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  pickButton: {
    flex: 1, borderWidth: 2, borderRadius: Radius.md,
    paddingVertical: Spacing.lg, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  pickAsset: { fontSize: FontSize.lg, fontWeight: '800' },
  pickOdds: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginTop: Spacing.xs },

  // Picked state
  pickedSection: { marginBottom: Spacing.md },
  pickedBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: Radius.md, borderTopLeftRadius: Radius.md, borderTopRightRadius: Radius.md, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  pickedText: { fontSize: FontSize.md, fontWeight: '600', color: '#22C55E', flex: 1 },
  pickedOdds: { fontSize: FontSize.md, fontWeight: '800', color: '#22C55E' },
  pickedDetails: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderBottomLeftRadius: Radius.md, borderBottomRightRadius: Radius.md, paddingVertical: Spacing.md },
  pickedDetail: { flex: 1, alignItems: 'center' },
  pickedDetailLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.4)' },
  pickedDetailValue: { fontSize: FontSize.sm, fontWeight: '700', color: '#FFFFFF', marginTop: 2 },
  pickedDetailDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)' },

  // Footer
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerFee: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.4)' },
  footerTime: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },

  // Results
  resultsSection: { paddingHorizontal: Spacing.lg, marginTop: Spacing.md },
  resultsTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  resultCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.lg, marginBottom: Spacing.sm },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  resultAssets: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  resultWinnerBadge: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.sm },
  resultWinnerText: { fontSize: FontSize.xs, fontWeight: '700' },
  resultChanges: { flexDirection: 'row', gap: Spacing.xl },
  resultChange: { fontSize: FontSize.sm, fontWeight: '600' },

  // Empty
  empty: { alignItems: 'center', padding: 60 },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: Spacing.xs },

  // How It Works
  howCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, margin: Spacing.lg, marginTop: Spacing.xl },
  howTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.lg },
  howItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.md, gap: Spacing.md },
  howNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  howNumberText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  howText: { flex: 1, fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 20 },

  // Custom Confirm Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: Spacing.xl },
  modalCard: { backgroundColor: '#1A1A2E', borderRadius: 20, padding: Spacing.xxl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  modalAssetDot: { width: 16, height: 16, borderRadius: 8 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  modalSubtitle: { fontSize: FontSize.md, color: 'rgba(255,255,255,0.6)', marginBottom: Spacing.xxl, lineHeight: 20 },
  modalStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: Radius.md, paddingVertical: Spacing.lg, marginBottom: Spacing.xxl },
  modalStat: { flex: 1, alignItems: 'center' },
  modalStatLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.4)', marginBottom: 4 },
  modalStatValue: { fontSize: FontSize.lg, fontWeight: '800', color: '#FFFFFF' },
  modalStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  modalButtons: { flexDirection: 'row', gap: Spacing.md },
  modalCancelBtn: { flex: 1, paddingVertical: 16, alignItems: 'center', borderRadius: Radius.md, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  modalCancelText: { fontSize: FontSize.lg, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  modalConfirmBtn: { flex: 1.5, paddingVertical: 16, alignItems: 'center', borderRadius: Radius.md },
  modalConfirmText: { fontSize: FontSize.lg, fontWeight: '800', color: '#FFFFFF' },
}); }
