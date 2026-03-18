/**
 * TradingPanel Component
 * Buy/sell interface for trading on market outcomes
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';

interface Outcome {
  id: string;
  name: string;
  color: string;
  currentPrice: number;
  quantity: number;
}

interface TradingPanelProps {
  marketId: string;
  outcomes: Outcome[];
  userBalance: number;
  onTrade: (outcomeId: string, quantity: number, type: 'BUY' | 'SELL') => Promise<void>;
  disabled?: boolean;
}

export const TradingPanel: React.FC<TradingPanelProps> = ({
  marketId,
  outcomes,
  userBalance,
  onTrade,
  disabled = false
}) => {
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<string>('10');
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [isLoading, setIsLoading] = useState(false);

  const selectedOutcomeData = outcomes.find(o => o.id === selectedOutcome);
  const quantityNum = parseInt(quantity) || 0;

  // Calculate estimated cost/revenue
  const calculateCost = () => {
    if (!selectedOutcomeData || quantityNum <= 0) return 0;
    // Simplified cost calculation (in production, use actual LMSR)
    return Math.round(quantityNum * selectedOutcomeData.currentPrice * 100) / 100;
  };

  const estimatedCost = calculateCost();
  const canExecute = selectedOutcome && quantityNum > 0 && !disabled && 
    (tradeType === 'BUY' ? estimatedCost <= userBalance : true);

  const handleTrade = async () => {
    if (!canExecute || !selectedOutcome) return;

    setIsLoading(true);
    try {
      await onTrade(selectedOutcome, quantityNum, tradeType);
      setQuantity('10');
      Alert.alert(
        'Trade Successful',
        `${tradeType === 'BUY' ? 'Bought' : 'Sold'} ${quantityNum} shares of ${selectedOutcomeData?.name}`
      );
    } catch (error) {
      Alert.alert('Trade Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const quickAmounts = [10, 50, 100, 500];

  return (
    <View style={styles.container}>
      {/* Trade Type Toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleButton, tradeType === 'BUY' && styles.toggleButtonActive]}
          onPress={() => setTradeType('BUY')}
          disabled={disabled}
        >
          <Text style={[styles.toggleText, tradeType === 'BUY' && styles.toggleTextActive]}>
            Buy
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, tradeType === 'SELL' && styles.toggleButtonActive]}
          onPress={() => setTradeType('SELL')}
          disabled={disabled}
        >
          <Text style={[styles.toggleText, tradeType === 'SELL' && styles.toggleTextActive]}>
            Sell
          </Text>
        </TouchableOpacity>
      </View>

      {/* Outcome Selection */}
      <Text style={styles.sectionTitle}>Select Outcome</Text>
      <View style={styles.outcomesGrid}>
        {outcomes.map((outcome) => (
          <TouchableOpacity
            key={outcome.id}
            style={[
              styles.outcomeButton,
              selectedOutcome === outcome.id && styles.outcomeButtonSelected,
              { borderColor: outcome.color }
            ]}
            onPress={() => setSelectedOutcome(outcome.id)}
            disabled={disabled}
          >
            <View style={[styles.outcomeDot, { backgroundColor: outcome.color }]} />
            <Text style={styles.outcomeName}>{outcome.name}</Text>
            <Text style={[styles.outcomePrice, { color: outcome.color }]}>
              {(outcome.currentPrice * 100).toFixed(0)}%
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quantity Input */}
      <Text style={styles.sectionTitle}>Quantity</Text>
      <View style={styles.quantityContainer}>
        <TextInput
          style={styles.quantityInput}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
          placeholder="Enter quantity"
          placeholderTextColor="#666"
          editable={!disabled}
        />
        <View style={styles.quickAmounts}>
          {quickAmounts.map((amount) => (
            <TouchableOpacity
              key={amount}
              style={styles.quickAmountButton}
              onPress={() => setQuantity(amount.toString())}
              disabled={disabled}
            >
              <Text style={styles.quickAmountText}>{amount}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Cost Summary */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Estimated {tradeType === 'BUY' ? 'Cost' : 'Revenue'}</Text>
          <Text style={[
            styles.summaryValue,
            tradeType === 'SELL' && styles.summaryValuePositive
          ]}>
            {tradeType === 'BUY' ? '-' : '+'}{estimatedCost.toFixed(2)} credits
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Your Balance</Text>
          <Text style={styles.summaryValue}>{userBalance.toFixed(2)} credits</Text>
        </View>
        {tradeType === 'BUY' && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>After Trade</Text>
            <Text style={styles.summaryValue}>
              {(userBalance - estimatedCost).toFixed(2)} credits
            </Text>
          </View>
        )}
      </View>

      {/* Execute Button */}
      <TouchableOpacity
        style={[
          styles.executeButton,
          !canExecute && styles.executeButtonDisabled,
          isLoading && styles.executeButtonLoading
        ]}
        onPress={handleTrade}
        disabled={!canExecute || isLoading}
      >
        <Text style={styles.executeButtonText}>
          {isLoading ? 'Processing...' : `${tradeType} ${quantityNum} Shares`}
        </Text>
      </TouchableOpacity>

      {/* Disclaimer */}
      <Text style={styles.disclaimer}>
        Credits have no real-world value. This is not gambling.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E1E2E',
    borderRadius: 16,
    padding: 16,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#2D2D44',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  toggleButtonActive: {
    backgroundColor: '#22C55E',
  },
  toggleText: {
    color: '#A0A0B0',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  sectionTitle: {
    color: '#A0A0B0',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  outcomesGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  outcomeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2D2D44',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  outcomeButtonSelected: {
    backgroundColor: '#3D3D54',
  },
  outcomeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  outcomeName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginLeft: 8,
  },
  outcomePrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  quantityContainer: {
    marginBottom: 20,
  },
  quantityInput: {
    backgroundColor: '#2D2D44',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: 8,
  },
  quickAmountButton: {
    flex: 1,
    backgroundColor: '#2D2D44',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  quickAmountText: {
    color: '#A0A0B0',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryContainer: {
    backgroundColor: '#2D2D44',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#A0A0B0',
    fontSize: 14,
  },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryValuePositive: {
    color: '#22C55E',
  },
  executeButton: {
    backgroundColor: '#22C55E',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  executeButtonDisabled: {
    backgroundColor: '#2D2D44',
  },
  executeButtonLoading: {
    opacity: 0.7,
  },
  executeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  disclaimer: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default TradingPanel;