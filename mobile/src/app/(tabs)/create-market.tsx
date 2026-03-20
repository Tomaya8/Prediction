// Create Market Screen
// Allow users to propose new prediction markets

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Colors } from '../../lib/colors';
import { apiClient } from '../../lib/api-client';

const CATEGORIES = [
  { id: 'POLITICS', label: 'Politics', emoji: '🏛️' },
  { id: 'SPORTS', label: 'Sports', emoji: '⚽' },
  { id: 'CRYPTO', label: 'Crypto', emoji: '₿' },
  { id: 'ENTERTAINMENT', label: 'Entertainment', emoji: '🎬' },
  { id: 'SCIENCE', label: 'Science', emoji: '🔬' },
];

export default function CreateMarketScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('POLITICS');
  const [expiresAt, setExpiresAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a market title');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }
    if (!expiresAt.trim()) {
      Alert.alert('Error', 'Please enter an expiration date');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiClient.createMarket({
        title: title.trim(),
        description: description.trim(),
        category,
        outcomes: ['Yes', 'No'],
        expiresAt: new Date(expiresAt).toISOString(),
      });

      setIsSubmitting(false);

      if (response.success) {
        Alert.alert(
          'Market Submitted!',
          'Your market has been submitted for review. Once approved, it will be available for trading!',
          [
            {
              text: 'OK',
              onPress: () => {
                setTitle('');
                setDescription('');
                setCategory('POLITICS');
                setExpiresAt('');
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', response.error || 'Failed to create market');
      }
    } catch (err) {
      setIsSubmitting(false);
      Alert.alert('Error', 'Failed to create market. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerEmoji}>💡</Text>
          <Text style={styles.headerTitle}>Propose a Market</Text>
          <Text style={styles.headerDescription}>
            Have an idea for a prediction? Submit it for the community to trade on!
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Category Selection */}
          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryButton,
                  category === cat.id && styles.categoryButtonActive,
                ]}
                onPress={() => setCategory(cat.id)}
              >
                <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                <Text
                  style={[
                    styles.categoryLabel,
                    category === cat.id && styles.categoryLabelActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Market Title */}
          <Text style={styles.label}>Question</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Will Bitcoin reach $200k by 2025?"
            placeholderTextColor={Colors.textMuted}
            value={title}
            onChangeText={setTitle}
            multiline
          />

          {/* Description */}
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Provide more details about the outcome..."
            placeholderTextColor={Colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />

          {/* Expiration Date */}
          <Text style={styles.label}>Resolution Date</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., December 31, 2025"
            placeholderTextColor={Colors.textMuted}
            value={expiresAt}
            onChangeText={setExpiresAt}
          />

          {/* Info Box */}
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>ℹ️ How it works</Text>
            <Text style={styles.infoText}>
              • Your market will be reviewed by our team{'\n'}
              • Once approved, it becomes available for trading{'\n'}
              • You earn 50 credits if your market is approved{'\n'}
              • Popular markets can attract thousands in volume
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Submitting...' : 'Submit Market'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recent Proposals */}
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recently Proposed</Text>
          
          <View style={styles.proposalCard}>
            <View style={styles.proposalHeader}>
              <Text style={styles.proposalCategory}>🏛️ Politics</Text>
              <Text style={styles.proposalStatus}>✓ Approved</Text>
            </View>
            <Text style={styles.proposalTitle}>
              Will the UK rejoin the EU by 2030?
            </Text>
            <Text style={styles.proposalDate}>Expires: December 31, 2030</Text>
          </View>

          <View style={styles.proposalCard}>
            <View style={styles.proposalHeader}>
              <Text style={styles.proposalCategory}>⚽ Sports</Text>
              <Text style={styles.proposalStatusPending}>⏳ Review</Text>
            </View>
            <Text style={styles.proposalTitle}>
              Will Messi win the 2026 World Cup?
            </Text>
            <Text style={styles.proposalDate}>Expires: July 19, 2026</Text>
          </View>

          <View style={styles.proposalCard}>
            <View style={styles.proposalHeader}>
              <Text style={styles.proposalCategory}>₿ Crypto</Text>
              <Text style={styles.proposalStatus}>✓ Approved</Text>
            </View>
            <Text style={styles.proposalTitle}>
              Will Solana flip Ethereum by market cap?
            </Text>
            <Text style={styles.proposalDate}>Expires: December 31, 2027</Text>
          </View>
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
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 20,
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  headerDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
    marginTop: 16,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  categoryLabelActive: {
    color: Colors.textPrimary,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  infoBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  recentSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  proposalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  proposalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  proposalCategory: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  proposalStatus: {
    fontSize: 12,
    color: Colors.yes,
    fontWeight: '600',
  },
  proposalStatusPending: {
    fontSize: 12,
    color: Colors.warning,
    fontWeight: '600',
  },
  proposalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  proposalDate: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});
