// Volume Chart Component
// Shows trading volume over time

import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Rect, G, Line, Text as SvgText } from 'react-native-svg';
import { Colors } from '../colors';

export interface VolumePoint {
  timestamp: number;
  volume: number; // Trading volume
}

interface VolumeChartProps {
  data: VolumePoint[];
  width?: number;
  height?: number;
}

export const VolumeChart: React.FC<VolumeChartProps> = ({
  data,
  width = Dimensions.get('window').width - 48,
  height = 100,
}) => {
  if (data.length === 0) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.placeholderText}>No volume data</Text>
      </View>
    );
  }

  const padding = { top: 10, right: 10, bottom: 25, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const volumes = data.map(d => d.volume);
  const maxVolume = Math.max(...volumes) * 1.1;
  
  const timestamps = data.map(d => d.timestamp);
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const timeRange = maxTime - minTime || 1;

  const barWidth = Math.max(2, (chartWidth / data.length) - 2);
  const gap = 2;

  // Calculate total volume
  const totalVolume = volumes.reduce((a, b) => a + b, 0);

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text style={styles.label}>Trading Volume</Text>
        <Text style={styles.total}>{formatVolume(totalVolume)}</Text>
      </View>
      
      <Svg width={width} height={height}>
        {/* Y-axis labels */}
        <SvgText
          x={padding.left - 5}
          y={padding.top + 4}
          fontSize={10}
          fill={Colors.textSecondary}
          textAnchor="end"
        >
          {formatVolumeShort(maxVolume)}
        </SvgText>
        <SvgText
          x={padding.left - 5}
          y={height - padding.bottom + 4}
          fontSize={10}
          fill={Colors.textSecondary}
          textAnchor="end"
        >
          0
        </SvgText>

        {/* Volume bars */}
        {data.map((point, index) => {
          const x = padding.left + (index / data.length) * chartWidth;
          const barHeight = (point.volume / maxVolume) * chartHeight;
          const y = padding.top + chartHeight - barHeight;
          
          return (
            <Rect
              key={index}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={Colors.primary}
              opacity={0.7}
              rx={2}
            />
          );
        })}

        {/* X-axis labels (first and last) */}
        <SvgText
          x={padding.left}
          y={height - 5}
          fontSize={10}
          fill={Colors.textSecondary}
        >
          {formatDate(data[0]?.timestamp)}
        </SvgText>
        <SvgText
          x={width - padding.right}
          y={height - 5}
          fontSize={10}
          fill={Colors.textSecondary}
          textAnchor="end"
        >
          {formatDate(data[data.length - 1]?.timestamp)}
        </SvgText>
      </Svg>
    </View>
  );
};

// Generate mock volume data
export const generateMockVolumeData = (days: number = 30): VolumePoint[] => {
  const points: VolumePoint[] = [];
  const now = Date.now();
  const msPerHour = 60 * 60 * 1000;
  
  for (let i = days * 24; i >= 0; i -= 4) {
    const timestamp = now - i * msPerHour;
    // Random volume between 100 and 10000
    const volume = Math.floor(100 + Math.random() * 9900);
    points.push({ timestamp, volume });
  }
  
  return points;
};

const formatVolume = (volume: number): string => {
  if (volume >= 1000000) {
    return `$${(volume / 1000000).toFixed(1)}M`;
  } else if (volume >= 1000) {
    return `$${(volume / 1000).toFixed(1)}K`;
  }
  return `$${volume}`;
};

const formatVolumeShort = (volume: number): string => {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(1)}M`;
  } else if (volume >= 1000) {
    return `${(volume / 1000).toFixed(0)}K`;
  }
  return `${volume}`;
};

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  total: {
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: 'bold',
  },
  placeholderText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
});

export default VolumeChart;
