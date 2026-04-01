import { useEffect, useState, createContext, useContext } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { apiClient } from '../lib/api-client';
import { onAuthChange, getStoredToken, type AuthUser } from '../lib/auth';
import { Colors, onThemeChange, type ThemePalette } from '../lib/colors';
import { ToastProvider, ConfirmProvider, ErrorBoundary } from '../lib/components';
import { registerForPushNotifications, onNotificationTap, clearBadge } from '../lib/notifications';

// Theme context — allows any screen to trigger re-render on theme change
const ThemeContext = createContext<{ colors: ThemePalette; themeKey: number }>({ colors: Colors, themeKey: 0 });
export function useTheme() { return useContext(ThemeContext); }

// Prevent splash screen from auto-hiding (safe — ignore errors)
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  // Force full remount when theme changes (ensures StyleSheet.create picks up new Colors)
  const [themeKey, setThemeKey] = useState(0);

  useEffect(() => {
    const unsub = onThemeChange(() => setThemeKey(t => t + 1));
    return unsub;
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    let settled = false;
    const markReady = () => { if (!settled) { settled = true; setAuthReady(true); } };

    const unsubscribe = onAuthChange(async (authUser) => {
      setUser(authUser);
      if (authUser) {
        const token = await getStoredToken();
        apiClient.setAuthToken(token);
      } else {
        apiClient.setAuthToken(null);
      }
      markReady();
    });

    const timeout = setTimeout(markReady, 3000);
    return () => { unsubscribe(); clearTimeout(timeout); };
  }, []);

  // Route guard
  useEffect(() => {
    if (!authReady) return;
    const inAuthGroup = segments[0] === 'auth';
    if (!user && !inAuthGroup) router.replace('/auth');
    else if (user && inAuthGroup) router.replace('/(tabs)');
  }, [user, authReady, segments]);

  // Register push notifications when user is authenticated
  useEffect(() => {
    if (!user) return;
    registerForPushNotifications();
    clearBadge();
    const unsub = onNotificationTap((response) => {
      const data = response.notification.request.content.data;
      // Navigate based on notification type
      if (data?.marketId) router.push(`/market/${data.marketId}` as any);
      else if (data?.screen) router.push(data.screen as any);
    });
    return unsub;
  }, [user]);

  // Hide splash
  useEffect(() => {
    if (authReady) SplashScreen.hideAsync().catch(() => {});
  }, [authReady]);

  if (!authReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F5F5F7', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#16A34A" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
    <ThemeContext.Provider value={{ colors: Colors, themeKey }}>
    <SafeAreaProvider>
      <ToastProvider>
      <ConfirmProvider>
      <StatusBar style={Colors.statusBarStyle} />
      <Stack
        key={`theme-${themeKey}`}
        screenOptions={{
          headerStyle: { backgroundColor: Colors.headerBg },
          headerTintColor: Colors.headerText,
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="market/[id]"
          options={{ title: 'Market Details', presentation: 'card' }}
        />
      </Stack>
      </ConfirmProvider>
      </ToastProvider>
    </SafeAreaProvider>
    </ThemeContext.Provider>
    </ErrorBoundary>
  );
}
