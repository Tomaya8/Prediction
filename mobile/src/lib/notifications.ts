/**
 * Push Notifications service for Predich.
 *
 * Uses Expo's push notification service (free, no FCM/APNs setup needed for Expo builds).
 * The Expo push token is sent to the backend and stored on the user document.
 * Backend uses Expo's push API to send notifications.
 *
 * Setup:
 * 1. Add "expo-notifications" to app.json plugins
 * 2. For iOS: configure APNs credentials in EAS (eas credentials)
 * 3. For Android: works out of the box with Expo
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiClient } from './api-client';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and save token to backend.
 * Call once after user signs in.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  // Get Expo push token
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'aaeb5b23-afa5-4df8-b082-5ab05b0074d3', // from app.json
    });
    const token = tokenData.data;

    // Save token to backend
    await apiClient.updateUser('me', { pushToken: token });

    // Android: set notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    return token;
  } catch (e) {
    console.error('Failed to get push token:', e);
    return null;
  }
}

/**
 * Listen for notification taps (when user taps a notification to open the app).
 * Returns an unsubscribe function.
 */
export function onNotificationTap(
  handler: (notification: Notifications.NotificationResponse) => void
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(handler);
  return () => subscription.remove();
}

/**
 * Listen for foreground notifications.
 * Returns an unsubscribe function.
 */
export function onNotificationReceived(
  handler: (notification: Notifications.Notification) => void
): () => void {
  const subscription = Notifications.addNotificationReceivedListener(handler);
  return () => subscription.remove();
}

/**
 * Get the number of unread notifications (badge count).
 */
export async function getBadgeCount(): Promise<number> {
  return Notifications.getBadgeCountAsync();
}

/**
 * Clear badge count.
 */
export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}
