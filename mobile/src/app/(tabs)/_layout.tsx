import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../lib/colors';
import { useStyles } from '../../lib/useStyles';
import { getStoredUser, signOut, type AuthUser } from '../../lib/auth';
import { apiClient } from '../../lib/api-client';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Hamburger button ────────────────────────────────────────────────────────
function HamburgerIcon({ onPress, styles }: { onPress: () => void; styles: ReturnType<typeof createStyles> }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.hamburgerButton}>
      <Ionicons name="menu-outline" size={26} color={Colors.headerText} />
    </TouchableOpacity>
  );
}

// ─── Single menu row ─────────────────────────────────────────────────────────
function MenuItem({
  icon,
  title,
  onPress,
  danger,
  styles,
}: {
  icon: IoniconsName;
  title: string;
  onPress: () => void;
  danger?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIconWrap, danger && styles.menuIconWrapDanger]}>
        <Ionicons
          name={icon}
          size={20}
          color={danger ? Colors.danger : Colors.textSecondary}
        />
      </View>
      <Text style={[styles.menuTitle, danger && styles.menuTitleDanger]}>{title}</Text>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

// ─── Bottom-tab icon ─────────────────────────────────────────────────────────
function TabIcon({
  name,
  focused,
}: {
  name: 'index' | 'portfolio' | 'leaderboard' | 'profile';
  focused: boolean;
}) {
  const map: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
    index:       { active: 'trending-up',   inactive: 'trending-up-outline' },
    portfolio:   { active: 'bar-chart',     inactive: 'bar-chart-outline' },
    leaderboard: { active: 'trophy',        inactive: 'trophy-outline' },
    profile:     { active: 'person',        inactive: 'person-outline' },
  };
  const { active, inactive } = map[name];
  return (
    <Ionicons
      name={focused ? active : inactive}
      size={22}
      color={focused ? Colors.tabActive : Colors.tabInactive}
    />
  );
}

// ─── Main layout ─────────────────────────────────────────────────────────────
export default function TabLayout() {
  const styles = useStyles(createStyles);
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    getStoredUser().then(setUser);
    apiClient.getProfile().then(res => {
      if (res.success && res.data) {
        setUser(prev =>
          prev ? { ...prev, creditBalance: res.data!.creditBalance } : prev
        );
      }
    });
  }, [menuVisible]);

  const closeMenu = () => setMenuVisible(false);

  const menuItems: { icon: IoniconsName; title: string; href: string }[] = [
    { icon: 'trophy-outline',     title: 'Tournaments',            href: '/(tabs)/tournaments' },
    { icon: 'people-outline',     title: 'Friends & Challenges',   href: '/(tabs)/friends' },
    { icon: 'receipt-outline',    title: 'Transaction History',    href: '/(tabs)/transactions' },
    { icon: 'ribbon-outline',     title: 'Achievements',           href: '/(tabs)/achievements' },
    { icon: 'bulb-outline',       title: 'Propose Market',         href: '/(tabs)/create-market' },
    { icon: 'cart-outline',       title: 'Credit Store',           href: '/(tabs)/store' },
    { icon: 'settings-outline',   title: 'Settings',               href: '/(tabs)/settings' },
  ];

  const handleSignOut = async () => {
    closeMenu();
    await signOut();
    apiClient.setAuthToken(null);
    router.replace('/auth');
  };

  const initials = user?.displayName
    ? user.displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.charAt(0).toUpperCase() ?? 'U';

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarStyle: {
            backgroundColor: Colors.tabBar,
            borderTopColor: Colors.tabBorder,
            borderTopWidth: 1,
            height: 70,
            paddingBottom: 10,
            paddingTop: 8,
          },
          tabBarActiveTintColor: Colors.tabActive,
          tabBarInactiveTintColor: Colors.tabInactive,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          headerStyle: { backgroundColor: Colors.headerBg },
          headerTintColor: Colors.headerText,
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: () => <HamburgerIcon onPress={() => setMenuVisible(true)} styles={styles} />,
        }}
      >
        {/* ── Visible bottom tabs ── */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Markets',
            headerTitle: 'Predich',
            tabBarIcon: ({ focused }) => <TabIcon name="index" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="portfolio"
          options={{
            title: 'Portfolio',
            headerTitle: 'Your Portfolio',
            tabBarIcon: ({ focused }) => <TabIcon name="portfolio" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{
            title: 'Rankings',
            headerTitle: 'Leaderboard',
            tabBarIcon: ({ focused }) => <TabIcon name="leaderboard" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            headerTitle: 'Your Profile',
            tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} />,
          }}
        />

        {/* ── Hidden routes (hamburger menu only) ── */}
        <Tabs.Screen name="tournaments"   options={{ href: null }} />
        <Tabs.Screen name="friends"       options={{ href: null }} />
        <Tabs.Screen name="transactions"  options={{ href: null }} />
        <Tabs.Screen name="achievements"  options={{ href: null }} />
        <Tabs.Screen name="create-market" options={{ href: null }} />
        <Tabs.Screen name="store"         options={{ href: null, headerTitle: 'Credit Store' }} />
        <Tabs.Screen name="settings"      options={{ href: null }} />
      </Tabs>

      {/* ── Side drawer ── */}
      <Modal
        visible={menuVisible}
        animationType="slide"
        transparent
        onRequestClose={closeMenu}
      >
        <Pressable style={styles.overlay} onPress={closeMenu}>
          <View style={styles.drawer} onStartShouldSetResponder={() => true}>

            {/* User card */}
            <View style={styles.userCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {user?.displayName ?? user?.email ?? 'User'}
                </Text>
                <View style={styles.balanceRow}>
                  <Ionicons name="diamond-outline" size={13} color={Colors.warning} />
                  <Text style={styles.balanceText}>
                    {user?.creditBalance?.toLocaleString() ?? '—'} credits
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={closeMenu} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Nav items */}
            <View style={styles.navSection}>
              {menuItems.map((item, i) => (
                <MenuItem
                  key={i}
                  icon={item.icon}
                  title={item.title}
                  styles={styles}
                  onPress={() => {
                    closeMenu();
                    router.push(item.href as any);
                  }}
                />
              ))}
            </View>

            {/* Sign out + disclaimer */}
            <View style={styles.drawerFooter}>
              <MenuItem
                icon="log-out-outline"
                title="Sign Out"
                onPress={handleSignOut}
                danger
                styles={styles}
              />
              <Text style={styles.disclaimer}>
                Credits have no real-world value.{'\n'}This is not gambling.
              </Text>
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function createStyles() { return StyleSheet.create({
  hamburgerButton: {
    padding: 10,
    marginLeft: 6,
  },

  // Overlay + drawer
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
  },
  drawer: {
    width: 290,
    height: '100%',
    backgroundColor: Colors.surface,
    paddingTop: 54,
  },

  // User card
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  balanceText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  closeBtn: { padding: 4 },

  // Nav items
  navSection: {
    flex: 1,
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconWrapDanger: {
    backgroundColor: Colors.dangerMuted,
  },
  menuTitle: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  menuTitleDanger: {
    color: Colors.danger,
  },

  // Footer
  drawerFooter: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: 20,
  },
  disclaimer: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
}); }
