import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../lib/colors';
import { signOut } from '../../lib/auth';
import { apiClient } from '../../lib/api-client';

interface SettingItem {
  icon: string;
  title: string;
  subtitle?: string;
  type: 'toggle' | 'navigation' | 'action';
  value?: boolean;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
}

export default function SettingsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = React.useState(true);
  const [soundEffects, setSoundEffects] = React.useState(true);
  const [hapticFeedback, setHapticFeedback] = React.useState(true);
  const [darkMode, setDarkMode] = React.useState(true);

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            apiClient.setAuthToken(null);
            router.replace('/auth');
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Not Available', 'Account deletion is not yet available. Please contact support.');
          },
        },
      ]
    );
  };

  const generalSettings: SettingItem[] = [
    { 
      icon: '🔔', 
      title: 'Notifications', 
      subtitle: 'Tournament reminders, friend activity',
      type: 'toggle',
      value: notifications,
      onToggle: setNotifications,
    },
    { 
      icon: '🔊', 
      title: 'Sound Effects', 
      subtitle: 'Market updates, achievements',
      type: 'toggle',
      value: soundEffects,
      onToggle: setSoundEffects,
    },
    { 
      icon: '📳', 
      title: 'Haptic Feedback', 
      subtitle: 'Vibration on actions',
      type: 'toggle',
      value: hapticFeedback,
      onToggle: setHapticFeedback,
    },
    { 
      icon: '🌙', 
      title: 'Dark Mode', 
      subtitle: 'Use dark theme',
      type: 'toggle',
      value: darkMode,
      onToggle: setDarkMode,
    },
  ];

  const accountSettings: SettingItem[] = [
    { 
      icon: '👤', 
      title: 'Edit Profile', 
      subtitle: 'Change username, avatar',
      type: 'navigation',
      onPress: () => Alert.alert('Edit Profile', 'Profile editing coming soon'),
    },
    {
      icon: '🔒',
      title: 'Change Password',
      subtitle: 'Update your password',
      type: 'navigation',
      onPress: () => Alert.alert('Change Password', 'Password change coming soon'),
    },
    {
      icon: '📧',
      title: 'Email Settings',
      subtitle: 'Manage email preferences',
      type: 'navigation',
      onPress: () => Alert.alert('Email Settings', 'Email preferences coming soon'),
    },
  ];

  const supportSettings: SettingItem[] = [
    {
      icon: '❓',
      title: 'Help Center',
      subtitle: 'FAQs and support',
      type: 'navigation',
      onPress: () => Alert.alert('Help', 'For support, email support@predictspinz.com'),
    },
    {
      icon: '💬',
      title: 'Contact Us',
      subtitle: 'Get help from our team',
      type: 'navigation',
      onPress: () => Linking.openURL('mailto:support@predictspinz.com'),
    },
    {
      icon: '📜',
      title: 'Terms of Service',
      type: 'navigation',
      onPress: () => Alert.alert('Terms of Service', 'Terms of service page coming soon'),
    },
    {
      icon: '🔐',
      title: 'Privacy Policy',
      type: 'navigation',
      onPress: () => Alert.alert('Privacy Policy', 'Privacy policy page coming soon'),
    },
  ];

  const renderSettingItem = (item: SettingItem, index: number) => (
    <TouchableOpacity
      key={index}
      style={styles.settingItem}
      onPress={item.type !== 'toggle' ? item.onPress : undefined}
      disabled={item.type === 'toggle'}
    >
      <View style={styles.settingIcon}>
        <Text style={styles.iconText}>{item.icon}</Text>
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{item.title}</Text>
        {item.subtitle && (
          <Text style={styles.settingSubtitle}>{item.subtitle}</Text>
        )}
      </View>
      {item.type === 'toggle' && (
        <Switch
          value={item.value}
          onValueChange={item.onToggle}
          trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
          thumbColor={item.value ? Colors.primary : Colors.textSecondary}
        />
      )}
      {item.type === 'navigation' && (
        <Text style={styles.chevron}>›</Text>
      )}
    </TouchableOpacity>
  );

  const renderSection = (title: string, items: SettingItem[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>
        {items.map((item, index) => renderSettingItem(item, index))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appName}>PredictSpinz</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
          <Text style={styles.appTagline}>Predict. Win. Repeat.</Text>
        </View>

        {renderSection('Preferences', generalSettings)}
        {renderSection('Account', accountSettings)}
        {renderSection('Support', supportSettings)}

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, styles.dangerTitle]}>Danger Zone</Text>
          <View style={styles.sectionContent}>
            <TouchableOpacity style={styles.settingItem} onPress={handleSignOut}>
              <View style={[styles.settingIcon, styles.dangerIcon]}>
                <Text style={styles.iconText}>🚪</Text>
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, styles.dangerText]}>Sign Out</Text>
                <Text style={styles.settingSubtitle}>Sign out of your account</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.settingItem} onPress={handleDeleteAccount}>
              <View style={[styles.settingIcon, styles.dangerIcon]}>
                <Text style={styles.iconText}>🗑️</Text>
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, styles.dangerText]}>Delete Account</Text>
                <Text style={styles.settingSubtitle}>Permanently delete all data</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Credits have no real-world value.{'\n'}
            This is a prediction game, not gambling.{'\n'}
            © 2024 PredictSpinz
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
  appInfo: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  appTagline: {
    fontSize: 14,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  dangerTitle: {
    color: Colors.danger,
  },
  sectionContent: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  dangerIcon: {
    backgroundColor: Colors.danger + '20',
  },
  iconText: {
    fontSize: 20,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  settingSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  dangerText: {
    color: Colors.danger,
  },
  chevron: {
    fontSize: 24,
    color: Colors.textSecondary,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingBottom: 48,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
