import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../lib/colors';
import { useStyles } from '../../lib/useStyles';
import { apiClient } from '../../lib/api-client';
import { showToast } from '../../lib/components';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TournamentV2 {
  id: string;
  type: 'MONTHLY' | 'WEEKLY' | 'RAPID';
  category: string;
  status: 'REGISTRATION' | 'LOCKED' | 'RESOLVED';
  question: string;
  unit: string;
  asset: string;
  currentValueAtCreation: number;
  historicalLow?: number;
  historicalHigh?: number;
  entryFee: number;
  rakePercent: number;
  prizePool: number;
  playerCount: number;
  maxPlayers: number;
  registrationOpens: string;
  registrationCloses: string;
  expiresAt: string;
  resolvedAt?: string;
  actualValue?: number;
  payoutTable: { rank: number; payout: number }[];
}

interface MyEntry {
  prediction: number;
  enteredAt: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTypeConfig(type: string) {
  switch (type) {
    case 'RAPID': return { icon: 'flash', color: '#F59E0B', label: 'RAPID', bgColor: 'rgba(245,158,11,0.15)' };
    case 'WEEKLY': return { icon: 'calendar', color: '#3B82F6', label: 'WEEKLY', bgColor: 'rgba(59,130,246,0.15)' };
    case 'MONTHLY': return { icon: 'trophy', color: '#8B5CF6', label: 'MONTHLY', bgColor: 'rgba(139,92,246,0.15)' };
    default: return { icon: 'help-circle', color: Colors.textSecondary, label: type, bgColor: Colors.surface };
  }
}

function getTimeRemaining(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function getMaxMultiplier(type: string): string {
  // Show potential max multiplier based on tournament type (assumes enough players)
  switch (type) {
    case 'MONTHLY': return '2x';
    case 'WEEKLY': return '5x';
    case 'RAPID': return '10x';
    default: return '3x';
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TOURNAMENT ENTRY MODAL
// ═════════════════════════════════════════════════════════════════════════════

function TournamentEntryModal({
  tournament,
  myEntry,
  distribution,
  visible,
  onClose,
  onEntered,
}: {
  tournament: TournamentV2 | null;
  myEntry: MyEntry | null;
  distribution: { min: number; max: number; count: number }[];
  visible: boolean;
  onClose: () => void;
  onEntered: () => void;
}) {
  const styles = useStyles(createEntryStyles);
  const [prediction, setPrediction] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isEditing = !!myEntry;

  useEffect(() => {
    if (visible && myEntry) {
      setPrediction(myEntry.prediction.toString());
    } else if (visible) {
      setPrediction('');
    }
  }, [visible, myEntry]);

  if (!tournament) return null;

  const typeConfig = getTypeConfig(tournament.type);
  const maxDistCount = Math.max(...distribution.map(d => d.count), 1);

  const handleSubmit = async () => {
    const value = parseFloat(prediction);
    if (isNaN(value)) {
      Alert.alert('Error', 'Please enter a valid number');
      return;
    }
    setSubmitting(true);
    try {
      const res = isEditing
        ? await apiClient.editTournamentPrediction(tournament.id, value)
        : await apiClient.enterTournament(tournament.id, value);
      if (res.success) {
        showToast({
          message: isEditing ? 'Prediction updated!' : `Entered! -${tournament.entryFee} credits`,
          type: 'success',
        });
        onEntered();
        onClose();
      } else {
        Alert.alert('Error', res.error || 'Failed');
      }
    } catch {
      Alert.alert('Error', 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={styles.header}>
              <View style={[styles.typeBadge, { backgroundColor: typeConfig.bgColor }]}>
                <Ionicons name={typeConfig.icon as any} size={14} color={typeConfig.color} />
                <Text style={[styles.typeLabel, { color: typeConfig.color }]}>{typeConfig.label}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Question */}
            <Text style={styles.question}>{tournament.question}</Text>

            {/* Current Value + Range */}
            <View style={styles.valueCard}>
              <View style={styles.valueRow}>
                <Text style={styles.valueLabel}>Current value</Text>
                <Text style={styles.valueNumber}>
                  {tournament.unit}{tournament.currentValueAtCreation.toLocaleString()}
                </Text>
              </View>
              {tournament.historicalLow != null && tournament.historicalHigh != null && (
                <View style={styles.valueRow}>
                  <Text style={styles.valueLabel}>Range</Text>
                  <Text style={styles.rangeText}>
                    {tournament.unit}{tournament.historicalLow.toLocaleString()} — {tournament.unit}{tournament.historicalHigh.toLocaleString()}
                  </Text>
                </View>
              )}
            </View>

            {/* Prediction Input */}
            <Text style={styles.inputLabel}>Your Prediction</Text>
            <View style={styles.inputRow}>
              {tournament.unit ? <Text style={styles.inputUnit}>{tournament.unit}</Text> : null}
              <TextInput
                style={styles.input}
                value={prediction}
                onChangeText={setPrediction}
                keyboardType="decimal-pad"
                placeholder={tournament.currentValueAtCreation.toString()}
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {/* Distribution Histogram */}
            {distribution.length > 0 && (
              <View style={styles.histogramSection}>
                <Text style={styles.histLabel}>Where others are guessing</Text>
                {distribution.map((bucket, i) => (
                  <View key={i} style={styles.histRow}>
                    <Text style={styles.histRange}>
                      {bucket.min.toFixed(2)}
                    </Text>
                    <View style={styles.histBarBg}>
                      <View
                        style={[styles.histBar, { width: `${(bucket.count / maxDistCount) * 100}%` }]}
                      />
                    </View>
                    <Text style={styles.histCount}>{bucket.count}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Prize Breakdown */}
            <View style={styles.prizeSection}>
              <Text style={styles.prizeTitle}>Prizes</Text>
              <View style={styles.prizeRow}>
                <Text style={styles.prizeLabel}>Players</Text>
                <Text style={styles.prizeValue}>{tournament.playerCount}</Text>
              </View>
              <View style={styles.prizeRow}>
                <Text style={styles.prizeLabel}>Prize pool</Text>
                <Text style={styles.prizeValue}>{tournament.prizePool.toLocaleString()} credits</Text>
              </View>
              {tournament.payoutTable.slice(0, 5).map(p => (
                <View key={p.rank} style={styles.prizeRow}>
                  <Text style={styles.prizeLabel}>
                    {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `#${p.rank}`} Place
                  </Text>
                  <Text style={[styles.prizeValue, p.rank <= 3 && { color: Colors.primary, fontWeight: '700' }]}>
                    {p.payout.toLocaleString()} credits ({(p.payout / (tournament.entryFee || 1)).toFixed(1)}x)
                  </Text>
                </View>
              ))}
            </View>

            {/* Registration deadline */}
            <Text style={styles.deadline}>
              {tournament.status === 'REGISTRATION'
                ? `Registration closes in ${getTimeRemaining(tournament.registrationCloses)}`
                : 'Registration closed'}
            </Text>

            {/* Submit Button */}
            {tournament.status === 'REGISTRATION' && (
              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>
                    {isEditing
                      ? 'Update Prediction'
                      : `Submit Prediction — ${tournament.entryFee} credits`}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TRACKER MODAL (during lock period)
// ═════════════════════════════════════════════════════════════════════════════

function TrackerModal({
  tournamentId,
  question,
  visible,
  onClose,
}: {
  tournamentId: string;
  question: string;
  visible: boolean;
  onClose: () => void;
}) {
  const styles = useStyles(createTrackerStyles);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible && tournamentId) {
      setLoading(true);
      apiClient.getTournamentTracker(tournamentId).then(res => {
        if (res.success) setData(res.data);
        setLoading(false);
      });
    }
  }, [visible, tournamentId]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Live Tracker</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={Colors.textSecondary} /></TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
          ) : data ? (
            <View style={styles.body}>
              <Text style={styles.question}>{question}</Text>

              <View style={styles.statRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Your prediction</Text>
                  <Text style={styles.statValue}>{data.unit}{data.prediction.toLocaleString()}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Current value</Text>
                  <Text style={styles.statValue}>{data.unit}{data.currentValue.toLocaleString()}</Text>
                </View>
              </View>

              <View style={styles.rankCard}>
                <Text style={styles.rankLabel}>Estimated Rank</Text>
                <Text style={styles.rankValue}>#{data.estimatedRank}</Text>
                <Text style={styles.rankSub}>of {data.totalPlayers} players</Text>
              </View>

              <View style={styles.distanceRow}>
                <Text style={styles.distanceLabel}>Your distance</Text>
                <Text style={[
                  styles.distanceValue,
                  { color: data.estimatedRank <= 3 ? Colors.primary : Colors.textPrimary },
                ]}>
                  {data.distance}
                </Text>
              </View>

              {/* Progress bar */}
              <View style={styles.progressSection}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${data.progress}%` }]} />
                </View>
                <Text style={styles.progressText}>
                  Resolves in {getTimeRemaining(data.expiresAt)}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.errorText}>Failed to load tracker</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// RESULTS MODAL
// ═════════════════════════════════════════════════════════════════════════════

function ResultsModal({
  tournamentId,
  visible,
  onClose,
}: {
  tournamentId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const styles = useStyles(createResultsStyles);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible && tournamentId) {
      setLoading(true);
      apiClient.getTournamentResults(tournamentId).then(res => {
        if (res.success) setData(res.data);
        setLoading(false);
      });
    }
  }, [visible, tournamentId]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Results</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={Colors.textSecondary} /></TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
          ) : data ? (
            <ScrollView style={styles.body}>
              <Text style={styles.question}>{data.tournament.question}</Text>
              <View style={styles.actualCard}>
                <Text style={styles.actualLabel}>Actual Value</Text>
                <Text style={styles.actualValue}>{data.tournament.unit}{data.tournament.actualValue?.toLocaleString()}</Text>
              </View>

              {data.myResult && (
                <View style={[styles.myResultCard, data.myResult.payout > 0 && styles.myResultWin]}>
                  <Text style={styles.myResultLabel}>Your Result</Text>
                  <Text style={styles.myResultRank}>#{data.myResult.rank}</Text>
                  <Text style={styles.myResultPrediction}>
                    Predicted: {data.tournament.unit}{data.myResult.prediction.toLocaleString()}
                  </Text>
                  {data.myResult.payout > 0 && (
                    <Text style={styles.myResultPayout}>+{data.myResult.payout.toLocaleString()} credits</Text>
                  )}
                </View>
              )}

              <Text style={styles.leaderboardTitle}>Leaderboard</Text>
              {data.leaderboard.map((entry: any) => (
                <View key={entry.userId} style={[styles.lbRow, entry.userId === data.myResult?.userId && styles.lbRowMe]}>
                  <Text style={styles.lbRank}>
                    {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                  </Text>
                  <View style={styles.lbInfo}>
                    <Text style={styles.lbName}>{entry.displayName}</Text>
                    <Text style={styles.lbPrediction}>{data.tournament.unit}{entry.prediction.toLocaleString()}</Text>
                  </View>
                  <View style={styles.lbRight}>
                    <Text style={styles.lbDistance}>±{entry.distance}</Text>
                    {entry.payout > 0 && (
                      <Text style={styles.lbPayout}>+{entry.payout}</Text>
                    )}
                  </View>
                </View>
              ))}
              <View style={{ height: 40 }} />
            </ScrollView>
          ) : (
            <Text style={styles.errorText}>No results available</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═════════════════════════════════════════════════════════════════════════════

export default function TournamentsScreen() {
  const styles = useStyles(createStyles);
  const [tournaments, setTournaments] = useState<TournamentV2[]>([]);
  const [myEntries, setMyEntries] = useState<Record<string, MyEntry>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal state
  const [selectedTournament, setSelectedTournament] = useState<TournamentV2 | null>(null);
  const [selectedDistribution, setSelectedDistribution] = useState<any[]>([]);
  const [selectedMyEntry, setSelectedMyEntry] = useState<MyEntry | null>(null);
  const [showEntry, setShowEntry] = useState(false);
  const [showTracker, setShowTracker] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [trackerTournamentId, setTrackerTournamentId] = useState('');
  const [trackerQuestion, setTrackerQuestion] = useState('');
  const [resultsTournamentId, setResultsTournamentId] = useState('');

  const fetchTournaments = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const res = await apiClient.getTournamentsV2();
      if (res.success && res.data) {
        setTournaments(res.data.tournaments);
        setMyEntries(res.data.myEntries || {});
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchTournaments(); }, [fetchTournaments]);

  const openTournament = async (t: TournamentV2) => {
    if (t.status === 'RESOLVED') {
      setResultsTournamentId(t.id);
      setShowResults(true);
      return;
    }

    if (t.status === 'LOCKED' && myEntries[t.id]) {
      setTrackerTournamentId(t.id);
      setTrackerQuestion(t.question);
      setShowTracker(true);
      return;
    }

    // REGISTRATION — open entry/detail modal
    const res = await apiClient.getTournamentV2(t.id);
    if (res.success && res.data) {
      setSelectedTournament(res.data.tournament);
      setSelectedMyEntry(res.data.myEntry);
      setSelectedDistribution(res.data.distribution || []);
      setShowEntry(true);
    }
  };

  // Group tournaments — exclude entered ones from type sections to avoid duplicates
  const myJoined = tournaments.filter(t => myEntries[t.id]);
  const myJoinedIds = new Set(myJoined.map(t => t.id));
  const rapid = tournaments.filter(t => t.type === 'RAPID' && !myJoinedIds.has(t.id));
  const weekly = tournaments.filter(t => t.type === 'WEEKLY' && !myJoinedIds.has(t.id));
  const monthly = tournaments.filter(t => t.type === 'MONTHLY' && !myJoinedIds.has(t.id));

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const renderCard = (t: TournamentV2) => {
    const typeConfig = getTypeConfig(t.type);
    const entered = !!myEntries[t.id];
    const maxMult = getMaxMultiplier(t.type);

    return (
      <TouchableOpacity key={t.id} style={styles.card} onPress={() => openTournament(t)} activeOpacity={0.7}>
        {/* Top row: type badge + status */}
        <View style={styles.cardTop}>
          <View style={[styles.cardTypeBadge, { backgroundColor: typeConfig.bgColor }]}>
            <Ionicons name={typeConfig.icon as any} size={12} color={typeConfig.color} />
            <Text style={[styles.cardTypeText, { color: typeConfig.color }]}>{typeConfig.label}</Text>
          </View>
          {entered && (
            <View style={styles.enteredBadge}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
              <Text style={styles.enteredText}>Entered</Text>
            </View>
          )}
        </View>

        {/* Question */}
        <Text style={styles.cardQuestion} numberOfLines={2}>{t.question}</Text>

        {/* Stats row */}
        <View style={styles.cardStats}>
          <View style={styles.cardStat}>
            <Text style={styles.cardStatValue}>{t.playerCount}</Text>
            <Text style={styles.cardStatLabel}>players</Text>
          </View>
          <View style={styles.cardStat}>
            <Text style={[styles.cardStatValue, { color: Colors.primary }]}>{maxMult}</Text>
            <Text style={styles.cardStatLabel}>max payout</Text>
          </View>
          <View style={styles.cardStat}>
            <Text style={styles.cardStatValue}>{t.entryFee}</Text>
            <Text style={styles.cardStatLabel}>entry</Text>
          </View>
          <View style={styles.cardStat}>
            <Text style={styles.cardStatValue}>
              {t.status === 'REGISTRATION'
                ? getTimeRemaining(t.registrationCloses)
                : getTimeRemaining(t.expiresAt)}
            </Text>
            <Text style={styles.cardStatLabel}>
              {t.status === 'REGISTRATION' ? 'to enter' : 'left'}
            </Text>
          </View>
        </View>

        {/* Action hint */}
        {t.status === 'REGISTRATION' && !entered && (
          <View style={styles.cardAction}>
            <Text style={styles.cardActionText}>Tap to enter</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
          </View>
        )}
        {t.status === 'LOCKED' && entered && (
          <View style={styles.cardAction}>
            <Text style={[styles.cardActionText, { color: Colors.warning }]}>Tap to track</Text>
            <Ionicons name="pulse-outline" size={16} color={Colors.warning} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchTournaments(true)} tintColor={Colors.primary} />}
      >
        {tournaments.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🏆</Text>
            <Text style={styles.emptyTitle}>No Tournaments Yet</Text>
            <Text style={styles.emptyText}>Check back soon!</Text>
          </View>
        ) : (
          <>
            {/* My Active Tournaments */}
            {myJoined.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>My Tournaments</Text>
                {myJoined.map(renderCard)}
              </View>
            )}

            {/* Rapid */}
            {rapid.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="flash" size={18} color="#F59E0B" />
                  <Text style={styles.sectionTitle}>Rapid</Text>
                </View>
                {rapid.map(renderCard)}
              </View>
            )}

            {/* Weekly */}
            {weekly.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="calendar" size={18} color="#3B82F6" />
                  <Text style={styles.sectionTitle}>Weekly</Text>
                </View>
                {weekly.map(renderCard)}
              </View>
            )}

            {/* Monthly */}
            {monthly.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="trophy" size={18} color="#8B5CF6" />
                  <Text style={styles.sectionTitle}>Monthly</Text>
                </View>
                {monthly.map(renderCard)}
              </View>
            )}
          </>
        )}

        {/* How it works */}
        <View style={styles.rulesCard}>
          <Text style={styles.rulesTitle}>How Tournaments Work</Text>
          {[
            'Pick a tournament and submit your numeric prediction',
            'Pay the entry fee — it goes into the prize pool',
            'Registration closes, predictions are locked',
            'At expiry, the actual value is checked',
            'Closest prediction wins! Top players get multiplied payouts',
          ].map((rule, i) => (
            <View key={i} style={styles.ruleItem}>
              <View style={styles.ruleNumber}><Text style={styles.ruleNumberText}>{i + 1}</Text></View>
              <Text style={styles.ruleText}>{rule}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modals */}
      <TournamentEntryModal
        tournament={selectedTournament}
        myEntry={selectedMyEntry}
        distribution={selectedDistribution}
        visible={showEntry}
        onClose={() => setShowEntry(false)}
        onEntered={fetchTournaments}
      />
      <TrackerModal
        tournamentId={trackerTournamentId}
        question={trackerQuestion}
        visible={showTracker}
        onClose={() => setShowTracker(false)}
      />
      <ResultsModal
        tournamentId={resultsTournamentId}
        visible={showResults}
        onClose={() => setShowResults(false)}
      />
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════════

function createStyles() { return StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  section: { marginTop: Spacing.lg, paddingHorizontal: Spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },

  // Card
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  cardTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.sm },
  cardTypeText: { fontSize: FontSize.xs, fontWeight: '700' },
  enteredBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  enteredText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600' },
  cardQuestion: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textPrimary, marginBottom: Spacing.md, lineHeight: 22 },
  cardStats: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  cardStat: { alignItems: 'center' },
  cardStatValue: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  cardStatLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  cardAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  cardActionText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.primary },

  // Empty
  empty: { alignItems: 'center', padding: 60 },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: Spacing.xs },

  // Rules
  rulesCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, margin: Spacing.lg, marginTop: Spacing.xxl },
  rulesTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.lg },
  ruleItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.md, gap: Spacing.md },
  ruleNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  ruleNumberText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  ruleText: { flex: 1, fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 20 },
}); }

function createEntryStyles() { return StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  container: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.sm },
  typeLabel: { fontSize: FontSize.sm, fontWeight: '700' },
  closeBtn: { padding: Spacing.xs },
  question: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.lg, lineHeight: 28 },
  valueCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.lg, marginBottom: Spacing.lg },
  valueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  valueLabel: { fontSize: FontSize.md, color: Colors.textSecondary },
  valueNumber: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  rangeText: { fontSize: FontSize.md, color: Colors.textSecondary },
  inputLabel: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary, marginBottom: Spacing.sm },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.md, marginBottom: Spacing.lg },
  inputUnit: { fontSize: FontSize.xl, fontWeight: '600', color: Colors.textSecondary, paddingLeft: Spacing.lg },
  input: { flex: 1, fontSize: 28, fontWeight: '700', color: Colors.textPrimary, padding: Spacing.lg },
  histogramSection: { marginBottom: Spacing.lg },
  histLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  histRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: Spacing.sm },
  histRange: { width: 55, fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'right' },
  histBarBg: { flex: 1, height: 12, backgroundColor: Colors.surface, borderRadius: 6 },
  histBar: { height: 12, backgroundColor: Colors.primary + '60', borderRadius: 6 },
  histCount: { width: 20, fontSize: FontSize.xs, color: Colors.textMuted },
  prizeSection: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.lg, marginBottom: Spacing.lg },
  prizeTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  prizeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  prizeLabel: { fontSize: FontSize.md, color: Colors.textSecondary },
  prizeValue: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '600' },
  deadline: { textAlign: 'center', fontSize: FontSize.sm, color: Colors.warning, marginBottom: Spacing.md, fontWeight: '600' },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.lg, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: FontSize.lg, fontWeight: '700' },
}); }

function createTrackerStyles() { return StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', padding: Spacing.xl },
  container: { backgroundColor: Colors.background, borderRadius: 24, padding: Spacing.xl, maxHeight: '80%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  body: {},
  question: { fontSize: FontSize.lg, color: Colors.textSecondary, marginBottom: Spacing.xl, lineHeight: 22 },
  statRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  statBox: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.lg, alignItems: 'center' },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: Spacing.xs },
  statValue: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  rankCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.lg },
  rankLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  rankValue: { fontSize: 40, fontWeight: '800', color: Colors.primary, marginVertical: Spacing.xs },
  rankSub: { fontSize: FontSize.sm, color: Colors.textMuted },
  distanceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.md, marginBottom: Spacing.xl },
  distanceLabel: { fontSize: FontSize.md, color: Colors.textSecondary },
  distanceValue: { fontSize: FontSize.lg, fontWeight: '700' },
  progressSection: { alignItems: 'center' },
  progressBar: { width: '100%', height: 8, backgroundColor: Colors.surface, borderRadius: 4, marginBottom: Spacing.sm },
  progressFill: { height: 8, backgroundColor: Colors.primary, borderRadius: 4 },
  progressText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  errorText: { textAlign: 'center', color: Colors.textSecondary, marginTop: 40, fontSize: FontSize.md },
}); }

function createResultsStyles() { return StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  container: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', padding: Spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  body: { flex: 1 },
  question: { fontSize: FontSize.lg, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 22 },
  actualCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.lg },
  actualLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  actualValue: { fontSize: 32, fontWeight: '800', color: Colors.textPrimary, marginTop: Spacing.xs },
  myResultCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.lg, alignItems: 'center', marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  myResultWin: { borderColor: Colors.primary, backgroundColor: Colors.primaryMuted },
  myResultLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  myResultRank: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, marginVertical: Spacing.xs },
  myResultPrediction: { fontSize: FontSize.md, color: Colors.textSecondary },
  myResultPayout: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.primary, marginTop: Spacing.sm },
  leaderboardTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  lbRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.md },
  lbRowMe: { backgroundColor: Colors.primaryMuted, marginHorizontal: -Spacing.sm, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm },
  lbRank: { width: 30, fontSize: FontSize.md, fontWeight: '700', color: Colors.textSecondary },
  lbInfo: { flex: 1 },
  lbName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  lbPrediction: { fontSize: FontSize.xs, color: Colors.textMuted },
  lbRight: { alignItems: 'flex-end' },
  lbDistance: { fontSize: FontSize.sm, color: Colors.textSecondary },
  lbPayout: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  errorText: { textAlign: 'center', color: Colors.textSecondary, marginTop: 40, fontSize: FontSize.md },
}); }
