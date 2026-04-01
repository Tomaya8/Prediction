import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RevenueCatUI from 'react-native-purchases-ui';
import { Colors, Spacing, Radius, FontSize } from '../../lib/colors';
import { useStyles } from '../../lib/useStyles';
import {
  configurePurchases,
  getOfferings,
  purchaseCreditPack,
  checkProStatus,
  restorePurchases,
  getProEntitlementInfo,
  PRO_ENTITLEMENT,
} from '../../lib/purchases';
import { preloadRewardedAd, showRewardedAd, isAdReady, remainingAdsToday, CREDITS_PER_AD } from '../../lib/ads';
import { apiClient } from '../../lib/api-client';
import { getStoredUser } from '../../lib/auth';
import { showToast } from '../../lib/components';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

// Fallback display data when offerings haven't loaded yet
const FALLBACK_PACKS = [
  { id: 'predich_credits_500', name: 'Starter Pack', credits: 500, price: '$0.99', icon: 'flash-outline' as const },
  { id: 'predich_credits_2000', name: 'Pro Pack', credits: 2000, price: '$4.99', icon: 'trending-up-outline' as const },
  { id: 'predich_credits_10000', name: 'Whale Pack', credits: 10000, price: '$19.99', icon: 'diamond-outline' as const },
];

export default function StoreScreen() {
  const styles = useStyles(createStyles);
  const [loading, setLoading] = useState(true);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [proInfo, setProInfo] = useState<{ willRenew: boolean; expirationDate: string | null } | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [adReady, setAdReady] = useState(false);
  const [adsRemaining, setAdsRemaining] = useState(0);
  const [watchingAd, setWatchingAd] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showCustomerCenter, setShowCustomerCenter] = useState(false);

  useEffect(() => {
    initStore();
  }, []);

  const initStore = async () => {
    try {
      const profileRes = await apiClient.getProfile();
      if (profileRes.success && profileRes.data) {
        setBalance(profileRes.data.creditBalance);
      }

      const user = await getStoredUser();
      if (user) {
        await configurePurchases(user.id);
        const off = await getOfferings();
        setOffering(off);
        setIsPro(await checkProStatus());
        const info = await getProEntitlementInfo();
        if (info) setProInfo({ willRenew: info.willRenew, expirationDate: info.expirationDate });
      }

      preloadRewardedAd();
      setAdReady(isAdReady());
      setAdsRemaining(remainingAdsToday());
    } catch (e) {
      console.error('Store init error:', e);
    } finally {
      setLoading(false);
    }
  };

  const refreshBalance = useCallback(async () => {
    const profileRes = await apiClient.getProfile();
    if (profileRes.success && profileRes.data) setBalance(profileRes.data.creditBalance);
  }, []);

  // ── Ad reward ─────────────────────────────────────────────────────────────

  const handleWatchAd = async () => {
    setWatchingAd(true);
    const result = await showRewardedAd();
    if (result) {
      const res = await apiClient.claimAdReward();
      if (res.success && res.data) {
        setBalance(res.data.newBalance);
        setAdsRemaining(res.data.adsRemaining);
        showToast({ message: `+${res.data.credits} credits for watching ad!`, type: 'success' });
      }
    }
    setWatchingAd(false);
    setAdReady(isAdReady());
  };

  // ── Credit pack purchase ──────────────────────────────────────────────────

  const handleBuyCredits = async (pkg: PurchasesPackage) => {
    setPurchasing(pkg.product.identifier);
    const result = await purchaseCreditPack(pkg);
    setPurchasing(null);
    if (result.success) {
      showToast({ message: `+${result.credits} credits added!`, type: 'success' });
      refreshBalance();
    } else if (result.error !== 'cancelled') {
      Alert.alert('Purchase Failed', result.error);
    }
  };

  // ── Restore ───────────────────────────────────────────────────────────────

  const handleRestore = async () => {
    setPurchasing('restore');
    const info = await restorePurchases();
    setPurchasing(null);
    if (info) {
      const pro = info.entitlements.active[PRO_ENTITLEMENT] !== undefined;
      setIsPro(pro);
      Alert.alert('Restored', pro ? 'Predich Pro restored!' : 'No active subscriptions found.');
      refreshBalance();
    } else {
      Alert.alert('Error', 'Failed to restore purchases.');
    }
  };

  // ── Paywall callbacks ─────────────────────────────────────────────────────

  const handlePaywallDismiss = async () => {
    setShowPaywall(false);
    // Refresh pro status after paywall interaction
    setIsPro(await checkProStatus());
    const info = await getProEntitlementInfo();
    if (info) setProInfo({ willRenew: info.willRenew, expirationDate: info.expirationDate });
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  // Subscription products use store identifiers: monthly, yearly, lifetime
  const SUBSCRIPTION_IDS = new Set(['monthly', 'yearly', 'lifetime']);
  const creditPackages = offering?.availablePackages.filter(
    p => !SUBSCRIPTION_IDS.has(p.product.identifier)
  ) || [];

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* RevenueCat Paywall Modal */}
      {showPaywall && (
        <RevenueCatUI.Paywall
          onDismiss={handlePaywallDismiss}
          onPurchaseCompleted={async ({ customerInfo }) => {
            const pro = customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;
            if (pro) {
              setIsPro(true);
              showToast({ message: 'Predich Pro activated!', type: 'success' });
            }
          }}
          onRestoreCompleted={async ({ customerInfo }) => {
            const pro = customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;
            setIsPro(pro);
            if (pro) showToast({ message: 'Predich Pro restored!', type: 'success' });
          }}
        />
      )}

      {/* RevenueCat Customer Center Modal */}
      {showCustomerCenter && (
        <RevenueCatUI.CustomerCenterView
          onDismiss={() => setShowCustomerCenter(false)}
        />
      )}

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Balance Header */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Your Balance</Text>
          <Text style={styles.balanceValue}>{balance?.toLocaleString() ?? '—'} credits</Text>
          {isPro && (
            <View style={styles.proBadgeSmall}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.proBadgeSmallText}>PRO</Text>
            </View>
          )}
        </View>

        {/* Free Credits — Watch Ad */}
        <Text style={styles.sectionTitle}>Free Credits</Text>
        <TouchableOpacity
          style={[styles.adCard, (!adReady || watchingAd) && styles.adCardDisabled]}
          onPress={handleWatchAd}
          disabled={!adReady || watchingAd}
        >
          <View style={styles.adIcon}>
            <Ionicons name="play-circle-outline" size={28} color={adReady ? Colors.primary : Colors.textMuted} />
          </View>
          <View style={styles.packInfo}>
            <Text style={styles.packName}>Watch Ad</Text>
            <Text style={styles.packDescription}>
              +{CREDITS_PER_AD} credits ({adsRemaining} remaining today)
            </Text>
          </View>
          <View style={[styles.packPrice, !adReady && { backgroundColor: Colors.textMuted }]}>
            {watchingAd ? (
              <ActivityIndicator size="small" color={Colors.textPrimary} />
            ) : (
              <Text style={styles.packPriceText}>FREE</Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Credit Packs */}
        <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>Credit Packs</Text>

        {creditPackages.length > 0 ? (
          creditPackages.map((pkg) => (
            <TouchableOpacity
              key={pkg.product.identifier}
              style={styles.packCard}
              onPress={() => handleBuyCredits(pkg)}
              disabled={purchasing !== null}
            >
              <View style={styles.packIcon}>
                <Ionicons name="flash-outline" size={24} color={Colors.primary} />
              </View>
              <View style={styles.packInfo}>
                <Text style={styles.packName}>{pkg.product.title}</Text>
                <Text style={styles.packDescription}>{pkg.product.description}</Text>
              </View>
              <View style={styles.packPrice}>
                {purchasing === pkg.product.identifier ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Text style={styles.packPriceText}>{pkg.product.priceString}</Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        ) : (
          FALLBACK_PACKS.map((pack) => (
            <TouchableOpacity
              key={pack.id}
              style={styles.packCard}
              onPress={() => Alert.alert('Coming Soon', 'Credit packs will be available once products are configured in App Store Connect / Google Play Console.')}
            >
              <View style={styles.packIcon}>
                <Ionicons name={pack.icon} size={24} color={Colors.primary} />
              </View>
              <View style={styles.packInfo}>
                <Text style={styles.packName}>{pack.name}</Text>
                <Text style={styles.packDescription}>{pack.credits.toLocaleString()} credits</Text>
              </View>
              <View style={styles.packPrice}>
                <Text style={styles.packPriceText}>{pack.price}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Predich Pro — opens RevenueCat Paywall */}
        <Text style={[styles.sectionTitle, { marginTop: Spacing.xxl }]}>Predich Pro</Text>
        <View style={styles.premiumCard}>
          <View style={styles.premiumHeader}>
            <Ionicons name="star" size={24} color="#FFD700" />
            <Text style={styles.premiumTitle}>Predich Pro</Text>
            {isPro && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>ACTIVE</Text>
              </View>
            )}
          </View>
          <View style={styles.premiumFeatures}>
            {[
              '2x daily reward bonus',
              'Free market proposals',
              'Advanced portfolio analytics',
              'Historical performance charts',
              'Early access to new markets',
              'Custom price alerts',
            ].map((feature, i) => (
              <View key={i} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                <Text style={styles.featureItem}>{feature}</Text>
              </View>
            ))}
          </View>

          {isPro ? (
            <View>
              {proInfo && (
                <Text style={styles.proStatusText}>
                  {proInfo.willRenew ? 'Renews' : 'Expires'}: {proInfo.expirationDate ? new Date(proInfo.expirationDate).toLocaleDateString() : 'Lifetime'}
                </Text>
              )}
              <TouchableOpacity
                style={styles.manageButton}
                onPress={() => setShowCustomerCenter(true)}
              >
                <Text style={styles.manageButtonText}>Manage Subscription</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.premiumButton}
              onPress={() => setShowPaywall(true)}
            >
              <Ionicons name="star" size={18} color="#000" />
              <Text style={styles.premiumButtonText}>  View Plans</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Restore Purchases */}
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestore}
          disabled={purchasing !== null}
        >
          {purchasing === 'restore' ? (
            <ActivityIndicator size="small" color={Colors.textSecondary} />
          ) : (
            <Text style={styles.restoreText}>Restore Purchases</Text>
          )}
        </TouchableOpacity>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          Credits have no real-world value and cannot be withdrawn.{'\n'}
          Subscriptions auto-renew unless cancelled 24 hours before the end of the current period.{'\n'}
          Payment will be charged to your App Store / Google Play account.
        </Text>
      </ScrollView>
    </View>
  );
}

function createStyles() { return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.lg,
    paddingBottom: 120,
  },
  balanceCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  balanceLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    marginBottom: Spacing.xs,
  },
  balanceValue: {
    color: Colors.primary,
    fontSize: 32,
    fontWeight: '700',
  },
  proBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFD700' + '20',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    marginTop: Spacing.sm,
  },
  proBadgeSmallText: {
    color: '#FFD700',
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  packCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  packIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  packInfo: {
    flex: 1,
  },
  packName: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  packDescription: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  packPrice: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    minWidth: 70,
    alignItems: 'center',
  },
  packPriceText: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  premiumCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: '#FFD700' + '40',
  },
  premiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  premiumTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '700',
    flex: 1,
  },
  activeBadge: {
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  activeBadgeText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  premiumFeatures: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  featureItem: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  proStatusText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  manageButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  manageButtonText: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  premiumButton: {
    backgroundColor: '#FFD700',
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  premiumButtonText: {
    color: '#000',
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    marginTop: Spacing.lg,
  },
  restoreText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    textDecorationLine: 'underline',
  },
  adCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xxl,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  adCardDisabled: {
    opacity: 0.5,
    borderColor: Colors.border,
  },
  adIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  disclaimer: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.md,
  },
}); }
