/**
 * MarketCard Component
 * Displays a prediction market in a card format
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface Outcome {
  id: string;
  name: string;
  color: string;
  currentPrice: number;
}

interface Market {
  id: string;
  title: string;
  description?: string;
  category: string;
  expiresAt: string;
  totalVolume: number;
  outcomes: Outcome[];
}

interface MarketCardProps {
  market: Market;
  onPress?: () => void;
}

export const MarketCard: React.FC<MarketCardProps> = ({ market, onPress }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toString();
  };

  const getTimeRemaining = () => {
    const now = new Date();
    const expiry = new Date(market.expiresAt);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{market.category}</Text>
        </View>
        <View style={styles.expiryContainer}>
          <Text style={styles.expiryText}>{getTimeRemaining()}</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>
        {market.title}
      </Text>

      {/* Description */}
      {market.description && (
        <Text style={styles.description} numberOfLines={2}>
          {market.description}
        </Text>
      )}

      {/* Outcomes */}
      <View style={styles.outcomesContainer}>
        {market.outcomes.map((outcome, index) => (
          <View key={outcome.id} style={styles.outcomeItem}>
            <View style={[styles.outcomeDot, { backgroundColor: outcome.color }]} />
            <Text style={styles.outcomeName}>{outcome.name}</Text>
            <Text style={styles.outcomePrice}>
              {(outcome.currentPrice * 100).toFixed(0)}%
            </Text>
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.volumeText}>
          Volume: {formatVolume(market.totalVolume)} credits
        </Text>
        <Text style={styles.expiresText}>
          Expires: {formatDate(market.expiresAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E1E2E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: '#2D2D44',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    color: '#A0A0B0',
    fontSize: 12,
    fontWeight: '600',
  },
  expiryContainer: {
    backgroundColor: '#FF6B6B20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  expiryText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    color: '#A0A0B0',
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  outcomesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#2D2D44',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  outcomeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  outcomeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  outcomeName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
  outcomePrice: {
    color: '#22C55E',
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  volumeText: {
    color: '#A0A0B0',
    fontSize: 12,
  },
  expiresText: {
    color: '#A0A0B0',
    fontSize: 12,
  },
});

export default MarketCard;
