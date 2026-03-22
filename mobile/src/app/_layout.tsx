import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { apiClient } from '../lib/api-client';
import { onAuthChange, getStoredToken, type AuthUser } from '../lib/auth';
import { Colors, onThemeChange } from '../lib/colors';
import { ToastProvider, ConfirmProvider } from '../lib/components';

// Prevent splash screen from auto-hiding (safe — ignore errors)
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  // Force re-render when theme changes
  const [, setThemeTick] = useState(0);

  // Listen for theme changes — triggers full tree re-render
  useEffect(() => {
    const unsub = onThemeChange(() => setThemeTick(t => t + 1));
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

  // Hide splash
  useEffect(() => {
    if (authReady) SplashScreen.hideAsync().catch(() => {});
  }, [authReady]);

  if (!authReady) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ToastProvider>
      <ConfirmProvider>
      <StatusBar style={Colors.statusBarStyle} />
      <Stack
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
  );
}
