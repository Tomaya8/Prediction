import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius } from '../colors';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = Radius.sm, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width: width as any, height, borderRadius, backgroundColor: Colors.surfaceHighlight, opacity }, style]}
    />
  );
}

export function MarketCardSkeleton() {
  return (
    <View style={skStyles.card}>
      <Skeleton width={80} height={20} style={{ marginBottom: Spacing.md }} />
      <Skeleton width="85%" height={20} style={{ marginBottom: Spacing.sm }} />
      <Skeleton width="60%" height={16} style={{ marginBottom: Spacing.lg }} />
      <View style={skStyles.row}>
        <Skeleton width="45%" height={36} borderRadius={Radius.md} />
        <Skeleton width="45%" height={36} borderRadius={Radius.md} />
      </View>
      <View style={[skStyles.row, { marginTop: Spacing.md }]}>
        <Skeleton width={80} height={12} />
        <Skeleton width={60} height={12} />
      </View>
    </View>
  );
}

export function MarketListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={{ paddingHorizontal: Spacing.lg }}>
      {Array.from({ length: count }).map((_, i) => (
        <MarketCardSkeleton key={i} />
      ))}
    </View>
  );
}

const skStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
