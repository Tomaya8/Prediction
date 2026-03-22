// Firebase configuration for Predich
// Replace values with your actual Firebase project credentials

import { initializeApp, getApps } from 'firebase/app';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { initializeAuth, getAuth } = require('firebase/auth');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getReactNativePersistence } = require('firebase/auth');
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration - UPDATE THESE VALUES
// Download google-services.json from Firebase Console:
// https://console.firebase.google.com/project/prediction-app-2026/settings/general

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: `${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "prediction-app-2026"}.firebaseapp.com`,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "prediction-app-2026",
  storageBucket: `${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "prediction-app-2026"}.appspot.com`,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "YOUR_APP_ID",
};

// Initialize Firebase only once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Auth with AsyncStorage persistence so session survives app restarts
// getReactNativePersistence is available at runtime via Metro's RN bundle (dist/rn/index.js)
let auth: ReturnType<typeof getAuth>;
try {
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
  // Already initialized (e.g. hot reload) — reuse existing instance
  auth = getAuth(app);
}
export { auth };

export const db = getFirestore(app);

export default app;
