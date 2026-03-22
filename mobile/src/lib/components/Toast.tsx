/**
 * Custom Toast / Notification overlay — consistent design across the app.
 * Use instead of Alert.alert for success/error/info messages.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, onThemeChange } from '../colors';

// ─── Toast (auto-dismiss banner) ─────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info';

interface ToastConfig {
  message: string;
  type?: ToastType;
  duration?: number;
}

let showToastFn: ((config: ToastConfig) => void) | null = null;

/** Call from anywhere: showToast({ message: 'Trade placed!', type: 'success' }) */
export function showToast(config: ToastConfig) {
  showToastFn?.(config);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<ToastConfig>({ message: '' });
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = onThemeChange(() => setTick(t => t + 1));
    return unsub;
  }, []);

  const show = useCallback((c: ToastConfig) => {
    setConfig(c);
    setVisible(true);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
    setTimeout(() => {
      Animated.timing(slideAnim, { toValue: -100, duration: 200, useNativeDriver: true }).start(() => setVisible(false));
    }, c.duration || 3000);
  }, [slideAnim]);

  useEffect(() => { showToastFn = show; return () => { showToastFn = null; }; }, [show]);

  const getIcon = (type: ToastType = 'info'): { name: string; color: string } => {
    switch (type) {
      case 'success': return { name: 'checkmark-circle', color: Colors.primary };
      case 'error': return { name: 'alert-circle', color: Colors.danger };
      default: return { name: 'information-circle', color: Colors.secondary };
    }
  };

  const icon = getIcon(config.type);

  return (
    <>
      {children}
      {visible && (
        <Animated.View style={[toastStyles.container, { transform: [{ translateY: slideAnim }] }]}>
          <TouchableOpacity style={toastStyles.inner} activeOpacity={0.9} onPress={() => {
            Animated.timing(slideAnim, { toValue: -100, duration: 150, useNativeDriver: true }).start(() => setVisible(false));
          }}>
            <Ionicons name={icon.name as any} size={22} color={icon.color} />
            <Text style={toastStyles.message} numberOfLines={2}>{config.message}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </>
  );
}

const toastStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 9999,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  message: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});

// ─── Confirm Dialog (replaces Alert.alert for confirmations) ─────────────────

interface ConfirmConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

let showConfirmFn: ((config: ConfirmConfig) => void) | null = null;

export function showConfirm(config: ConfirmConfig) {
  showConfirmFn?.(config);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<ConfirmConfig | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = onThemeChange(() => setTick(t => t + 1));
    return unsub;
  }, []);

  useEffect(() => {
    showConfirmFn = (c) => { setConfig(c); setVisible(true); };
    return () => { showConfirmFn = null; };
  }, []);

  const handleConfirm = () => {
    setVisible(false);
    config?.onConfirm();
  };

  const handleCancel = () => {
    setVisible(false);
    config?.onCancel?.();
  };

  return (
    <>
      {children}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
        <View style={confirmStyles.overlay}>
          <View style={confirmStyles.card}>
            <Text style={confirmStyles.title}>{config?.title}</Text>
            <Text style={confirmStyles.message}>{config?.message}</Text>
            <View style={confirmStyles.actions}>
              <TouchableOpacity style={confirmStyles.cancelBtn} onPress={handleCancel}>
                <Text style={confirmStyles.cancelText}>{config?.cancelText || 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[confirmStyles.confirmBtn, config?.destructive && confirmStyles.confirmBtnDestructive]}
                onPress={handleConfirm}
              >
                <Text style={confirmStyles.confirmText}>{config?.confirmText || 'Confirm'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const confirmStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xxl,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xxl,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  confirmBtnDestructive: {
    backgroundColor: Colors.danger,
  },
  confirmText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
