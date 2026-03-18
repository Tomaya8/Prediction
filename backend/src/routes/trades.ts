import { Hono } from 'hono';
import { getFirebaseAdmin } from '../lib/firebase-admin';
import { calculateBuyCost, calculatePrice, calculateAllPrices, executeTrade } from '../lib/lmsr';

const trades = new Hono();

// Get all markets
trades.get('/markets', async (c) => {
  try {
    const { db } = getFirebaseAdmin();
    const marketsRef = db.collection('markets');
    const snapshot = await marketsRef.get();
    
    const markets = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();
        // Calculate current prices using LMSR
        const prices = calculateAllPrices({
          id: doc.id,
          outcomes: data.outcomes || [],
          liquidityParameter: data.liquidityParameter || 1000,
        });
        
        return {
          id: doc.id,
          ...data,
          prices,
        };
      })
    );
    
    return c.json({ success: true, data: markets });
  } catch (error) {
    console.error('Error fetching markets:', error);
    return c.json({ success: false, error: 'Failed to fetch markets' }, 500);
  }
});

// Get single market
trades.get('/markets/:id', async (c) => {
  try {
    const { db } = getFirebaseAdmin();
    const marketId = c.req.param('id');
    
    const marketRef = db.collection('markets').doc(marketId);
    const doc = await marketRef.get();
    
    if (!doc.exists) {
      return c.json({ success: false, error: 'Market not found' }, 404);
    }
    
    const data = doc.data();
    const prices = calculateAllPrices({
      id: doc.id,
      outcomes: data?.outcomes || [],
      liquidityParameter: data?.liquidityParameter || 1000,
    });
    
    return c.json({
      success: true,
      data: {
        id: doc.id,
        ...data,
        prices,
      },
    });
  } catch (error) {
    console.error('Error fetching market:', error);
    return c.json({ success: false, error: 'Failed to fetch market' }, 500);
  }
});

// Execute a trade (buy shares)
trades.post('/trade', async (c) => {
  try {
    const { db, auth } = getFirebaseAdmin();
    const body = await c.req.json();
    
    const { marketId, outcomeId, amount, userId } = body;
    
    if (!marketId || !outcomeId || !amount || !userId) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }
    
    // Get market
    const marketRef = db.collection('markets').doc(marketId);
    const marketDoc = await marketRef.get();
    
    if (!marketDoc.exists) {
      return c.json({ success: false, error: 'Market not found' }, 404);
    }
    
    const marketData = marketDoc.data();
    const market = {
      id: marketId,
      outcomes: marketData?.outcomes || [],
      liquidityParameter: marketData?.liquidityParameter || 1000,
    };
    
    // Calculate cost
    const cost = calculateBuyCost(market, outcomeId, amount);
    
    // Get user balance
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }
    
    const userData = userDoc.data();
    const currentBalance = userData?.creditBalance || 0;
    
    if (currentBalance < cost) {
      return c.json({ success: false, error: 'Insufficient balance' }, 400);
    }
    
    // Execute trade in transaction
    await db.runTransaction(async (tx) => {
      // Update market quantities
      const outcomes = market.outcomes.map(o =>
        o.id === outcomeId
          ? { ...o, quantity: o.quantity + amount }
          : o
      );
      
      tx.update(marketRef, { outcomes });
      
      // Deduct user balance
      tx.update(userRef, {
        creditBalance: currentBalance - cost,
      });
      
      // Record trade
      const tradesRef = db.collection('trades');
      tx.create(tradesRef.doc(), {
        userId,
        marketId,
        outcomeId,
        amount,
        cost,
        type: 'BUY',
        createdAt: new Date().toISOString(),
      });
    });
    
    // Get updated prices
    const updatedPrices = calculateAllPrices({
      ...market,
      outcomes: market.outcomes.map(o =>
        o.id === outcomeId
          ? { ...o, quantity: o.quantity + amount }
          : o
      ),
    });
    
    return c.json({
      success: true,
      data: {
        cost,
        newBalance: currentBalance - cost,
        prices: updatedPrices,
      },
    });
  } catch (error) {
    console.error('Error executing trade:', error);
    return c.json({ success: false, error: 'Failed to execute trade' }, 500);
  }
});

// Get user portfolio
trades.get('/portfolio/:userId', async (c) => {
  try {
    const { db } = getFirebaseAdmin();
    const userId = c.req.param('userId');
    
    // Get user's trades
    const tradesRef = db.collection('trades');
    const snapshot = await tradesRef.where('userId', '==', userId).get();
    
    const trades = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    // Group by market
    const holdings: Record<string, {
      marketId: string;
      outcomes: Record<string, number>;
      totalCost: number;
    }> = {};
    
    for (const trade of trades) {
      if (!holdings[trade.marketId]) {
        holdings[trade.marketId] = {
          marketId: trade.marketId,
          outcomes: {},
          totalCost: 0,
        };
      }
      
      const outcome = trade.outcomeId;
      holdings[trade.marketId].outcomes[outcome] = 
        (holdings[trade.marketId].outcomes[outcome] || 0) + trade.amount;
      holdings[trade.marketId].totalCost += trade.cost;
    }
    
    // Get market info for each holding
    const portfolio = await Promise.all(
      Object.values(holdings).map(async (holding) => {
        const marketDoc = await db.collection('markets').doc(holding.marketId).get();
        const marketData = marketDoc.data();
        
        // Calculate current value
        let currentValue = 0;
        const market = {
          id: holding.marketId,
          outcomes: marketData?.outcomes || [],
          liquidityParameter: marketData?.liquidityParameter || 1000,
        };
        
        for (const [outcomeId, shares] of Object.entries(holding.outcomes)) {
          const price = calculatePrice(market, outcomeId);
          currentValue += (price * (shares as number));
        }
        
        return {
          marketId: holding.marketId,
          marketTitle: marketData?.title,
          outcomes: holding.outcomes,
          totalCost: holding.totalCost,
          currentValue: Math.round(currentValue * 100) / 100,
          profitLoss: Math.round((currentValue - holding.totalCost) * 100) / 100,
        };
      })
    );
    
    return c.json({ success: true, data: portfolio });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    return c.json({ success: false, error: 'Failed to fetch portfolio' }, 500);
  }
});

// Resolve a market (admin only)
trades.post('/resolve', async (c) => {
  try {
    const { db } = getFirebaseAdmin();
    const body = await c.req.json();
    
    const { marketId, winningOutcomeId } = body;
    
    if (!marketId || !winningOutcomeId) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }
    
    const marketRef = db.collection('markets').doc(marketId);
    const marketDoc = await marketRef.get();
    
    if (!marketDoc.exists) {
      return c.json({ success: false, error: 'Market not found' }, 404);
    }
    
    // Update market status
    await marketRef.update({
      status: 'RESOLVED',
      winningOutcomeId,
      resolvedAt: new Date().toISOString(),
    });
    
    // Calculate and distribute winnings
    const tradesRef = db.collection('trades');
    const winningTrades = await tradesRef
      .where('marketId', '==', marketId)
      .where('outcomeId', '==', winningOutcomeId)
      .get();
    
    await db.runTransaction(async (tx) => {
      for (const tradeDoc of winningTrades.docs) {
        const trade = tradeDoc.data();
        const userRef = db.collection('users').doc(trade.userId);
        const userDoc = await userRef.get();
        const userData = userDoc.data();
        
        // Award winnings (1 credit per share for winning outcome)
        tx.update(userRef, {
          creditBalance: (userData?.creditBalance || 0) + trade.amount,
        });
      }
    });
    
    return c.json({ success: true, data: { message: 'Market resolved successfully' } });
  } catch (error) {
    console.error('Error resolving market:', error);
    return c.json({ success: false, error: 'Failed to resolve market' }, 500);
  }
});

export default trades;
