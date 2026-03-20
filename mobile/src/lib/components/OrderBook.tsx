import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../colors';

export interface OrderBookEntry {
  price: number;
  quantity: number;
  total: number;
}

interface OrderBookProps {
  yesOrders: OrderBookEntry[];
  noOrders: OrderBookEntry[];
}

export const OrderBook: React.FC<OrderBookProps> = ({ yesOrders, noOrders }) => {
  const maxQuantity = Math.max(
    ...yesOrders.map(o => o.quantity),
    ...noOrders.map(o => o.quantity)
  );

  const renderOrderRow = (orders: OrderBookEntry[], type: 'yes' | 'no') => (
    <>
      <View style={styles.columnHeader}>
        <Text style={styles.headerText}>Price</Text>
        <Text style={styles.headerText}>Qty</Text>
      </View>
      {orders.map((order, index) => (
        <View key={index} style={styles.orderRow}>
          <View
            style={[
              styles.depthBar,
              {
                width: `${(order.quantity / maxQuantity) * 100}%`,
                backgroundColor: type === 'yes' ? '#22C55E40' : '#EF444440',
              }
            ]}
          />
          <Text style={[styles.price, type === 'yes' ? styles.yesPrice : styles.noPrice]}>
            {(order.price * 100).toFixed(0)}¢
          </Text>
          <Text style={styles.quantity}>{order.quantity}</Text>
        </View>
      ))}
    </>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Order Book</Text>
      
      <View style={styles.orderBookContainer}>
        {/* YES Orders */}
        <View style={styles.side}>
          <Text style={[styles.sideLabel, styles.yesLabel]}>YES</Text>
          {renderOrderRow(yesOrders, 'yes')}
        </View>

        <View style={styles.divider} />

        {/* NO Orders */}
        <View style={styles.side}>
          <Text style={[styles.sideLabel, styles.noLabel]}>NO</Text>
          {renderOrderRow(noOrders, 'no')}
        </View>
      </View>

      {/* Spread */}
      <View style={styles.spreadContainer}>
        <Text style={styles.spreadLabel}>Spread:</Text>
        <Text style={styles.spreadValue}>
          {(() => {
            const spread = ((yesOrders[0]?.price || 0) - (noOrders[0]?.price || 0)) * 100;
            return spread > 0 ? `${spread.toFixed(0)}¢` : '-';
          })()}
        </Text>
      </View>
    </View>
  );
};

// Mock data generator
export const generateMockOrderBook = (baseYesPrice: number = 0.65): { yes: OrderBookEntry[], no: OrderBookEntry[] } => {
  const generateOrders = (basePrice: number, count: number = 5): OrderBookEntry[] => {
    return Array.from({ length: count }, (_, i) => ({
      price: basePrice + (i * 0.02),
      quantity: Math.floor(100 + Math.random() * 500),
      total: 0,
    })).map((order, _, arr) => ({
      ...order,
      total: arr.slice(0, arr.indexOf(order) + 1).reduce((sum, o) => sum + o.quantity, 0),
    }));
  };

  return {
    yes: generateOrders(baseYesPrice - 0.08),
    no: generateOrders((1 - baseYesPrice) - 0.08),
  };
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  orderBookContainer: {
    flexDirection: 'row',
  },
  side: {
    flex: 1,
  },
  sideLabel: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  yesLabel: {
    color: '#22C55E',
  },
  noLabel: {
    color: '#EF4444',
  },
  divider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 12,
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  headerText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    position: 'relative',
  },
  orderColumn: {
    flex: 1,
  },
  depthBar: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
  },
  price: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  yesPrice: {
    color: '#22C55E',
  },
  noPrice: {
    color: '#EF4444',
  },
  quantity: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'right',
    minWidth: 40,
  },
  spreadContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  spreadLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginRight: 8,
  },
  spreadValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
