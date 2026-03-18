import { useState, use } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../lib/colors';

// Mock market data (in production, fetch from API)
const MOCK_MARKET = {
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
  const [market] = useState(MOCK_MARKET);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('10');
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [userBalance] = useState(1000);

  const quantityNum = parseInt(quantity) || 0;
  const selectedOutcomeData = market.outcomes.find(o => o.id === selectedOutcome);
  const estimatedCost = selectedOutcomeData ? Math.round(quantityNum * selectedOutcomeData.currentPrice * 100) / 100 : 0;

  const handleTrade = () => {
    if (!selectedOutcome) {
      Alert.alert('Error', 'Please select an outcome');
      return;
    }
    if (quantityNum <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }
    if (tradeType === 'BUY' && estimatedCost > userBalance) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }

    Alert.alert(
      'Confirm Trade',
      `${tradeType} ${quantityNum} shares of ${selectedOutcomeData?.name} for ${estimatedCost} credits?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          onPress: () => {
            Alert.alert('Success', `Trade executed! ${tradeType === 'BUY' ? 'Bought' : 'Sold'} ${quantityNum} shares.`);
            router.back();
          }
        },
      ]
    );
  };

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

        {/* Probability Chart */}
        <View style={styles.probabilitySection}>
          <Text style={styles.sectionTitle}>Current Probability</Text>
          <View style={styles.probabilityBar}>
            <View style={styles.probabilityContainer}>
              <View style={[styles.probabilityFill, { width: '65%', backgroundColor: Colors.yes }]} />
            </View>
            <View style={styles.probabilityLabels}>
              <Text style={[styles.probabilityText, { color: Colors.yes }]}>YES 65%</Text>
              <Text style={[styles.probabilityText, { color: Colors.no }]}>NO 35%</Text>
            </View>
          </View>
        </View>

        {/* Market Info */}
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📊 Volume</Text>
            <Text style={styles.infoValue}>{market.totalVolume.toLocaleString()} credits</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📅 Expires</Text>
            <Text style={styles.infoValue}>December 31, 2024</Text>
          </View>
        </View>

        {/* Trading Section */}
        <View style={styles.tradingSection}>
          <Text style={styles.sectionTitle}>Trade</Text>
          
          {/* Balance */}
          <View style={styles.balanceContainer}>
            <Text style={styles.balanceLabel}>Your Balance</Text>
            <Text style={styles.balanceValue}>🔶 {userBalance} credits</Text>
          </View>

          {/* Buy/Sell Toggle */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, tradeType === 'BUY' && styles.toggleBuy]}
              onPress={() => setTradeType('BUY')}
            >
              <Text style={[styles.toggleText, tradeType === 'BUY' && styles.toggleTextActive]}>
                Buy
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, tradeType === 'SELL' && styles.toggleSell]}
              onPress={() => setTradeType('SELL')}
            >
              <Text style={[styles.toggleText, tradeType === 'SELL' && styles.toggleTextActive]}>
                Sell
              </Text>
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
                  { borderColor: outcome.color }
                ]}
                onPress={() => setSelectedOutcome(outcome.id)}
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
          <Text style={styles.inputLabel}>Quantity</Text>
          <TextInput
            style={styles.quantityInput}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            placeholder="Enter quantity"
            placeholderTextColor="#666"
          />

          {/* Quick Amounts */}
          <View style={styles.quickAmounts}>
            {[10, 50, 100, 500].map((amount) => (
              <TouchableOpacity
                key={amount}
                style={styles.quickAmountButton}
                onPress={() => setQuantity(amount.toString())}
              >
                <Text style={styles.quickAmountText}>{amount}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Cost Summary */}
          <View style={styles.costSummary}>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>
                {tradeType === 'BUY' ? 'Estimated Cost' : 'Estimated Revenue'}
              </Text>
              <Text style={[
                styles.costValue,
                tradeType === 'SELL' && styles.costValuePositive
              ]}>
                {tradeType === 'BUY' ? '-' : '+'}{estimatedCost.toFixed(2)} credits
              </Text>
            </View>
            {tradeType === 'BUY' && (
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>After Trade</Text>
                <Text style={styles.costValue}>{(userBalance - estimatedCost).toFixed(2)} credits</Text>
              </View>
            )}
          </View>

          {/* Execute Button */}
          <TouchableOpacity
            style={[
              styles.executeButton,
              tradeType === 'BUY' ? styles.executeBuy : styles.executeSell,
              (!selectedOutcome || quantityNum <= 0) && styles.executeDisabled
            ]}
            onPress={handleTrade}
            disabled={!selectedOutcome || quantityNum <= 0}
          >
            <Text style={styles.executeButtonText}>
              {tradeType === 'BUY' ? 'BUY' : 'SELL'} {quantityNum} SHARES
            </Text>
          </TouchableOpacity>
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            ⚠️ Credits have no real-world value. This is not gambling.
          </Text>
        </View>
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
    gap: 12,
    marginBottom: 12,
  },
  outcomeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  outcomeButtonSelected: {
    backgroundColor: Colors.surfaceHighlight,
  },
  outcomeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  outcomeName: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginLeft: 8,
  },
  outcomePrice: {
    fontSize: 16,
    fontWeight: '700',
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
});
