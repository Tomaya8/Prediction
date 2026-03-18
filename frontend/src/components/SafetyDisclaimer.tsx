/**
 * SafetyDisclaimer Component
 * Displays required gambling disclaimer
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface SafetyDisclaimerProps {
  compact?: boolean;
}

export const SafetyDisclaimer: React.FC<SafetyDisclaimerProps> = ({ compact = false }) => {
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <Text style={styles.compactText}>
          ⚠️ Credits have no real-world value. Not gambling.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>⚠️</Text>
      </View>
      
      <Text style={styles.title}>Important Notice</Text>
      
      <View style={styles.content}>
        <Text style={styles.text}>
          PredictSpinz is a simulation game using virtual credits only.
        </Text>
        
        <View style={styles.bulletPoints}>
          <Text style={styles.bullet}>• Credits have no real-world monetary value</Text>
          <Text style={styles.bullet}>• Cannot be withdrawn, exchanged, or converted to cash</Text>
          <Text style={styles.bullet}>• This is NOT gambling - no real money is at risk</Text>
          <Text style={styles.bullet}>• For entertainment and educational purposes only</Text>
        </View>

        <View style={styles.ageContainer}>
          <Text style={styles.ageText}>
            Must be 13+ to use this app. Please play responsibly.
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.acknowledgeButton}>
        <Text style={styles.acknowledgeText}>I Understand</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E1E2E',
    borderRadius: 16,
    padding: 20,
    margin: 16,
    alignItems: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF6B6B20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 28,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  content: {
    width: '100%',
  },
  text: {
    color: '#A0A0B0',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  bulletPoints: {
    marginBottom: 16,
  },
  bullet: {
    color: '#A0A0B0',
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  ageContainer: {
    backgroundColor: '#2D2D44',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  ageText: {
    color: '#FF6B6B',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  acknowledgeButton: {
    backgroundColor: '#22C55E',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  acknowledgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // Compact styles
  compactContainer: {
    backgroundColor: '#FF6B6B15',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  compactText: {
    color: '#FF6B6B',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default SafetyDisclaimer;
