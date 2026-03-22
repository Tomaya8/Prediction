/**
 * PredictSpinz Theme System
 * Supports light + dark mode with consistent design tokens.
 */

import { Appearance } from 'react-native';

// ─── Spacing Scale ───────────────────────────────────────────────────────────
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// ─── Border Radius ───────────────────────────────────────────────────────────
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

// ─── Font Sizes ──────────────────────────────────────────────────────────────
export const FontSize = {
  xs: 11,
  sm: 13,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  title: 28,
} as const;

// ─── Theme Palettes ──────────────────────────────────────────────────────────

const darkPalette = {
  // Backgrounds
  background: '#13131A',
  surface: '#1E1E2E',
  surfaceHighlight: '#2A2A3D',
  card: '#1E1E2E',

  // Text — improved contrast ratios
  textPrimary: '#FFFFFF',
  textSecondary: '#B0B0C0',   // was #A0A0B0 — bumped for WCAG AA
  textMuted: '#808090',       // was #666666 — bumped for accessibility

  // Accents
  primary: '#22C55E',
  primaryMuted: 'rgba(34, 197, 94, 0.15)',
  secondary: '#3B82F6',
  danger: '#EF4444',
  dangerMuted: 'rgba(239, 68, 68, 0.15)',
  warning: '#F59E0B',
  warningMuted: 'rgba(245, 158, 11, 0.15)',
  accent: '#8B5CF6',

  // Outcomes
  yes: '#22C55E',
  no: '#EF4444',

  // Medals
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',

  // Structure
  border: '#2A2A3D',
  overlay: 'rgba(0, 0, 0, 0.6)',
  inputBg: '#13131A',

  // Tab bar
  tabBar: '#1E1E2E',
  tabBorder: '#2A2A3D',
  tabActive: '#22C55E',
  tabInactive: '#808090',

  // Header
  headerBg: '#13131A',
  headerText: '#FFFFFF',

  // Status bar
  statusBarStyle: 'light' as const,
};

const lightPalette = {
  // Backgrounds
  background: '#F5F5F7',
  surface: '#FFFFFF',
  surfaceHighlight: '#F0F0F5',
  card: '#FFFFFF',

  // Text
  textPrimary: '#1A1A2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',

  // Accents
  primary: '#16A34A',
  primaryMuted: 'rgba(22, 163, 74, 0.10)',
  secondary: '#2563EB',
  danger: '#DC2626',
  dangerMuted: 'rgba(220, 38, 38, 0.10)',
  warning: '#D97706',
  warningMuted: 'rgba(217, 119, 6, 0.10)',
  accent: '#7C3AED',

  // Outcomes
  yes: '#16A34A',
  no: '#DC2626',

  // Medals
  gold: '#D4A017',
  silver: '#9E9E9E',
  bronze: '#A0522D',

  // Structure
  border: '#E5E7EB',
  overlay: 'rgba(0, 0, 0, 0.4)',
  inputBg: '#F5F5F7',

  // Tab bar
  tabBar: '#FFFFFF',
  tabBorder: '#E5E7EB',
  tabActive: '#16A34A',
  tabInactive: '#9CA3AF',

  // Header
  headerBg: '#FFFFFF',
  headerText: '#1A1A2E',

  // Status bar
  statusBarStyle: 'dark' as const,
};

// ─── Theme Manager ───────────────────────────────────────────────────────────

export type ThemePalette = Omit<typeof darkPalette, 'statusBarStyle'> & { statusBarStyle: 'light' | 'dark' };
export type ThemeMode = 'light' | 'dark' | 'system';

let currentMode: ThemeMode = 'light';
const themeListeners: Array<(palette: ThemePalette) => void> = [];

function resolveMode(): 'light' | 'dark' {
  if (currentMode === 'system') {
    return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
  }
  return currentMode;
}

function getResolvedPalette(): ThemePalette {
  return resolveMode() === 'dark' ? darkPalette : lightPalette;
}

/** Mutable Colors object — updated in place when theme changes so all
 *  screens referencing `Colors.xxx` see the new values immediately. */
export const Colors: ThemePalette = { ...lightPalette };

function applyTheme() {
  const palette = getResolvedPalette();
  // Mutate the shared Colors object in place
  Object.assign(Colors, palette);
  themeListeners.forEach(fn => fn(palette));
}

export function setThemeMode(mode: ThemeMode) {
  currentMode = mode;
  applyTheme();
}

export function getThemeMode(): ThemeMode {
  return currentMode;
}

export function getColors(): ThemePalette {
  return getResolvedPalette();
}

/** Subscribe to theme changes — returns unsubscribe function */
export function onThemeChange(fn: (palette: ThemePalette) => void): () => void {
  themeListeners.push(fn);
  return () => {
    const i = themeListeners.indexOf(fn);
    if (i >= 0) themeListeners.splice(i, 1);
  };
}

export default Colors;
