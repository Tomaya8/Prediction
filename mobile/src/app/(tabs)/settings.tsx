import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, setThemeMode, getThemeMode } from '../../lib/colors';
import { useStyles } from '../../lib/useStyles';
import { signOut } from '../../lib/auth';
import { apiClient } from '../../lib/api-client';

interface SettingItem {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  type: 'toggle' | 'navigation' | 'action';
  value?: boolean;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
}

export default function SettingsScreen() {
  const styles = useStyles(createStyles);
  const router = useRouter();
  const [notifications, setNotifications] = React.useState(true);
  const [soundEffects, setSoundEffects] = React.useState(true);
  const [hapticFeedback, setHapticFeedback] = React.useState(true);
  const [darkMode, setDarkMode] = React.useState(getThemeMode() === 'dark');

  const handleDarkModeToggle = (value: boolean) => {
    setDarkMode(value);
    setThemeMode(value ? 'dark' : 'light');
  };

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

  const [deleting, setDeleting] = React.useState(false);

  const executeDeleteAccount = async (password?: string) => {
    setDeleting(true);
    try {
      const result = await apiClient.deleteAccount(password);
      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to delete account.');
        setDeleting(false);
        return;
      }
      await signOut();
      apiClient.setAuthToken(null);
      router.replace('/auth');
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
      setDeleting(false);
    }
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
            // On iOS we can use Alert.prompt for password, on Android use a second confirmation
            if (Platform.OS === 'ios') {
              Alert.prompt(
                'Confirm Deletion',
                'Enter your password to confirm account deletion.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete Forever', style: 'destructive', onPress: (pw) => executeDeleteAccount(pw) },
                ],
                'secure-text'
              );
            } else {
              Alert.alert(
                'Final Confirmation',
                'Are you absolutely sure? All your credits, trades, and history will be permanently deleted.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete Forever', style: 'destructive', onPress: () => executeDeleteAccount() },
                ]
              );
            }
          },
        },
      ]
    );
  };

  const generalSettings: SettingItem[] = [
    {
      icon: 'notifications-outline',
      title: 'Notifications',
      subtitle: 'Tournament reminders, friend activity',
      type: 'toggle',
      value: notifications,
      onToggle: setNotifications,
    },
    {
      icon: 'volume-high-outline',
      title: 'Sound Effects',
      subtitle: 'Market updates, achievements',
      type: 'toggle',
      value: soundEffects,
      onToggle: setSoundEffects,
    },
    {
      icon: 'phone-portrait-outline',
      title: 'Haptic Feedback',
      subtitle: 'Vibration on actions',
      type: 'toggle',
      value: hapticFeedback,
      onToggle: setHapticFeedback,
    },
    {
      icon: 'moon-outline',
      title: 'Dark Mode',
      subtitle: 'Use dark theme',
      type: 'toggle',
      value: darkMode,
      onToggle: handleDarkModeToggle,
    },
  ];

  const accountSettings: SettingItem[] = [
    {
      icon: 'person-outline',
      title: 'Edit Profile',
      subtitle: 'Change username, avatar',
      type: 'navigation',
      onPress: () => Alert.alert('Edit Profile', 'Profile editing coming soon'),
    },
    {
      icon: 'lock-closed-outline',
      title: 'Change Password',
      subtitle: 'Update your password',
      type: 'navigation',
      onPress: () => Alert.alert('Change Password', 'Password change coming soon'),
    },
    {
      icon: 'mail-outline',
      title: 'Email Settings',
      subtitle: 'Manage email preferences',
      type: 'navigation',
      onPress: () => Alert.alert('Email Settings', 'Email preferences coming soon'),
    },
  ];

  const supportSettings: SettingItem[] = [
    {
      icon: 'help-circle-outline',
      title: 'Help Center',
      subtitle: 'FAQs and support',
      type: 'navigation',
      onPress: () => Alert.alert('Help', 'For support, email support@predich.app'),
    },
    {
      icon: 'chatbubble-outline',
      title: 'Contact Us',
      subtitle: 'Get help from our team',
      type: 'navigation',
      onPress: () => Linking.openURL('mailto:support@predich.app'),
    },
    {
      icon: 'document-text-outline',
      title: 'Terms of Service',
      type: 'navigation',
      onPress: () => Alert.alert('Terms of Service', 'Terms of service page coming soon'),
    },
    {
      icon: 'shield-checkmark-outline',
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
        <Ionicons name={item.icon} size={20} color={Colors.textSecondary} />
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
          <Text style={styles.appName}>Predich</Text>
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
                <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, styles.dangerText]}>Sign Out</Text>
                <Text style={styles.settingSubtitle}>Sign out of your account</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem} onPress={handleDeleteAccount}>
              <View style={[styles.settingIcon, styles.dangerIcon]}>
                <Ionicons name="trash-outline" size={20} color={Colors.danger} />
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
            © 2024 Predich
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles() { return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
  appName: {
    fontSize: FontSize.title,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  appVersion: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  appTagline: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  dangerTitle: {
    color: Colors.danger,
  },
  sectionContent: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
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
    marginRight: Spacing.md + 2,
  },
  dangerIcon: {
    backgroundColor: Colors.dangerMuted,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: FontSize.lg,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  settingSubtitle: {
    fontSize: FontSize.sm,
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
    paddingVertical: Spacing.xxxl,
    paddingBottom: 48,
  },
  footerText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
}); }
