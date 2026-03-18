// Firebase Authentication Service for PredictSpinz Mobile App
import { auth } from './firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  User,
  updateProfile
} from 'firebase/auth';
import * as SecureStore from 'expo-secure-store';

// Secure storage keys
const AUTH_TOKEN_KEY = 'auth_token';
const USER_ID_KEY = 'user_id';

// Sign in with email and password
export async function signIn(email: string, password: string): Promise<User | null> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Store token
    const token = await user.getIdToken();
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
    await SecureStore.setItemAsync(USER_ID_KEY, user.uid);
    
    return user;
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  }
}

// Sign up with email and password
export async function signUp(email: string, password: string, displayName: string): Promise<User | null> {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Update display name
    await updateProfile(user, { displayName });
    
    // Store token
    const token = await user.getIdToken();
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
    await SecureStore.setItemAsync(USER_ID_KEY, user.uid);
    
    return user;
  } catch (error) {
    console.error('Sign up error:', error);
    throw error;
  }
}

// Sign out
export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth);
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_ID_KEY);
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

// Get current user
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

// Auth state listener
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

// Get stored user ID
export async function getStoredUserId(): Promise<string | null> {
  return await SecureStore.getItemAsync(USER_ID_KEY);
}

// Get stored auth token
export async function getStoredAuthToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

// Password reset
export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error('Password reset error:', error);
    throw error;
  }
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  return auth.currentUser !== null;
}

// Get ID token
export async function getIdToken(forceRefresh: boolean = false): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  
  try {
    return await user.getIdToken(forceRefresh);
  } catch (error) {
    console.error('Get ID token error:', error);
    return null;
  }
}

export { auth };
