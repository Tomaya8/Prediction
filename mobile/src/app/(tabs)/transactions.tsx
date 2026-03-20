import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Colors } from '../../lib/colors';
import { apiClient } from '../../lib/api-client';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  referenceId?: string;
  createdAt: string;
}

type FilterType = 'ALL' | 'TRADE_BUY' | 'TRADE_SELL' | 'REWARDS';

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('ALL');

  const fetchTransactions = useCallback(async () => {
    try {
      const typeParam = filter === 'ALL' ? undefined
        : filter === 'REWARDS' ? undefined // fetch all, filter client-side
        : filter;
      const res = await apiClient.getTransactions(typeParam);
      if (res.success && res.data) {
        setTransactions(res.data as Transaction[]);
        setError(null);
      } else {
        setError(res.error ?? 'Failed to load transactions');
      }
    } catch {
      setError('Failed to load transactions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    fetchTransactions();
  }, [fetchTransactions]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
  };

  const filteredTransactions = filter === 'REWARDS'
    ? transactions.filter(t => ['DAILY_REWARD', 'ACHIEVEMENT_REWARD', 'REFERRAL_BONUS', 'STARTING_BONUS', 'WEEKLY_REWARD'].includes(t.type))
    : transactions;

  const formatTime = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'TRADE_BUY': return '📈';
      case 'TRADE_SELL': return '📉';
      case 'DAILY_REWARD': return '🎁';
      case 'WEEKLY_REWARD': return '📅';
      case 'ACHIEVEMENT_REWARD': return '🏅';
      case 'MARKET_RESOLVED': return '✅';
      case 'CREDIT_PURCHASE': return '💳';
      case 'STARTING_BONUS': return '🎉';
      case 'REFERRAL_BONUS': return '👥';
      case 'ADMIN_ADJUSTMENT': return '⚙️';
      default: return '💰';
    }
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'TRADE_BUY': return 'Buy';
      case 'TRADE_SELL': return 'Sell';
      case 'DAILY_REWARD': return 'Daily Reward';
      case 'WEEKLY_REWARD': return 'Weekly Reward';
      case 'ACHIEVEMENT_REWARD': return 'Achievement';
      case 'MARKET_RESOLVED': return 'Market Resolved';
      case 'CREDIT_PURCHASE': return 'Credit Purchase';
      case 'STARTING_BONUS': return 'Starting Bonus';
      case 'REFERRAL_BONUS': return 'Referral Bonus';
      case 'ADMIN_ADJUSTMENT': return 'Adjustment';
      default: return type.replace(/_/g, ' ');
    }
  };

  const getAmountColor = (amount: number): string => {
    if (amount > 0) return Colors.primary;
    if (amount < 0) return Colors.danger;
    return Colors.textPrimary;
  };

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
        <TouchableOpacity onPress={() => { setLoading(true); fetchTransactions(); }} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {([
          ['ALL', 'All'],
          ['TRADE_BUY', 'Buys'],
          ['TRADE_SELL', 'Sells'],
          ['REWARDS', 'Rewards'],
        ] as [FilterType, string][]).map(([value, label]) => (
          <TouchableOpacity
            key={value}
            style={[styles.filterButton, filter === value && styles.filterActive]}
            onPress={() => setFilter(value)}
          >
            <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transactions List */}
      <ScrollView
        style={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {filteredTransactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>No transactions found</Text>
          </View>
        ) : (
          filteredTransactions.map((transaction) => (
            <View key={transaction.id} style={styles.transactionCard}>
              <View style={styles.transactionLeft}>
                <Text style={styles.transactionIcon}>{getTypeIcon(transaction.type)}</Text>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionType}>{getTypeLabel(transaction.type)}</Text>
                  {transaction.description && (
                    <Text style={styles.transactionDesc} numberOfLines={1}>
                      {transaction.description}
                    </Text>
                  )}
                  <Text style={styles.transactionTime}>{formatTime(transaction.createdAt)}</Text>
                </View>
              </View>
              <View style={styles.transactionRight}>
                <Text style={[styles.transactionAmount, { color: getAmountColor(transaction.amount) }]}>
                  {transaction.amount > 0 ? '+' : ''}{transaction.amount.toLocaleString()}
                </Text>
                <Text style={styles.transactionCredits}>credits</Text>
              </View>
            </View>
          ))
        )}
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
  },
  filterActive: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  filterTextActive: {
    color: Colors.textPrimary,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  transactionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionType: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  transactionDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  transactionTime: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  transactionCredits: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
});
