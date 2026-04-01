/**
 * AdMob Rewarded Video Ads — STUB
 *
 * The react-native-google-mobile-ads package has been temporarily removed
 * because it requires AdMob App IDs to compile. This stub provides the same
 * interface so the Store screen works without ads.
 *
 * To enable ads:
 * 1. npm install react-native-google-mobile-ads
 * 2. Add AdMob app IDs to app.json plugin config
 * 3. Replace this file with the real implementation
 */

export const CREDITS_PER_AD = 50;
export const MAX_ADS_PER_DAY = 5;

export function preloadRewardedAd(): void {
  // No-op: AdMob not installed
}

export function isAdReady(): boolean {
  return false;
}

export function remainingAdsToday(): number {
  return 0;
}

export function showRewardedAd(): Promise<{ credits: number } | null> {
  return Promise.resolve(null);
}
