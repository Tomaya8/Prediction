import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Linking, Platform, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, setThemeMode, getThemeMode } from '../../lib/colors';
import { useStyles } from '../../lib/useStyles';
import { signOut, getStoredUser } from '../../lib/auth';
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

// ─── Edit Profile Modal ─────────────────────────────────────────────────────

function EditProfileModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = useStyles(createModalStyles);
  const [displayName, setDisplayName] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [fetching, setFetching] = React.useState(true);

  React.useEffect(() => {
    if (visible) {
      setFetching(true);
      apiClient.getProfile().then(res => {
        if (res.success && res.data) setDisplayName(res.data.displayName || '');
        setFetching(false);
      });
    }
  }, [visible]);

  const handleSave = async () => {
    if (!displayName.trim()) { Alert.alert('Error', 'Username cannot be empty'); return; }
    setLoading(true);
    const res = await apiClient.updateProfile({ displayName: displayName.trim() });
    setLoading(false);
    if (res.success) {
      Alert.alert('Updated', 'Your profile has been updated.');
      onClose();
    } else {
      Alert.alert('Error', res.error || 'Failed to update profile');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.container}>
          <View style={s.header}>
            <Text style={s.title}>Edit Profile</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={Colors.textSecondary} /></TouchableOpacity>
          </View>
          {fetching ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={s.body}>
              <Text style={s.label}>Username</Text>
              <TextInput
                style={s.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter username"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                maxLength={50}
              />
              <Text style={s.hint}>This is how other players see you on the leaderboard.</Text>

              <TouchableOpacity
                style={[s.saveButton, loading && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Change Password Modal ──────────────────────────────────────────────────

function ChangePasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = useStyles(createModalStyles);
  const [currentPw, setCurrentPw] = React.useState('');
  const [newPw, setNewPw] = React.useState('');
  const [confirmPw, setConfirmPw] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (visible) { setCurrentPw(''); setNewPw(''); setConfirmPw(''); }
  }, [visible]);

  const handleChange = async () => {
    if (!currentPw) { Alert.alert('Error', 'Enter your current password'); return; }
    if (newPw.length < 6) { Alert.alert('Error', 'New password must be at least 6 characters'); return; }
    if (newPw !== confirmPw) { Alert.alert('Error', 'New passwords do not match'); return; }
    setLoading(true);
    const res = await apiClient.changePassword(currentPw, newPw);
    setLoading(false);
    if (res.success) {
      Alert.alert('Success', 'Your password has been changed.');
      onClose();
    } else {
      Alert.alert('Error', res.error || 'Failed to change password');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.container}>
          <View style={s.header}>
            <Text style={s.title}>Change Password</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={Colors.textSecondary} /></TouchableOpacity>
          </View>
          <View style={s.body}>
            <Text style={s.label}>Current Password</Text>
            <TextInput style={s.input} value={currentPw} onChangeText={setCurrentPw} secureTextEntry placeholder="Enter current password" placeholderTextColor={Colors.textMuted} />

            <Text style={s.label}>New Password</Text>
            <TextInput style={s.input} value={newPw} onChangeText={setNewPw} secureTextEntry placeholder="Enter new password" placeholderTextColor={Colors.textMuted} />

            <Text style={s.label}>Confirm New Password</Text>
            <TextInput style={s.input} value={confirmPw} onChangeText={setConfirmPw} secureTextEntry placeholder="Confirm new password" placeholderTextColor={Colors.textMuted} />

            <TouchableOpacity
              style={[s.saveButton, loading && { opacity: 0.6 }]}
              onPress={handleChange}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Change Password</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Email Settings Modal ───────────────────────────────────────────────────

function EmailSettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = useStyles(createModalStyles);
  const [email, setEmail] = React.useState('');
  const [marketUpdates, setMarketUpdates] = React.useState(true);
  const [tournamentAlerts, setTournamentAlerts] = React.useState(true);
  const [weeklyDigest, setWeeklyDigest] = React.useState(false);
  const [fetching, setFetching] = React.useState(true);

  React.useEffect(() => {
    if (visible) {
      setFetching(true);
      getStoredUser().then(user => {
        if (user) setEmail(user.email);
        setFetching(false);
      });
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.container}>
          <View style={s.header}>
            <Text style={s.title}>Email Settings</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={Colors.textSecondary} /></TouchableOpacity>
          </View>
          {fetching ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={s.body}>
              <Text style={s.label}>Email Address</Text>
              <View style={s.emailRow}>
                <Ionicons name="mail-outline" size={18} color={Colors.textSecondary} />
                <Text style={s.emailText}>{email}</Text>
              </View>
              <Text style={s.hint}>Contact support@predich.app to change your email address.</Text>

              <Text style={[s.label, { marginTop: Spacing.xl }]}>Email Notifications</Text>

              <View style={s.toggleRow}>
                <View style={s.toggleInfo}>
                  <Text style={s.toggleTitle}>Market Updates</Text>
                  <Text style={s.toggleSub}>Price changes on markets you follow</Text>
                </View>
                <Switch value={marketUpdates} onValueChange={setMarketUpdates}
                  trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
                  thumbColor={marketUpdates ? Colors.primary : Colors.textSecondary} />
              </View>

              <View style={s.toggleRow}>
                <View style={s.toggleInfo}>
                  <Text style={s.toggleTitle}>Tournament Alerts</Text>
                  <Text style={s.toggleSub}>New tournaments, results, reminders</Text>
                </View>
                <Switch value={tournamentAlerts} onValueChange={setTournamentAlerts}
                  trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
                  thumbColor={tournamentAlerts ? Colors.primary : Colors.textSecondary} />
              </View>

              <View style={s.toggleRow}>
                <View style={s.toggleInfo}>
                  <Text style={s.toggleTitle}>Weekly Digest</Text>
                  <Text style={s.toggleSub}>Summary of your portfolio and activity</Text>
                </View>
                <Switch value={weeklyDigest} onValueChange={setWeeklyDigest}
                  trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
                  thumbColor={weeklyDigest ? Colors.primary : Colors.textSecondary} />
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Help Center Modal ──────────────────────────────────────────────────────

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'What are credits?',
    answer: 'Credits are the virtual currency in Predich. You use them to trade on prediction markets and enter tournaments. Credits have no real-world monetary value and cannot be withdrawn or exchanged for cash.',
  },
  {
    question: 'How do I earn credits?',
    answer: 'You can earn credits through:\n- Daily login rewards (25-75 credits/day)\n- Winning tournament prizes\n- Referral bonuses (500 credits for each friend)\n- Watching rewarded ads\n- Purchasing credit packs in the Credit Store',
  },
  {
    question: 'How do prediction markets work?',
    answer: 'You buy shares of an outcome (e.g. "Yes" or "No"). The price reflects the crowd\'s probability estimate. If you\'re right when the market resolves, you earn credits. If wrong, you lose your investment.',
  },
  {
    question: 'How do tournaments work?',
    answer: 'Tournaments ask you to predict a specific number (like BTC price on a future date). You pay an entry fee, submit your prediction, and wait. The closest prediction to the actual value wins! Top players get multiplied payouts from the prize pool.',
  },
  {
    question: 'What happens if a tournament is cancelled?',
    answer: 'Tournaments with fewer than 2 participants are automatically cancelled. Your entry fee is fully refunded to your account and you receive a notification.',
  },
  {
    question: 'How is the tournament winner determined?',
    answer: 'At the expiry time, the actual value is fetched from a real-world data source (e.g. CoinGecko for crypto prices). All predictions are ranked by how close they are to the actual value. Closest wins 1st place.',
  },
  {
    question: 'Can I change my prediction after entering a tournament?',
    answer: 'Yes, you can edit your prediction during the registration period. Once registration closes and predictions are locked, no changes are allowed.',
  },
  {
    question: 'How do I delete my account?',
    answer: 'Go to Settings > Danger Zone > Delete Account. This permanently deletes all your data including trades, holdings, and transaction history. This action cannot be undone.',
  },
  {
    question: 'Is this gambling?',
    answer: 'No. Predich uses virtual credits that have no real-world value and cannot be withdrawn. It is a skill-based prediction game for entertainment purposes.',
  },
];

function HelpCenterModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = useStyles(createModalStyles);
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.container}>
          <View style={s.header}>
            <Text style={s.title}>Help Center</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={Colors.textSecondary} /></TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <Text style={[s.label, { marginTop: 0 }]}>Frequently Asked Questions</Text>

            {FAQ_ITEMS.map((faq, index) => (
              <TouchableOpacity
                key={index}
                style={{
                  backgroundColor: Colors.surface,
                  borderRadius: Radius.md,
                  padding: Spacing.lg,
                  marginBottom: Spacing.sm,
                }}
                onPress={() => setExpandedIndex(expandedIndex === index ? null : index)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary, flex: 1, marginRight: Spacing.sm }}>
                    {faq.question}
                  </Text>
                  <Ionicons
                    name={expandedIndex === index ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={Colors.textSecondary}
                  />
                </View>
                {expandedIndex === index && (
                  <Text style={{ fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.md, lineHeight: 20 }}>
                    {faq.answer}
                  </Text>
                )}
              </TouchableOpacity>
            ))}

            <View style={{ marginTop: Spacing.xl, alignItems: 'center', paddingBottom: 40 }}>
              <Text style={{ fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.md }}>
                Still need help?
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md }}
                onPress={() => Linking.openURL('mailto:support@predich.app')}
              >
                <Text style={{ color: '#fff', fontSize: FontSize.md, fontWeight: '700' }}>Contact Support</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Settings Screen ───────────────────────────────────────────────────

export default function SettingsScreen() {
  const styles = useStyles(createStyles);
  const router = useRouter();
  const [notifications, setNotifications] = React.useState(true);
  const [soundEffects, setSoundEffects] = React.useState(true);
  const [hapticFeedback, setHapticFeedback] = React.useState(true);
  const [darkMode, setDarkMode] = React.useState(getThemeMode() === 'dark');

  // Modal visibility
  const [showEditProfile, setShowEditProfile] = React.useState(false);
  const [showChangePassword, setShowChangePassword] = React.useState(false);
  const [showEmailSettings, setShowEmailSettings] = React.useState(false);
  const [showHelpCenter, setShowHelpCenter] = React.useState(false);

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
      onPress: () => setShowEditProfile(true),
    },
    {
      icon: 'lock-closed-outline',
      title: 'Change Password',
      subtitle: 'Update your password',
      type: 'navigation',
      onPress: () => setShowChangePassword(true),
    },
    {
      icon: 'mail-outline',
      title: 'Email Settings',
      subtitle: 'Manage email preferences',
      type: 'navigation',
      onPress: () => setShowEmailSettings(true),
    },
  ];

  const supportSettings: SettingItem[] = [
    {
      icon: 'help-circle-outline',
      title: 'Help Center',
      subtitle: 'FAQs and support',
      type: 'navigation',
      onPress: () => setShowHelpCenter(true),
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
      onPress: () => Linking.openURL('https://prediction-app-2026.web.app/terms.html'),
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'Privacy Policy',
      type: 'navigation',
      onPress: () => Linking.openURL('https://prediction-app-2026.web.app/privacy.html'),
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

      {/* Modals */}
      <EditProfileModal visible={showEditProfile} onClose={() => setShowEditProfile(false)} />
      <ChangePasswordModal visible={showChangePassword} onClose={() => setShowChangePassword(false)} />
      <EmailSettingsModal visible={showEmailSettings} onClose={() => setShowEmailSettings(false)} />
      <HelpCenterModal visible={showHelpCenter} onClose={() => setShowHelpCenter(false)} />
    </View>
  );
}

function createModalStyles() { return StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.overlay },
  container: { flex: 1, backgroundColor: Colors.background, marginTop: 80, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xxl },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  body: {},
  label: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary, marginBottom: Spacing.sm, marginTop: Spacing.lg },
  input: { backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 14, fontSize: FontSize.lg, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  hint: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: Spacing.sm },
  saveButton: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.lg, alignItems: 'center', marginTop: Spacing.xxl },
  saveText: { color: '#fff', fontSize: FontSize.lg, fontWeight: '700' },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  emailText: { fontSize: FontSize.lg, color: Colors.textPrimary },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  toggleInfo: { flex: 1, marginRight: Spacing.md },
  toggleTitle: { fontSize: FontSize.lg, fontWeight: '500', color: Colors.textPrimary },
  toggleSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
}); }

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
