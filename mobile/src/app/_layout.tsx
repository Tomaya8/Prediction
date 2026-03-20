import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { apiClient } from '../lib/api-client';
import { onAuthChange, getStoredToken, type AuthUser } from '../lib/auth';
import { Colors } from '../lib/colors';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange(async (authUser) => {
      setUser(authUser);
      if (authUser) {
        const token = await getStoredToken();
        apiClient.setAuthToken(token);
      } else {
        apiClient.setAuthToken(null);
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
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
    if (authReady) SplashScreen.hideAsync();
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
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#1E1E2E' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: '#1E1E2E' },
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
