import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../lib/colors';
import { apiClient } from '../../lib/api-client';
import { getStoredUser } from '../../lib/auth';

interface Tournament {
  id: string;
  name: string;
  description: string;
  entryFee: number;
  prizePool: number;
  participants: number;
  maxParticipants: number;
  startsAt: string;
  endsAt: string;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  type: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  prizes?: { first: number; second: number; third: number };
}

interface LeaderboardEntry {
  id: string;
  userId: string;
  pnl: number;
  user: { id: string; displayName: string; avatarUrl?: string };
}

// ─── Tournament Detail Modal ─────────────────────────────────────────────────

function TournamentDetailModal({
  tournament,
  visible,
  onClose,
}: {
  tournament: Tournament | null;
  visible: boolean;
  onClose: () => void;
}) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    if (visible && tournament) {
      setLoading(true);
      Promise.all([
        apiClient.getTournamentLeaderboard(tournament.id),
        getStoredUser(),
      ]).then(([res, user]) => {
        if (res.success && res.data) setLeaderboard(res.data as LeaderboardEntry[]);
        if (user) setMyUserId(user.id);
        setLoading(false);
      });
    }
  }, [visible, tournament]);

  if (!tournament) return null;

  const myEntry = leaderboard.find(e => e.userId === myUserId);
  const myRank = myEntry ? leaderboard.indexOf(myEntry) + 1 : null;

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return { icon: 'trophy', color: '#FFD700' };
    if (rank === 2) return { icon: 'medal-outline', color: '#C0C0C0' };
    if (rank === 3) return { icon: 'ribbon-outline', color: '#CD7F32' };
    return null;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={detailStyles.overlay}>
        <View style={detailStyles.container}>
          {/* Header */}
          <View style={detailStyles.header}>
            <View style={{ flex: 1 }}>
              <Text style={detailStyles.title}>{tournament.name}</Text>
              <Text style={detailStyles.subtitle}>
                {tournament.type} · {tournament.status}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={detailStyles.closeBtn}>
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* My Rank Banner */}
          {myRank != null && (
            <View style={detailStyles.myRankBanner}>
              <Text style={detailStyles.myRankLabel}>Your Position</Text>
              <View style={detailStyles.myRankRight}>
                <Text style={detailStyles.myRankValue}>#{myRank}</Text>
                <Text style={[
                  detailStyles.myPnl,
                  { color: (myEntry?.pnl ?? 0) >= 0 ? Colors.primary : Colors.danger },
                ]}>
                  {(myEntry?.pnl ?? 0) >= 0 ? '+' : ''}{Math.round(myEntry?.pnl ?? 0)} P&L
                </Text>
              </View>
            </View>
          )}

          {/* Stats */}
          <View style={detailStyles.statsRow}>
            <View style={detailStyles.statBox}>
              <Text style={detailStyles.statValue}>{tournament.participants}</Text>
              <Text style={detailStyles.statLabel}>Players</Text>
            </View>
            <View style={detailStyles.statBox}>
              <Text style={detailStyles.statValue}>{tournament.prizePool.toLocaleString()}</Text>
              <Text style={detailStyles.statLabel}>Prize Pool</Text>
            </View>
            <View style={detailStyles.statBox}>
              <Text style={detailStyles.statValue}>{tournament.entryFee}</Text>
              <Text style={detailStyles.statLabel}>Entry Fee</Text>
            </View>
          </View>

          {/* Prizes */}
          {tournament.prizes && (
            <View style={detailStyles.prizesRow}>
              {[
                { rank: '1st', amount: tournament.prizes.first, emoji: '🥇' },
                { rank: '2nd', amount: tournament.prizes.second, emoji: '🥈' },
                { rank: '3rd', amount: tournament.prizes.third, emoji: '🥉' },
              ].map(p => (
                <View key={p.rank} style={detailStyles.prizeChip}>
                  <Text style={detailStyles.prizeEmoji}>{p.emoji}</Text>
                  <Text style={detailStyles.prizeAmount}>{p.amount.toLocaleString()}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Leaderboard */}
          <Text style={detailStyles.leaderboardTitle}>Leaderboard</Text>
          {loading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
          ) : leaderboard.length === 0 ? (
            <Text style={detailStyles.emptyText}>No participants yet</Text>
          ) : (
            <ScrollView style={detailStyles.leaderboardList}>
              {leaderboard.map((entry, index) => {
                const rank = index + 1;
                const display = getRankDisplay(rank);
                const isMe = entry.userId === myUserId;
                return (
                  <View key={entry.id} style={[detailStyles.lbRow, isMe && detailStyles.lbRowMe]}>
                    <View style={detailStyles.lbRankCol}>
                      {display ? (
                        <Ionicons name={display.icon as any} size={20} color={display.color} />
                      ) : (
                        <Text style={detailStyles.lbRankText}>{rank}</Text>
                      )}
                    </View>
                    <View style={detailStyles.lbAvatar}>
                      <Text style={detailStyles.lbAvatarText}>
                        {(entry.user.displayName || 'A')[0].toUpperCase()}
                      </Text>
                    </View>
                    <Text style={detailStyles.lbName} numberOfLines={1}>
                      {entry.user.displayName || 'Anonymous'}{isMe ? ' (You)' : ''}
                    </Text>
                    <Text style={[
                      detailStyles.lbPnl,
                      { color: entry.pnl >= 0 ? Colors.primary : Colors.danger },
                    ]}>
                      {entry.pnl >= 0 ? '+' : ''}{Math.round(entry.pnl)}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function TournamentsScreen() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());

  const fetchTournaments = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      const [tournamentsRes, user] = await Promise.all([
        apiClient.getTournaments(),
        getStoredUser(),
      ]);
      if (tournamentsRes.success && tournamentsRes.data) {
        setTournaments(tournamentsRes.data);
      } else {
        setError(tournamentsRes.error || 'Failed to load tournaments');
      }
      if (user) {
        setMyUserId(user.id);
        // Check which tournaments the user has joined
        // We'll infer from leaderboard or a simple check
        // For now, we track locally after joining
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchTournaments(); }, [fetchTournaments]);

  const handleJoin = async (tournament: Tournament) => {
    if (joiningId) return;
    setJoiningId(tournament.id);
    try {
      const res = await apiClient.joinTournament(tournament.id);
      if (res.success) {
        Alert.alert('Joined!', `You've joined ${tournament.name}. Good luck!`);
        setJoinedIds(prev => new Set(prev).add(tournament.id));
        fetchTournaments(true);
      } else {
        Alert.alert('Error', res.error || 'Failed to join tournament');
      }
    } catch {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setJoiningId(null);
    }
  };

  const getTimeRemaining = (dateString: string) => {
    const diff = new Date(dateString).getTime() - Date.now();
    if (diff <= 0) return 'Started';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return Colors.primary;
      case 'UPCOMING': return '#F59E0B';
      default: return Colors.textSecondary;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'DAILY': return '⚡';
      case 'WEEKLY': return '📅';
      case 'MONTHLY': return '🗓️';
      default: return '🏆';
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const myTournaments = tournaments.filter(t =>
    (t.status === 'ACTIVE' || t.status === 'UPCOMING') && joinedIds.has(t.id)
  );
  const active = tournaments.filter(t => t.status === 'ACTIVE');
  const upcoming = tournaments.filter(t => t.status === 'UPCOMING');
  const completed = tournaments.filter(t => t.status === 'COMPLETED').slice(0, 5);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchTournaments(true)} tintColor={Colors.primary} />}
      >
        {error ? (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => fetchTournaments()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : tournaments.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏆</Text>
            <Text style={styles.emptyTitle}>No Tournaments Yet</Text>
            <Text style={styles.emptyText}>Check back soon for upcoming tournaments!</Text>
          </View>
        ) : (
          <>
            {/* My Tournaments */}
            {myTournaments.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🎮 My Tournaments</Text>
                {myTournaments.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.myTournamentCard]}
                    onPress={() => setSelectedTournament(t)}
                  >
                    <View style={styles.myTournamentLeft}>
                      <Text style={styles.myTournamentName} numberOfLines={1}>{t.name}</Text>
                      <Text style={styles.myTournamentMeta}>
                        {t.participants} players · {getTimeRemaining(t.endsAt)} left
                      </Text>
                    </View>
                    <View style={styles.myTournamentRight}>
                      <Text style={styles.viewLeaderboardText}>Leaderboard</Text>
                      <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Active */}
            {active.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🔥 Active Now</Text>
                {active.map(t => renderTournamentCard(t, {
                  joiningId, handleJoin, getTimeRemaining, getStatusColor,
                  getTypeIcon, joinedIds, onViewDetail: setSelectedTournament,
                }))}
              </View>
            )}

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📅 Coming Soon</Text>
                {upcoming.map(t => renderTournamentCard(t, {
                  joiningId, handleJoin, getTimeRemaining, getStatusColor,
                  getTypeIcon, joinedIds, onViewDetail: setSelectedTournament,
                }))}
              </View>
            )}

            {/* Recently Completed */}
            {completed.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>✅ Recently Completed</Text>
                {completed.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.completedCard}
                    onPress={() => setSelectedTournament(t)}
                  >
                    <View>
                      <Text style={styles.completedName}>{t.name}</Text>
                      <Text style={styles.completedMeta}>
                        {t.participants} players · {t.prizePool.toLocaleString()} prize pool
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        {/* Rules */}
        <View style={styles.rulesCard}>
          <Text style={styles.rulesTitle}>How Tournaments Work</Text>
          {[
            'Pay entry fee to join a tournament',
            'Trade on any active market during the tournament',
            'Your P&L during the tournament determines your rank',
            'Top 3 players win prizes from the prize pool!',
          ].map((rule, i) => (
            <View key={i} style={styles.ruleItem}>
              <Text style={styles.ruleNumber}>{i + 1}</Text>
              <Text style={styles.ruleText}>{rule}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <TournamentDetailModal
        tournament={selectedTournament}
        visible={!!selectedTournament}
        onClose={() => setSelectedTournament(null)}
      />
    </View>
  );
}

// ─── Tournament Card Renderer ────────────────────────────────────────────────

function renderTournamentCard(
  tournament: Tournament,
  ctx: {
    joiningId: string | null;
    handleJoin: (t: Tournament) => void;
    getTimeRemaining: (d: string) => string;
    getStatusColor: (s: string) => string;
    getTypeIcon: (t: string) => string;
    joinedIds: Set<string>;
    onViewDetail: (t: Tournament) => void;
  },
) {
  const isJoining = ctx.joiningId === tournament.id;
  const isEnded = tournament.status === 'COMPLETED' || tournament.status === 'CANCELLED';
  const alreadyJoined = ctx.joinedIds.has(tournament.id);

  return (
    <TouchableOpacity
      key={tournament.id}
      style={styles.tournamentCard}
      onPress={() => ctx.onViewDetail(tournament)}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <View style={styles.typeBadge}>
          <Text style={styles.typeIcon}>{ctx.getTypeIcon(tournament.type)}</Text>
          <Text style={styles.typeText}>{tournament.type}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: ctx.getStatusColor(tournament.status) + '20' }]}>
          <Text style={[styles.statusText, { color: ctx.getStatusColor(tournament.status) }]}>
            {tournament.status}
          </Text>
        </View>
      </View>

      <Text style={styles.tournamentName}>{tournament.name}</Text>
      {tournament.description ? (
        <Text style={styles.tournamentDescription} numberOfLines={2}>{tournament.description}</Text>
      ) : null}

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{tournament.participants}/{tournament.maxParticipants}</Text>
          <Text style={styles.statLabel}>Players</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{tournament.prizePool.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Prize Pool</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {tournament.status === 'ACTIVE' ? ctx.getTimeRemaining(tournament.endsAt) : ctx.getTimeRemaining(tournament.startsAt)}
          </Text>
          <Text style={styles.statLabel}>{tournament.status === 'ACTIVE' ? 'Left' : 'Starts'}</Text>
        </View>
      </View>

      {tournament.prizes && (
        <View style={styles.prizesInline}>
          <Text style={styles.prizeInlineItem}>🥇 {tournament.prizes.first.toLocaleString()}</Text>
          <Text style={styles.prizeInlineItem}>🥈 {tournament.prizes.second.toLocaleString()}</Text>
          <Text style={styles.prizeInlineItem}>🥉 {tournament.prizes.third.toLocaleString()}</Text>
        </View>
      )}

      {!isEnded && (
        <TouchableOpacity
          style={[styles.joinButton, alreadyJoined && styles.joinedButton]}
          disabled={isJoining || alreadyJoined}
          onPress={(e) => { e.stopPropagation?.(); ctx.handleJoin(tournament); }}
        >
          {isJoining ? (
            <ActivityIndicator color="#fff" />
          ) : alreadyJoined ? (
            <Text style={styles.joinButtonText}>Joined ✓</Text>
          ) : (
            <>
              <Text style={styles.joinButtonText}>
                {tournament.status === 'ACTIVE' ? 'Join Now' : 'Register'}
              </Text>
              {tournament.entryFee > 0 && (
                <Text style={styles.joinButtonFee}>{tournament.entryFee} credits</Text>
              )}
            </>
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// ─── Detail Modal Styles ─────────────────────────────────────────────────────

const detailStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  container: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  closeBtn: { padding: 4 },
  myRankBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, backgroundColor: Colors.background, borderRadius: 12, padding: 14, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: Colors.primary },
  myRankLabel: { color: Colors.textSecondary, fontSize: 14 },
  myRankRight: { alignItems: 'flex-end' },
  myRankValue: { color: Colors.primary, fontSize: 22, fontWeight: '700' },
  myPnl: { fontSize: 13, fontWeight: '600' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 20, paddingVertical: 12 },
  statBox: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  prizesRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, paddingHorizontal: 20, marginBottom: 12 },
  prizeChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 6 },
  prizeEmoji: { fontSize: 16 },
  prizeAmount: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  leaderboardTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, paddingHorizontal: 20, marginTop: 8, marginBottom: 8 },
  emptyText: { color: Colors.textSecondary, textAlign: 'center', marginTop: 20, fontSize: 14 },
  leaderboardList: { paddingHorizontal: 20, maxHeight: 300 },
  lbRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  lbRowMe: { backgroundColor: Colors.primary + '15', marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 8 },
  lbRankCol: { width: 28, alignItems: 'center' },
  lbRankText: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  lbAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surfaceHighlight, alignItems: 'center', justifyContent: 'center' },
  lbAvatarText: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  lbName: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  lbPnl: { fontSize: 14, fontWeight: '700' },
});

// ─── Main Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, paddingHorizontal: 16 },
  section: { marginBottom: 8, marginTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 12 },

  // My Tournaments
  myTournamentCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: Colors.primary },
  myTournamentLeft: { flex: 1 },
  myTournamentName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  myTournamentMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  myTournamentRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewLeaderboardText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },

  // Tournament Card
  tournamentCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeIcon: { fontSize: 14, marginRight: 4 },
  typeText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  tournamentName: { fontSize: 18, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 4 },
  tournamentDescription: { fontSize: 13, color: Colors.textSecondary, marginBottom: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  prizesInline: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 12 },
  prizeInlineItem: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  joinButton: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', minHeight: 50, gap: 8 },
  joinedButton: { backgroundColor: Colors.surfaceHighlight },
  joinButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  joinButtonFee: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },

  // Completed
  completedCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 8 },
  completedName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  completedMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  // Rules
  rulesCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 24, marginTop: 8 },
  rulesTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 16 },
  ruleItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  ruleNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary, color: '#fff', textAlign: 'center', lineHeight: 24, fontSize: 12, fontWeight: 'bold', marginRight: 12, overflow: 'hidden' },
  ruleText: { flex: 1, fontSize: 14, color: Colors.textSecondary },

  // States
  errorState: { alignItems: 'center', padding: 40 },
  errorText: { color: Colors.danger, fontSize: 14, marginBottom: 16, textAlign: 'center' },
  retryButton: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '600' },
  emptyState: { alignItems: 'center', padding: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 8 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
});
