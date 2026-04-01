/**
 * RevenueCat In-App Purchases service for Predich.
 *
 * Products configured in RevenueCat dashboard:
 * - Credit packs (consumable): predich_credits_500, predich_credits_2000, predich_credits_10000
 * - Subscriptions: monthly, yearly, lifetime
 * - Entitlement: "Predich Pro"
 */

import Purchases, {
  LOG_LEVEL,
  PurchasesOffering,
  PurchasesPackage,
  CustomerInfo,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import { apiClient } from './api-client';

// RevenueCat API key (same key works for both platforms when using cross-platform project)
const REVENUECAT_API_KEY = 'test_satzaAKftYqaxLMdPcRtBMUhnBj';

// Product ID → credits mapping (must match App Store Connect / Play Console)
const CREDIT_PRODUCTS: Record<string, number> = {
  predich_credits_500: 500,
  predich_credits_2000: 2000,
  predich_credits_10000: 10000,
};

// Entitlement identifier — must match RevenueCat dashboard
const PRO_ENTITLEMENT = 'Predich Pro';

let isConfigured = false;

// ─── Configuration ──────────────────────────────────────────────────────────

/**
 * Initialize RevenueCat. Call once at app startup after auth.
 */
export async function configurePurchases(userId: string): Promise<void> {
  if (isConfigured) return;

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  Purchases.configure({
    apiKey: REVENUECAT_API_KEY,
    appUserID: userId,
  });

  // Listen for CustomerInfo updates (subscription changes, renewals, cancellations)
  Purchases.addCustomerInfoUpdateListener((info) => {
    const isPro = info.entitlements.active[PRO_ENTITLEMENT] !== undefined;
    // Sync premium status to backend whenever it changes
    apiClient.updateUser('me', { isPremium: isPro }).catch(() => {});
  });

  isConfigured = true;
}

// ─── Offerings ──────────────────────────────────────────────────────────────

/**
 * Fetch available offerings from RevenueCat.
 */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (e) {
    console.error('Failed to fetch offerings:', e);
    return null;
  }
}

// ─── Credit Pack Purchases (consumables) ────────────────────────────────────

/**
 * Purchase a credit pack. On success, calls the backend to grant credits.
 */
export async function purchaseCreditPack(
  pkg: PurchasesPackage
): Promise<{ success: boolean; credits?: number; error?: string }> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);

    const productId = pkg.product.identifier;
    const credits = CREDIT_PRODUCTS[productId];

    if (!credits) {
      return { success: false, error: 'Unknown product' };
    }

    // Grant credits on backend
    const res = await apiClient.buyCredits(productId);
    if (!res.success) {
      return { success: false, error: res.error || 'Failed to grant credits' };
    }

    return { success: true, credits };
  } catch (e: any) {
    return handlePurchaseError(e);
  }
}

// ─── Subscription Purchases ─────────────────────────────────────────────────

/**
 * Purchase a subscription package (monthly, yearly, or lifetime).
 */
export async function purchaseSubscription(
  pkg: PurchasesPackage
): Promise<{ success: boolean; error?: string }> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const isPro = customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;

    if (isPro) {
      await apiClient.updateUser('me', { isPremium: true });
      return { success: true };
    }

    return { success: false, error: 'Subscription not activated' };
  } catch (e: any) {
    return handlePurchaseError(e);
  }
}

// ─── Customer Info & Entitlements ───────────────────────────────────────────

/**
 * Get current customer info from RevenueCat.
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

/**
 * Check if user has active "Predich Pro" entitlement.
 */
export async function checkProStatus(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;
  } catch {
    return false;
  }
}

/**
 * Get detailed entitlement info (expiration, will renew, etc.)
 */
export async function getProEntitlementInfo() {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const entitlement = customerInfo.entitlements.active[PRO_ENTITLEMENT];
    if (!entitlement) return null;
    return {
      isActive: true,
      willRenew: entitlement.willRenew,
      expirationDate: entitlement.expirationDate,
      productIdentifier: entitlement.productIdentifier,
      isSandbox: entitlement.isSandbox,
    };
  } catch {
    return null;
  }
}

// ─── Restore Purchases ──────────────────────────────────────────────────────

/**
 * Restore previous purchases (required by App Store guidelines).
 */
export async function restorePurchases(): Promise<CustomerInfo | null> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    // Sync pro status to backend
    const isPro = customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;
    await apiClient.updateUser('me', { isPremium: isPro }).catch(() => {});
    return customerInfo;
  } catch (e) {
    console.error('Restore failed:', e);
    return null;
  }
}

// ─── Error Handling ─────────────────────────────────────────────────────────

function handlePurchaseError(e: any): { success: false; error: string } {
  if (e.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
    return { success: false, error: 'cancelled' };
  }
  if (e.code === PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR) {
    return { success: false, error: 'You already own this product. Try restoring purchases.' };
  }
  if (e.code === PURCHASES_ERROR_CODE.NETWORK_ERROR) {
    return { success: false, error: 'Network error. Please check your connection and try again.' };
  }
  if (e.code === PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR) {
    return { success: false, error: 'Store is temporarily unavailable. Please try again later.' };
  }
  console.error('Purchase error:', e);
  return { success: false, error: e.message || 'Purchase failed. Please try again.' };
}

// ─── Exports ────────────────────────────────────────────────────────────────

export { PRO_ENTITLEMENT, CREDIT_PRODUCTS };
