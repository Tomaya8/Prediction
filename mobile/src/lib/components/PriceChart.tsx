// Price History Chart Component
// Shows probability % over time like Polymarket

import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Path, Line, Circle, G, Text as SvgText } from 'react-native-svg';
import { Colors } from '../colors';

export interface PricePoint {
  timestamp: number; // Unix timestamp
  price: number; // 0-1 probability
}

interface PriceChartProps {
  data: PricePoint[];
  width?: number;
  height?: number;
  showTimeRange?: boolean;
}

const TIME_RANGES = [
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
  { label: '30d', hours: 720 },
  { label: 'All', hours: Infinity },
];

export const PriceChart: React.FC<PriceChartProps> = ({
  data,
  width = Dimensions.get('window').width - 48,
  height = 200,
  showTimeRange = true,
}) => {
  const [selectedRange, setSelectedRange] = useState(1); // Default to 7d

  // Filter data based on selected time range
  const now = Date.now();
  const filterHours = TIME_RANGES[selectedRange].hours;
  const filteredData = data.filter(
    (point) => now - point.timestamp <= filterHours * 60 * 60 * 1000
  );

  // If no data, show placeholder
  if (filteredData.length === 0) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.placeholderText}>No data available</Text>
      </View>
    );
  }

  // Calculate chart dimensions
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Find min/max for scaling
  const prices = filteredData.map((d) => d.price);
  const minPrice = Math.min(...prices) * 0.9; // 10% buffer
  const maxPrice = Math.max(...prices) * 1.1;
  const priceRange = maxPrice - minPrice || 1;

  const timestamps = filteredData.map((d) => d.timestamp);
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const timeRange = maxTime - minTime || 1;

  // Convert data points to chart coordinates
  const getX = (timestamp: number) =>
    padding.left + ((timestamp - minTime) / timeRange) * chartWidth;
  const getY = (price: number) =>
    padding.top + chartHeight - ((price - minPrice) / priceRange) * chartHeight;

  // Create SVG path
  const pathData = filteredData
    .map((point, index) => {
      const x = getX(point.timestamp);
      const y = getY(point.price);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  // Get current price (latest)
  const currentPrice = filteredData[filteredData.length - 1]?.price || 0;

  // Get price change
  const firstPrice = filteredData[0]?.price || 0;
  const priceChange = currentPrice - firstPrice;

  return (
    <View style={styles.wrapper}>
      {/* Current Price & Change */}
      <View style={styles.header}>
        <Text style={styles.currentPrice}>{(currentPrice * 100).toFixed(1)}%</Text>
        <View style={[styles.changeBadge, priceChange >= 0 ? styles.positive : styles.negative]}>
          <Text style={[styles.changeText, priceChange >= 0 ? styles.positiveText : styles.negativeText]}>
            {priceChange >= 0 ? '+' : ''}{(priceChange * 100).toFixed(1)}%
          </Text>
        </View>
      </View>

      {/* Chart */}
      <Svg width={width} height={height}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = padding.top + chartHeight * (1 - tick);
          return (
            <G key={tick}>
              <Line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke={Colors.border}
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              <SvgText
                x={padding.left - 5}
                y={y + 4}
                fontSize={10}
                fill={Colors.textSecondary}
                textAnchor="end"
              >
                {Math.round(tick * 100)}%
              </SvgText>
            </G>
          );
        })}

        {/* Price line */}
        <Path
          d={pathData}
          stroke={priceChange >= 0 ? Colors.yes : Colors.no}
          strokeWidth={2}
          fill="none"
        />

        {/* Data points */}
        {filteredData.length <= 20 &&
          filteredData.map((point, index) => (
            <Circle
              key={index}
              cx={getX(point.timestamp)}
              cy={getY(point.price)}
              r={4}
              fill={priceChange >= 0 ? Colors.yes : Colors.no}
            />
          ))}

        {/* Current price indicator */}
        <Circle
          cx={getX(filteredData[filteredData.length - 1].timestamp)}
          cy={getY(currentPrice)}
          r={6}
          fill={priceChange >= 0 ? Colors.yes : Colors.no}
          stroke={Colors.background}
          strokeWidth={2}
        />
      </Svg>

      {/* Time Range Selector */}
      {showTimeRange && (
        <View style={styles.timeRangeContainer}>
          {TIME_RANGES.map((range, index) => (
            <TouchableOpacity
              key={range.label}
              style={[styles.timeRangeButton, selectedRange === index && styles.timeRangeActive]}
              onPress={() => setSelectedRange(index)}
            >
              <Text style={[styles.timeRangeText, selectedRange === index && styles.timeRangeTextActive]}>
                {range.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

// Generate mock price history data
export const generateMockPriceHistory = (basePrice: number, days: number = 30): PricePoint[] => {
  const points: PricePoint[] = [];
  const now = Date.now();
  const msPerHour = 60 * 60 * 1000;
  const hoursBack = days * 24;
  
  let currentPrice = basePrice + (Math.random() - 0.5) * 0.3;
  
  for (let i = hoursBack; i >= 0; i -= 4) { // Every 4 hours
    const timestamp = now - i * msPerHour;
    // Random walk with mean reversion
    currentPrice += (basePrice - currentPrice) * 0.02 + (Math.random() - 0.5) * 0.05;
    currentPrice = Math.max(0.05, Math.min(0.95, currentPrice));
    
    points.push({ timestamp, price: currentPrice });
  }
  
  return points;
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
    alignItems: 'center',
    marginBottom: 8,
  },
  currentPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  changeBadge: {
    marginLeft: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  positive: {
    backgroundColor: Colors.yes + '20',
  },
  negative: {
    backgroundColor: Colors.no + '20',
  },
  changeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  positiveText: {
    color: Colors.yes,
  },
  negativeText: {
    color: Colors.no,
  },
  placeholderText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  timeRangeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  timeRangeActive: {
    backgroundColor: Colors.primary,
  },
  timeRangeText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  timeRangeTextActive: {
    color: Colors.textPrimary,
  },
});

export default PriceChart;
