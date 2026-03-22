// Propose Market Screen — submit proposals + browse & upvote community proposals

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../lib/colors';
import { apiClient } from '../../lib/api-client';

const CATEGORIES = [
  { id: 'POLITICS', label: 'Politics', emoji: '🏛️' },
  { id: 'SPORTS', label: 'Sports', emoji: '⚽' },
  { id: 'CRYPTO', label: 'Crypto', emoji: '₿' },
  { id: 'ENTERTAINMENT', label: 'Entertainment', emoji: '🎬' },
  { id: 'SCIENCE', label: 'Science', emoji: '🔬' },
  { id: 'TECHNOLOGY', label: 'Technology', emoji: '💻' },
  { id: 'BUSINESS', label: 'Business', emoji: '📊' },
];

interface Proposal {
  id: string;
  title: string;
  description?: string;
  category: string;
  outcomes: string[];
  suggestedExpiry: string;
  upvotes: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  hasVoted: boolean;
  adminNotes?: string;
  createdBy: { id: string; displayName: string; avatarUrl?: string };
  createdAt: string;
}

export default function CreateMarketScreen() {
  const [activeTab, setActiveTab] = useState<'propose' | 'browse' | 'mine'>('browse');

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabRow}>
        {([
          ['browse', 'Community'],
          ['propose', 'Propose'],
          ['mine', 'My Proposals'],
        ] as const).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, activeTab === key && styles.tabActive]}
            onPress={() => setActiveTab(key)}
          >
            <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'propose' && <ProposeForm onSuccess={() => setActiveTab('mine')} />}
      {activeTab === 'browse' && <BrowseProposals />}
      {activeTab === 'mine' && <MyProposals />}
    </View>
  );
}

// ─── Propose Form ────────────────────────────────────────────────────────────

function ProposeForm({ onSuccess }: { onSuccess: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('POLITICS');
  const [expiresAt, setExpiresAt] = useState('');
  const [resolutionCriteria, setResolutionCriteria] = useState('');
  const [customOutcomes, setCustomOutcomes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) { Alert.alert('Error', 'Please enter a question'); return; }
    if (!expiresAt.trim()) { Alert.alert('Error', 'Please enter a resolution date'); return; }

    const outcomes = customOutcomes.trim()
      ? customOutcomes.split(',').map(s => s.trim()).filter(Boolean)
      : ['Yes', 'No'];

    if (outcomes.length < 2) {
      Alert.alert('Error', 'Need at least 2 outcomes (comma-separated)');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.submitProposal({
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        outcomes,
        suggestedExpiry: new Date(expiresAt).toISOString(),
        resolutionCriteria: resolutionCriteria.trim() || undefined,
      });

      setIsSubmitting(false);
      if (res.success) {
        Alert.alert(
          'Proposal Submitted!',
          'Your market idea is now visible to the community. If it gets enough votes and admin approval, it becomes a live market and you earn 50 credits!',
          [{ text: 'OK', onPress: () => {
            setTitle(''); setDescription(''); setCategory('POLITICS');
            setExpiresAt(''); setResolutionCriteria(''); setCustomOutcomes('');
            onSuccess();
          }}],
        );
      } else {
        Alert.alert('Error', res.error || 'Failed to submit proposal');
      }
    } catch {
      setIsSubmitting(false);
      Alert.alert('Error', 'Network error. Please try again.');
    }
  };

  return (
    <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.formHeader}>
        <Text style={styles.formHeaderTitle}>Propose a Market</Text>
        <Text style={styles.formHeaderSub}>
          Submit your prediction idea. The community votes, admins approve, and you earn 50 credits!
        </Text>
      </View>

      {/* Category */}
      <Text style={styles.label}>Category</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.categoryButton, category === cat.id && styles.categoryButtonActive]}
            onPress={() => setCategory(cat.id)}
          >
            <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
            <Text style={[styles.categoryLabel, category === cat.id && styles.categoryLabelActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Title */}
      <Text style={styles.label}>Question</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Will Bitcoin reach $200k by 2027?"
        placeholderTextColor={Colors.textMuted}
        value={title}
        onChangeText={setTitle}
        multiline
      />

      {/* Description */}
      <Text style={styles.label}>Description (optional)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="More context about what counts as Yes/No..."
        placeholderTextColor={Colors.textMuted}
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
      />

      {/* Resolution Criteria */}
      <Text style={styles.label}>Resolution Criteria (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Based on CoinGecko price data"
        placeholderTextColor={Colors.textMuted}
        value={resolutionCriteria}
        onChangeText={setResolutionCriteria}
      />

      {/* Custom Outcomes */}
      <Text style={styles.label}>Outcomes (optional, defaults to Yes/No)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Trump, DeSantis, Haley, Other"
        placeholderTextColor={Colors.textMuted}
        value={customOutcomes}
        onChangeText={setCustomOutcomes}
      />
      <Text style={styles.hint}>Comma-separated. Leave blank for Yes/No.</Text>

      {/* Expiry */}
      <Text style={styles.label}>Resolution Date</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. December 31, 2026"
        placeholderTextColor={Colors.textMuted}
        value={expiresAt}
        onChangeText={setExpiresAt}
      />

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.submitButtonText}>Submit Proposal</Text>}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Browse Community Proposals ──────────────────────────────────────────────

function BrowseProposals() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<'upvotes' | 'newest'>('upvotes');
  const [votingId, setVotingId] = useState<string | null>(null);

  const fetch = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    const res = await apiClient.getProposals('PENDING', sort);
    if (res.success && res.data) setProposals(res.data as Proposal[]);
    setLoading(false);
    setRefreshing(false);
  }, [sort]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleVote = async (id: string) => {
    setVotingId(id);
    const res = await apiClient.voteProposal(id);
    if (res.success) {
      setProposals(prev => prev.map(p =>
        p.id === id ? { ...p, upvotes: p.upvotes + 1, hasVoted: true } : p
      ));
    } else {
      Alert.alert('Error', res.error || 'Failed to vote');
    }
    setVotingId(null);
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Sort toggle */}
      <View style={styles.sortRow}>
        <TouchableOpacity
          style={[styles.sortBtn, sort === 'upvotes' && styles.sortBtnActive]}
          onPress={() => setSort('upvotes')}
        >
          <Text style={[styles.sortBtnText, sort === 'upvotes' && styles.sortBtnTextActive]}>Top Voted</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortBtn, sort === 'newest' && styles.sortBtnActive]}
          onPress={() => setSort('newest')}
        >
          <Text style={[styles.sortBtnText, sort === 'newest' && styles.sortBtnTextActive]}>Newest</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.listScroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetch(true)} tintColor={Colors.primary} />}
      >
        {proposals.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💡</Text>
            <Text style={styles.emptyTitle}>No proposals yet</Text>
            <Text style={styles.emptyText}>Be the first to propose a market!</Text>
          </View>
        ) : (
          proposals.map(p => (
            <View key={p.id} style={styles.proposalCard}>
              <View style={styles.proposalHeader}>
                <View style={styles.proposalCategoryBadge}>
                  <Text style={styles.proposalCategoryText}>{p.category}</Text>
                </View>
                <Text style={styles.proposalOutcomes}>
                  {p.outcomes.join(' / ')}
                </Text>
              </View>

              <Text style={styles.proposalTitle}>{p.title}</Text>
              {p.description ? (
                <Text style={styles.proposalDesc} numberOfLines={2}>{p.description}</Text>
              ) : null}

              <View style={styles.proposalFooter}>
                <Text style={styles.proposalAuthor}>
                  by {p.createdBy.displayName || 'Anonymous'}
                </Text>

                <TouchableOpacity
                  style={[styles.voteButton, p.hasVoted && styles.voteButtonVoted]}
                  onPress={() => !p.hasVoted && handleVote(p.id)}
                  disabled={p.hasVoted || votingId === p.id}
                >
                  {votingId === p.id ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <>
                      <Ionicons
                        name={p.hasVoted ? 'arrow-up' : 'arrow-up-outline'}
                        size={18}
                        color={p.hasVoted ? Colors.primary : Colors.textSecondary}
                      />
                      <Text style={[styles.voteCount, p.hasVoted && styles.voteCountVoted]}>
                        {p.upvotes}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── My Proposals ────────────────────────────────────────────────────────────

function MyProposals() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.getMyProposals().then(res => {
      if (res.success && res.data) setProposals(res.data as Proposal[]);
      setLoading(false);
    });
  }, []);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'APPROVED': return { bg: Colors.primary + '20', color: Colors.primary, label: 'Approved (+50 credits!)' };
      case 'REJECTED': return { bg: Colors.danger + '20', color: Colors.danger, label: 'Rejected' };
      default: return { bg: '#F59E0B20', color: '#F59E0B', label: 'Pending Review' };
    }
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <ScrollView style={styles.listScroll}>
      {proposals.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📝</Text>
          <Text style={styles.emptyTitle}>No proposals yet</Text>
          <Text style={styles.emptyText}>Switch to the Propose tab to submit your first idea!</Text>
        </View>
      ) : (
        proposals.map(p => {
          const st = getStatusStyle(p.status);
          return (
            <View key={p.id} style={styles.proposalCard}>
              <View style={styles.proposalHeader}>
                <View style={styles.proposalCategoryBadge}>
                  <Text style={styles.proposalCategoryText}>{p.category}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                  <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                </View>
              </View>
              <Text style={styles.proposalTitle}>{p.title}</Text>
              <Text style={styles.proposalMeta}>
                {p.upvotes} votes · {p.outcomes.join(' / ')}
              </Text>
              {p.adminNotes && p.status === 'REJECTED' ? (
                <View style={styles.adminNotesBox}>
                  <Text style={styles.adminNotesLabel}>Admin feedback:</Text>
                  <Text style={styles.adminNotesText}>{p.adminNotes}</Text>
                </View>
              ) : null}
            </View>
          );
        })
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  // Tabs
  tabRow: { flexDirection: 'row', padding: 16, gap: 8 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: Colors.surface },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: '#fff' },

  // Form
  formScroll: { flex: 1, paddingHorizontal: 16 },
  formHeader: { alignItems: 'center', marginBottom: 20, paddingTop: 8 },
  formHeaderTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  formHeaderSub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 16 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, fontSize: 16, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  textArea: { height: 90, textAlignVertical: 'top' },
  hint: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  categoryButtonActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryEmoji: { fontSize: 16, marginRight: 6 },
  categoryLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  categoryLabelActive: { color: '#fff' },
  submitButton: { backgroundColor: Colors.primary, borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 24, minHeight: 56, justifyContent: 'center' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { fontSize: 18, fontWeight: 'bold', color: '#fff' },

  // Sort
  sortRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  sortBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surface },
  sortBtnActive: { backgroundColor: Colors.primary },
  sortBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  sortBtnTextActive: { color: '#fff' },

  // List
  listScroll: { flex: 1, paddingHorizontal: 16 },

  // Proposal card
  proposalCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 10 },
  proposalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  proposalCategoryBadge: { backgroundColor: Colors.background, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  proposalCategoryText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  proposalOutcomes: { fontSize: 11, color: Colors.textMuted },
  proposalTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
  proposalDesc: { fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },
  proposalFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  proposalAuthor: { fontSize: 12, color: Colors.textMuted },
  proposalMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },

  // Vote button
  voteButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4 },
  voteButtonVoted: { backgroundColor: Colors.primary + '20' },
  voteCount: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  voteCountVoted: { color: Colors.primary },

  // Status
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Admin notes
  adminNotesBox: { backgroundColor: Colors.background, borderRadius: 8, padding: 10, marginTop: 8 },
  adminNotesLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, marginBottom: 2 },
  adminNotesText: { fontSize: 13, color: Colors.textSecondary },

  // Empty
  emptyState: { alignItems: 'center', padding: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 8 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
});
