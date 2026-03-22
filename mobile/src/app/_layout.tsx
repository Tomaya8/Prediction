import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { apiClient } from '../lib/api-client';
import { onAuthChange, getStoredToken, type AuthUser } from '../lib/auth';
import { Colors } from '../lib/colors';

// Prevent splash screen from auto-hiding (safe — ignore errors)
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

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

    // Safety: if onAuthChange never fires (e.g. SecureStore hangs), force ready after 3s
    const timeout = setTimeout(markReady, 3000);

    return () => { unsubscribe(); clearTimeout(timeout); };
  }, []);

  // Route guard: redirect based on auth state
  useEffect(() => {
    if (!authReady) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!user && !inAuthGroup) {
      router.replace('/auth');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, authReady, segments]);

  // Hide splash once auth is determined
  useEffect(() => {
    if (authReady) SplashScreen.hideAsync().catch(() => {});
  }, [authReady]);

  // Show spinner while checking stored credentials
  if (!authReady) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
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
    </SafeAreaProvider>
  );
}
