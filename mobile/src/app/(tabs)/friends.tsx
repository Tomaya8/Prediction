// Friends, Challenges & Referral Screen
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  Share, RefreshControl, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../lib/colors';
import { apiClient, type Market } from '../../lib/api-client';
import { showToast } from '../../lib/components';

interface Friend {
  id: string;
  displayName: string;
  avatarUrl?: string;
  creditBalance: number;
  winRate: number;
}

interface Challenge {
  id: string;
  challenger: { id: string; displayName: string };
  challenged: { id: string; displayName: string };
  marketId: string;
  marketTitle?: string;
  challengerOutcomeId: string;
  challengedOutcomeId?: string;
  amount: number;
  escrowCredits: number;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'COMPLETED';
  winnerId?: string;
  createdAt: string;
}

interface ReferralInfo {
  referralCode: string;
  referralCount: number;
  creditsEarned: number;
}

// ─── Challenge Creation Modal ────────────────────────────────────────────────

function CreateChallengeModal({
  visible,
  friend,
  onClose,
  onCreated,
}: {
  visible: boolean;
  friend: Friend | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<'market' | 'details'>('market');
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [amount, setAmount] = useState('100');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep('market');
      setSelectedMarket(null);
      setSelectedOutcome(null);
      setAmount('100');
      setLoadingMarkets(true);
      apiClient.getMarkets().then(res => {
        if (res.success && res.data) setMarkets(res.data);
        setLoadingMarkets(false);
      });
    }
  }, [visible]);

  const handleCreate = async () => {
    if (!friend || !selectedMarket || !selectedOutcome) return;
    const amt = parseInt(amount) || 0;
    if (amt <= 0) {
      Alert.alert('Error', 'Enter a valid wager amount');
      return;
    }
    setCreating(true);
    const res = await apiClient.createChallenge({
      challengedId: friend.id,
      marketId: selectedMarket.id,
      challengerOutcomeId: selectedOutcome,
      amount: amt,
    });
    setCreating(false);
    if (res.success) {
      Alert.alert('Challenge Sent!', `${friend.displayName} has been challenged for ${amt} credits!`);
      onCreated();
      onClose();
    } else {
      Alert.alert('Error', res.error || 'Failed to create challenge');
    }
  };

  if (!friend) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          {/* Header */}
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>
              {step === 'market' ? 'Pick a Market' : 'Set Your Wager'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={modalStyles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={modalStyles.subtitle}>Challenge {friend.displayName}</Text>

          {step === 'market' ? (
            /* Step 1: Market selection */
            <ScrollView style={modalStyles.scroll}>
              {loadingMarkets ? (
                <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
              ) : markets.length === 0 ? (
                <Text style={modalStyles.emptyText}>No active markets available</Text>
              ) : (
                markets.map(m => (
                  <TouchableOpacity
                    key={m.id}
                    style={modalStyles.marketCard}
                    onPress={() => { setSelectedMarket(m); setSelectedOutcome(null); setStep('details'); }}
                  >
                    <Text style={modalStyles.marketCategory}>{m.category}</Text>
                    <Text style={modalStyles.marketTitle} numberOfLines={2}>{m.title}</Text>
                    <View style={modalStyles.outcomesRow}>
                      {m.outcomes.slice(0, 2).map(o => {
                        const pct = Math.round(((m.prices?.[o.id] ?? o.currentPrice) || 0) * 100);
                        return (
                          <Text key={o.id} style={modalStyles.outcomeChip}>
                            {o.name} {pct}¢
                          </Text>
                        );
                      })}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          ) : (
            /* Step 2: Outcome + amount */
            <ScrollView style={modalStyles.scroll}>
              {/* Selected market */}
              <View style={modalStyles.selectedMarketBanner}>
                <Text style={modalStyles.bannerLabel}>Market</Text>
                <Text style={modalStyles.bannerTitle} numberOfLines={2}>{selectedMarket?.title}</Text>
              </View>

              {/* Outcome picker */}
              <Text style={modalStyles.fieldLabel}>Your prediction</Text>
              <View style={modalStyles.outcomePicker}>
                {selectedMarket?.outcomes.map(o => {
                  const isSelected = selectedOutcome === o.id;
                  return (
                    <TouchableOpacity
                      key={o.id}
                      style={[
                        modalStyles.outcomeButton,
                        isSelected && { borderColor: o.color || Colors.primary, backgroundColor: Colors.surfaceHighlight },
                      ]}
                      onPress={() => setSelectedOutcome(o.id)}
                    >
                      <View style={[modalStyles.outcomeDot, { backgroundColor: o.color || Colors.textMuted }]} />
                      <Text style={modalStyles.outcomeLabel}>{o.name}</Text>
                      {isSelected && <Text style={modalStyles.checkmark}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Wager amount */}
              <Text style={modalStyles.fieldLabel}>Wager amount (credits)</Text>
              <TextInput
                style={modalStyles.amountInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="100"
                placeholderTextColor={Colors.textMuted}
              />
              <View style={modalStyles.quickAmounts}>
                {[50, 100, 250, 500].map(a => (
                  <TouchableOpacity
                    key={a}
                    style={[modalStyles.quickBtn, amount === String(a) && modalStyles.quickBtnActive]}
                    onPress={() => setAmount(String(a))}
                  >
                    <Text style={[modalStyles.quickBtnText, amount === String(a) && modalStyles.quickBtnTextActive]}>
                      {a}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Summary */}
              <View style={modalStyles.summary}>
                <View style={modalStyles.summaryRow}>
                  <Text style={modalStyles.summaryLabel}>Your wager</Text>
                  <Text style={modalStyles.summaryValue}>-{parseInt(amount) || 0} credits</Text>
                </View>
                <View style={modalStyles.summaryRow}>
                  <Text style={modalStyles.summaryLabel}>If you win</Text>
                  <Text style={[modalStyles.summaryValue, { color: Colors.primary }]}>
                    +{(parseInt(amount) || 0) * 2} credits
                  </Text>
                </View>
              </View>

              {/* Actions */}
              <View style={modalStyles.actions}>
                <TouchableOpacity style={modalStyles.backBtn} onPress={() => setStep('market')}>
                  <Text style={modalStyles.backBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[modalStyles.createBtn, (!selectedOutcome || creating) && modalStyles.createBtnDisabled]}
                  onPress={handleCreate}
                  disabled={!selectedOutcome || creating}
                >
                  {creating
                    ? <ActivityIndicator color={Colors.textPrimary} />
                    : <Text style={modalStyles.createBtnText}>Send Challenge</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function FriendsScreen() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'friends' | 'challenges' | 'referral'>('friends');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingOnId, setActingOnId] = useState<string | null>(null);

  // Challenge creation modal
  const [challengeTarget, setChallengeTarget] = useState<Friend | null>(null);
  const [showChallengeModal, setShowChallengeModal] = useState(false);

  // User search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [followLoadingId, setFollowLoadingId] = useState<string | null>(null);

  const fetchAll = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const [friendsRes, challengesRes, referralRes] = await Promise.all([
        apiClient.getFriends(),
        apiClient.getChallenges(),
        apiClient.getReferralInfo(),
      ]);
      if (friendsRes.success) setFriends(friendsRes.data || []);
      if (challengesRes.success) setChallenges(challengesRes.data || []);
      if (referralRes.success) setReferral(referralRes.data);
    } catch {
      // Silently degrade
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Search users
  useEffect(() => {
    if (searchQuery.trim().length < 2) { setSearchResults([]); return; }
    const timeout = setTimeout(async () => {
      setSearching(true);
      const res = await apiClient.searchUsers(searchQuery.trim());
      if (res.success && res.data) setSearchResults(res.data);
      setSearching(false);
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleFollowUser = async (userId: string, displayName: string, isFollowing: boolean) => {
    setFollowLoadingId(userId);
    const res = isFollowing
      ? await apiClient.unfollowUser(userId)
      : await apiClient.followUser(userId);
    if (res.success) {
      showToast({ message: isFollowing ? `Unfollowed ${displayName}` : `Now following ${displayName}!`, type: 'success' });
      setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, isFollowing: !isFollowing } : u));
      fetchAll(true);
    }
    setFollowLoadingId(null);
  };

  const handleShareReferral = async () => {
    const code = referral?.referralCode || '';
    try {
      await Share.share({
        message: `Join PredictSpinz and predict with me! Use my referral code: ${code} to get 500 free credits!\n\nDownload: https://predictspinz.app`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleAcceptChallenge = async (challenge: Challenge) => {
    if (actingOnId) return;

    // Fetch market to show outcomes visually
    const marketRes = await apiClient.getMarket(challenge.marketId);
    if (!marketRes.success || !marketRes.data) {
      Alert.alert('Error', 'Could not load market details');
      return;
    }
    const market = marketRes.data;
    // Find the outcome the challenger did NOT pick
    const availableOutcomes = market.outcomes.filter(
      (o: any) => o.id !== challenge.challengerOutcomeId
    );
    if (availableOutcomes.length === 0) {
      Alert.alert('Error', 'No outcomes available');
      return;
    }

    // For binary markets, auto-pick the opposite. For multi-outcome, let user choose.
    if (availableOutcomes.length === 1) {
      const outcomeId = availableOutcomes[0].id;
      const outcomeName = availableOutcomes[0].name;
      Alert.alert(
        'Accept Challenge',
        `You'll bet ${challenge.amount} credits on "${outcomeName}". Proceed?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Accept',
            onPress: async () => {
              setActingOnId(challenge.id);
              const res = await apiClient.acceptChallenge(challenge.id, outcomeId);
              if (res.success) { Alert.alert('Challenge Accepted!', 'Good luck!'); fetchAll(true); }
              else Alert.alert('Error', res.error || 'Failed to accept');
              setActingOnId(null);
            },
          },
        ]
      );
    } else {
      // Multi-outcome: show picker via Alert buttons
      const buttons = availableOutcomes.map((o: any) => ({
        text: o.name,
        onPress: async () => {
          setActingOnId(challenge.id);
          const res = await apiClient.acceptChallenge(challenge.id, o.id);
          if (res.success) { Alert.alert('Challenge Accepted!', 'Good luck!'); fetchAll(true); }
          else Alert.alert('Error', res.error || 'Failed to accept');
          setActingOnId(null);
        },
      }));
      buttons.push({ text: 'Cancel', onPress: async () => {} });
      Alert.alert('Pick Your Outcome', `Wager: ${challenge.amount} credits`, buttons as any);
    }
  };

  const handleDeclineChallenge = async (challengeId: string) => {
    if (actingOnId) return;
    setActingOnId(challengeId);
    try {
      const res = await apiClient.declineChallenge(challengeId);
      if (res.success) { Alert.alert('Declined', 'Challenge declined.'); fetchAll(true); }
      else Alert.alert('Error', res.error || 'Failed to decline');
    } finally {
      setActingOnId(null);
    }
  };

  const pending = challenges.filter(c => c.status === 'PENDING');
  const active = challenges.filter(c => c.status === 'ACCEPTED');
  const completed = challenges.filter(c => c.status === 'COMPLETED');

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabContainer}>
        {(['friends', 'challenges', 'referral'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'challenges'
                ? `Challenges${challenges.length > 0 ? ` (${challenges.length})` : ''}`
                : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} tintColor={Colors.primary} />}
      >
        {/* ——— FRIENDS TAB ——— */}
        {activeTab === 'friends' && (
          <View>
            {/* Search bar */}
            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search users by name..."
                placeholderTextColor={Colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Search results */}
            {searchQuery.length >= 2 && (
              <View style={{ marginBottom: Spacing.lg }}>
                <Text style={styles.sectionTitle}>Search Results</Text>
                {searching ? (
                  <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.lg }} />
                ) : searchResults.length === 0 ? (
                  <Text style={styles.noResultsText}>No users found</Text>
                ) : (
                  searchResults.map(user => (
                    <View key={user.id} style={styles.friendCard}>
                      <View style={styles.friendLeft}>
                        <View style={styles.avatarContainer}>
                          <Text style={styles.avatar}>
                            {(user.displayName || '?')[0].toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.friendInfo}>
                          <Text style={styles.friendName}>{user.displayName || 'Anonymous'}</Text>
                          <Text style={styles.friendStats}>
                            {user.creditBalance?.toLocaleString()} credits · {user.winRate}% win
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={[styles.followBtn, user.isFollowing && styles.followingBtn]}
                        onPress={() => handleFollowUser(user.id, user.displayName, user.isFollowing)}
                        disabled={followLoadingId === user.id}
                      >
                        {followLoadingId === user.id ? (
                          <ActivityIndicator size="small" color={Colors.primary} />
                        ) : (
                          <Text style={[styles.followBtnText, user.isFollowing && styles.followingBtnText]}>
                            {user.isFollowing ? 'Following' : 'Follow'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Friends list */}
            <Text style={styles.sectionTitle}>Your Friends ({friends.length})</Text>
            {friends.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={40} color={Colors.textMuted} style={{ marginBottom: Spacing.md }} />
                <Text style={styles.emptyTitle}>No Friends Yet</Text>
                <Text style={styles.emptyText}>Search for users above or follow traders from the Leaderboard!</Text>
              </View>
            ) : (
              friends.map(friend => (
                <View key={friend.id} style={styles.friendCard}>
                  <View style={styles.friendLeft}>
                    <View style={styles.avatarContainer}>
                      <Text style={styles.avatar}>
                        {friend.displayName?.[0]?.toUpperCase() || '?'}
                      </Text>
                    </View>
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName}>{friend.displayName}</Text>
                      <Text style={styles.friendStats}>
                        {friend.creditBalance.toLocaleString()} credits  {friend.winRate}% win
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.challengeButton}
                    onPress={() => {
                      setChallengeTarget(friend);
                      setShowChallengeModal(true);
                    }}
                  >
                    <Text style={styles.challengeButtonText}>Challenge</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {/* ——— CHALLENGES TAB ——— */}
        {activeTab === 'challenges' && (
          <View>
            {pending.length > 0 && (
              <View>
                <Text style={styles.sectionTitle}>Pending</Text>
                {pending.map(challenge => (
                  <View key={challenge.id} style={styles.challengeCard}>
                    <View style={styles.challengeHeader}>
                      <Text style={styles.challengeFriend}>
                        {challenge.challenger.displayName}
                      </Text>
                      <Text style={styles.challengeAmount}>{challenge.amount} credits</Text>
                    </View>
                    <View style={styles.predictionRow}>
                      <View style={styles.prediction}>
                        <Text style={styles.predictionLabel}>Their pick</Text>
                        <Text style={[styles.predictionValue, { color: Colors.yes }]}>
                          {challenge.challengerOutcomeId.length > 10
                            ? challenge.challengerOutcomeId.slice(0, 8) + '...'
                            : challenge.challengerOutcomeId}
                        </Text>
                      </View>
                      <Text style={styles.vsText}>VS</Text>
                      <View style={styles.prediction}>
                        <Text style={styles.predictionLabel}>Your pick</Text>
                        <Text style={[styles.predictionValue, { color: Colors.no }]}>TBD</Text>
                      </View>
                    </View>
                    <View style={styles.challengeActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.declineButton]}
                        onPress={() => handleDeclineChallenge(challenge.id)}
                        disabled={actingOnId === challenge.id}
                      >
                        <Text style={styles.declineButtonText}>Decline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.acceptButton]}
                        onPress={() => handleAcceptChallenge(challenge)}
                        disabled={actingOnId === challenge.id}
                      >
                        {actingOnId === challenge.id
                          ? <ActivityIndicator color={Colors.textPrimary} />
                          : <Text style={styles.acceptButtonText}>Accept</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {active.length > 0 && (
              <View>
                <Text style={styles.sectionTitle}>Active</Text>
                {active.map(challenge => (
                  <View key={challenge.id} style={[styles.challengeCard, styles.activeChallengeCard]}>
                    <View style={styles.challengeHeader}>
                      <Text style={styles.challengeFriend}>vs {challenge.challenger.displayName}</Text>
                      <Text style={styles.challengeAmount}>{challenge.amount} credits</Text>
                    </View>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>Awaiting market resolution</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {completed.length > 0 && (
              <View>
                <Text style={styles.sectionTitle}>Completed</Text>
                {completed.map(challenge => {
                  const won = challenge.winnerId === challenge.challenger.id;
                  return (
                    <View key={challenge.id} style={styles.challengeCard}>
                      <View style={styles.challengeHeader}>
                        <Text style={styles.challengeFriend}>
                          vs {challenge.challenger.displayName}
                        </Text>
                        <Text style={[
                          styles.challengeAmount,
                          { color: challenge.winnerId ? Colors.primary : Colors.textSecondary },
                        ]}>
                          {challenge.winnerId
                            ? `Winner: ${won ? challenge.challenger.displayName : challenge.challenged.displayName}`
                            : 'Draw'}
                        </Text>
                      </View>
                      <Text style={styles.completedPot}>
                        Pot: {challenge.amount * 2} credits
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {challenges.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🎯</Text>
                <Text style={styles.emptyTitle}>No Challenges Yet</Text>
                <Text style={styles.emptyText}>
                  Go to the Friends tab and challenge someone!
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ——— REFERRAL TAB ——— */}
        {activeTab === 'referral' && (
          <View>
            <View style={styles.referralCard}>
              <Text style={styles.referralTitle}>Invite Friends</Text>
              <Text style={styles.referralDescription}>
                Share your referral code and earn 200 credits for each friend who joins!
              </Text>
              <View style={styles.codeContainer}>
                <Text style={styles.codeLabel}>Your Referral Code</Text>
                <Text style={styles.code}>{referral?.referralCode || '—'}</Text>
              </View>
              <TouchableOpacity style={styles.shareButton} onPress={handleShareReferral}>
                <Text style={styles.shareButtonText}>Share Link</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.rewardsCard}>
              <Text style={styles.rewardsTitle}>Your Referral Rewards</Text>
              <View style={styles.rewardRow}>
                <Text style={styles.rewardLabel}>Friends Invited</Text>
                <Text style={styles.rewardValue}>{referral?.referralCount ?? 0}</Text>
              </View>
              <View style={styles.rewardRow}>
                <Text style={styles.rewardLabel}>Credits Earned</Text>
                <Text style={[styles.rewardValue, { color: Colors.yes }]}>
                  +{(referral?.creditsEarned ?? 0).toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Challenge Creation Modal */}
      <CreateChallengeModal
        visible={showChallengeModal}
        friend={challengeTarget}
        onClose={() => setShowChallengeModal(false)}
        onCreated={() => fetchAll(true)}
      />
    </View>
  );
}

// ─── Modal Styles ────────────────────────────────────────────────────────────

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  container: { backgroundColor: Colors.surface, borderTopLeftRadius: Spacing.xxl, borderTopRightRadius: Spacing.xxl, maxHeight: '85%', paddingBottom: Spacing.xxxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.xl, paddingBottom: Spacing.xs },
  title: { fontSize: Spacing.xl, fontWeight: '700', color: Colors.textPrimary },
  closeBtn: { fontSize: FontSize.xxl, color: Colors.textSecondary, padding: Spacing.xs },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
  scroll: { paddingHorizontal: Spacing.xl },
  emptyText: { color: Colors.textSecondary, textAlign: 'center', marginTop: 40 },

  marketCard: { backgroundColor: Colors.background, borderRadius: Radius.md, padding: 14, marginBottom: 10 },
  marketCategory: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600', marginBottom: Spacing.xs },
  marketTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginBottom: Spacing.sm },
  outcomesRow: { flexDirection: 'row', gap: Spacing.sm },
  outcomeChip: { fontSize: 12, color: Colors.textSecondary, backgroundColor: Colors.surface, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: 6 },

  selectedMarketBanner: { backgroundColor: Colors.background, borderRadius: Radius.md, padding: 14, marginBottom: Spacing.lg },
  bannerLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.xs },
  bannerTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },

  fieldLabel: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  outcomePicker: { gap: Spacing.sm, marginBottom: Spacing.lg },
  outcomeButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: Radius.md, padding: 14, borderWidth: 2, borderColor: 'transparent', gap: 10 },
  outcomeDot: { width: Spacing.md, height: Spacing.md, borderRadius: 6 },
  outcomeLabel: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  checkmark: { fontSize: FontSize.xl, color: Colors.primary, fontWeight: '700' },

  amountInput: { backgroundColor: Colors.background, borderRadius: Radius.md, padding: Spacing.lg, fontSize: Spacing.xl, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  quickAmounts: { flexDirection: 'row', gap: Spacing.sm, marginTop: 10, marginBottom: Spacing.lg },
  quickBtn: { flex: 1, backgroundColor: Colors.background, borderRadius: Radius.sm, paddingVertical: 10, alignItems: 'center' },
  quickBtnActive: { backgroundColor: Colors.primary },
  quickBtnText: { color: Colors.textSecondary, fontWeight: '600' },
  quickBtnTextActive: { color: Colors.textPrimary },

  summary: { backgroundColor: Colors.background, borderRadius: Radius.md, padding: 14, marginBottom: Spacing.lg },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { color: Colors.textSecondary, fontSize: FontSize.md },
  summaryValue: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '600' },

  actions: { flexDirection: 'row', gap: 10 },
  backBtn: { flex: 1, paddingVertical: 14, borderRadius: Radius.md, alignItems: 'center', backgroundColor: Colors.background },
  backBtnText: { color: Colors.textSecondary, fontWeight: '600', fontSize: FontSize.lg },
  createBtn: { flex: 2, paddingVertical: 14, borderRadius: Radius.md, alignItems: 'center', backgroundColor: Colors.primary },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { color: Colors.textPrimary, fontWeight: '700', fontSize: FontSize.lg },
});

// ─── Main Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  tabContainer: { flexDirection: 'row', padding: Spacing.lg, gap: Spacing.sm },
  tab: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', borderRadius: Radius.md, backgroundColor: Colors.surface },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.textPrimary },
  content: { flex: 1, paddingHorizontal: Spacing.lg },
  sectionTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: Spacing.md, marginTop: Spacing.sm },

  // Search
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginBottom: Spacing.md, gap: Spacing.sm },
  searchInput: { flex: 1, fontSize: FontSize.lg, color: Colors.textPrimary, paddingVertical: Spacing.xs },
  noResultsText: { color: Colors.textSecondary, fontSize: FontSize.md, textAlign: 'center', paddingVertical: Spacing.lg },
  followBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, backgroundColor: Colors.primary, minWidth: 80, alignItems: 'center' },
  followingBtn: { backgroundColor: Colors.surfaceHighlight },
  followBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  followingBtnText: { color: Colors.textSecondary },

  // Friends
  friendCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: Radius.md, marginBottom: Spacing.sm },
  friendLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarContainer: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  avatar: { fontSize: FontSize.xl, color: Colors.textPrimary, fontWeight: 'bold' },
  friendInfo: { flex: 1 },
  friendName: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textPrimary },
  friendStats: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  challengeButton: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.sm },
  challengeButtonText: { color: Colors.textPrimary, fontWeight: '600', fontSize: FontSize.md },

  // Challenges
  challengeCard: { backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: Radius.md, marginBottom: Spacing.md },
  activeChallengeCard: { borderWidth: 1, borderColor: Colors.primary },
  challengeHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  challengeFriend: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textPrimary },
  challengeAmount: { fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.warning },
  predictionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: Spacing.md },
  prediction: { alignItems: 'center' },
  predictionLabel: { fontSize: 12, color: Colors.textMuted },
  predictionValue: { fontSize: FontSize.xl, fontWeight: 'bold', marginTop: Spacing.xs },
  vsText: { fontSize: FontSize.md, color: Colors.textMuted },
  challengeActions: { flexDirection: 'row', gap: Spacing.sm },
  actionButton: { flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.sm, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  declineButton: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.danger },
  declineButtonText: { color: Colors.danger, fontWeight: '600' },
  acceptButton: { backgroundColor: Colors.primary },
  acceptButtonText: { color: Colors.textPrimary, fontWeight: '600' },
  statusBadge: { backgroundColor: Colors.background, padding: Spacing.sm, borderRadius: Radius.sm, alignItems: 'center' },
  statusText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  completedPot: { fontSize: FontSize.sm, color: Colors.textSecondary },

  // Empty
  emptyState: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: Spacing.sm },
  emptyText: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },

  // Referral
  referralCard: { backgroundColor: Colors.surface, padding: Spacing.xl, borderRadius: Radius.lg, marginBottom: Spacing.lg },
  referralTitle: { fontSize: FontSize.xxl, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: Spacing.sm, textAlign: 'center' },
  referralDescription: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl },
  codeContainer: { backgroundColor: Colors.background, padding: Spacing.lg, borderRadius: Radius.md, alignItems: 'center', marginBottom: Spacing.lg },
  codeLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: Spacing.xs },
  code: { fontSize: 28, fontWeight: 'bold', color: Colors.primary, letterSpacing: 2 },
  shareButton: { backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  shareButtonText: { color: Colors.textPrimary, fontWeight: '600', fontSize: FontSize.lg },
  rewardsCard: { backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: Radius.md },
  rewardsTitle: { fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: Spacing.lg },
  rewardRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rewardLabel: { fontSize: FontSize.md, color: Colors.textSecondary },
  rewardValue: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
});
