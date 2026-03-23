/**
 * Auth service for Predich Mobile.
 * Calls our backend's /api/auth endpoints directly.
 * No Firebase SDK dependency needed — tokens are JWTs stored in SecureStore.
 */

import * as SecureStore from 'expo-secure-store';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://us-central1-prediction-app-2026.cloudfunctions.net/api';

const AUTH_TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  creditBalance: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function storeSession(token: string, user: AuthUser) {
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

async function clearSession() {
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

// ─── Auth state listeners (mimics Firebase onAuthStateChanged pattern) ───────

type AuthChangeCallback = (user: AuthUser | null) => void;
const listeners: AuthChangeCallback[] = [];

function notifyListeners(user: AuthUser | null) {
  listeners.forEach(cb => cb(user));
}

export function onAuthChange(callback: AuthChangeCallback): () => void {
  listeners.push(callback);
  // Fire immediately with current state
  getStoredUser().then(user => callback(user));
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx > -1) listeners.splice(idx, 1);
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!json.success) {
    const err: any = new Error(json.error || 'Sign in failed');
    err.code = json.error; // e.g. 'auth/invalid-credential'
    throw err;
  }
  const { token, user } = json.data;
  await storeSession(token, user);
  notifyListeners(user);
  return user;
}

export async function signUp(
  email: string,
  password: string,
  displayName: string
): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  });
  const json = await res.json();
  if (!json.success) {
    const err: any = new Error(json.error || 'Registration failed');
    err.code = json.error;
    throw err;
  }
  const { token, user } = json.data;
  await storeSession(token, user);
  notifyListeners(user);
  return user;
}

export async function signOut(): Promise<void> {
  await clearSession();
  notifyListeners(null);
}

export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

export async function getStoredUser(): Promise<AuthUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

/** Legacy alias kept for any code that used getIdToken() */
export const getIdToken = getStoredToken;

/** Legacy alias — returns uid string or null */
export async function getStoredUserId(): Promise<string | null> {
  const user = await getStoredUser();
  return user?.id ?? null;
}

export function isAuthenticated(): boolean {
  // Synchronous check not possible with SecureStore — use getStoredUser() instead
  return false;
}

// No-op — kept for backward compat
export const auth = null;
