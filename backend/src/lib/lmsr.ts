/**
 * LMSR (Logarithmic Market Scoring Rule) Implementation
 * 
 * Used for automated market making in prediction markets.
 * 
 * Key Concepts:
 * - b (liquidity parameter): Controls how much prices move with trades
 * - q (quantity vector): Number of shares outstanding for each outcome
 * - price_i: Probability/price of outcome i
 * 
 * Formulas:
 * - price_i = exp(q_i / b) / Σexp(q_j / b)
 * - cost to buy δ shares of outcome i = b * ln(Σexp((q_k + δ_i) / b)) - b * ln(Σexp(q_k / b))
 * - revenue from selling δ shares of outcome i = b * ln(Σexp(q_k / b)) - b * ln(Σexp((q_k - δ_i) / b))
 */

export interface LMSROutcome {
  id: string;
  name: string;
  quantity: number; // q_i - current shares outstanding
}

export interface LMSRMarket {
  id: string;
  liquidityB: number; // b parameter
  outcomes: LMSROutcome[];
}

export interface TradeResult {
  success: boolean;
  cost?: number;          // Credits spent (positive) or received (negative)
  newQuantity?: number;  // New quantity for the outcome
  prices?: number[];      // Updated prices for all outcomes
  error?: string;
}

export interface PriceResult {
  prices: number[];       // Price for each outcome (0-1, represents probability)
  probabilities: number[]; // Alias for prices
  costToBuy: number[];    // Cost to buy 1 share of each outcome
  maxBuyAmount: number;   // Maximum shares user can buy with their balance
}

/**
 * Calculate the current price/probability for each outcome
 * 
 * price_i = exp(q_i / b) / Σexp(q_j / b)
 */
export function calculatePrices(market: LMSRMarket): number[] {
  const { liquidityB, outcomes } = market;
  
  if (outcomes.length === 0) return [];
  if (outcomes.length === 1) return [1.0];

  // Calculate exponent terms: exp(q_i / b)
  const expTerms = outcomes.map(o => Math.exp(o.quantity / liquidityB));
  
  // Calculate sum: Σexp(q_j / b)
  const sumExp = expTerms.reduce((sum, exp) => sum + exp, 0);
  
  // Calculate prices: exp(q_i / b) / sum
  const prices = expTerms.map(exp => exp / sumExp);
  
  return prices;
}

/**
 * Calculate the cost to buy a specified quantity of shares
 * 
 * cost = b * ln(Σexp((q_k + δ_k) / b))
 *        - b * ln(Σexp(q_k / b))
 * 
 * For buying shares of a single outcome i:
 * cost = b * ln(sum_j(exp(q_j/b) + (i==j ? exp((q_i+δ)/b) - exp(q_i/b) : 0)))
 *        - b * ln(sum_j(exp(q_j/b)))
 * 
 * Simplified: cost = b * ln(Σexp(q_k/b) + exp((q_i+δ)/b) - exp(q_i/b))
 */
export function calculateBuyCost(
  market: LMSRMarket,
  outcomeIndex: number,
  quantityToBuy: number
): number {
  const { liquidityB, outcomes } = market;
  
  if (quantityToBuy <= 0) return 0;
  if (outcomeIndex < 0 || outcomeIndex >= outcomes.length) {
    throw new Error('Invalid outcome index');
  }

  // Current sum: Σexp(q_k / b)
  const currentSum = outcomes.reduce((sum, o) => sum + Math.exp(o.quantity / liquidityB), 0);
  
  // Adjusted sum after purchase: Σexp((q_k + δ_k) / b)
  // Only outcome at outcomeIndex changes
  const currentExp = Math.exp(outcomes[outcomeIndex].quantity / liquidityB);
  const newExp = Math.exp((outcomes[outcomeIndex].quantity + quantityToBuy) / liquidityB);
  const adjustedSum = currentSum - currentExp + newExp;
  
  // Cost = b * ln(adjustedSum) - b * ln(currentSum)
  const cost = liquidityB * Math.log(adjustedSum) - liquidityB * Math.log(currentSum);
  
  return Math.round(cost * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate the revenue from selling a specified quantity of shares
 * 
 * revenue = b * ln(Σexp(q_k / b)) - b * ln(Σexp((q_k - δ_k) / b))
 */
export function calculateSellRevenue(
  market: LMSRMarket,
  outcomeIndex: number,
  quantityToSell: number
): number {
  const { liquidityB, outcomes } = market;
  
  if (quantityToSell <= 0) return 0;
  if (outcomeIndex < 0 || outcomeIndex >= outcomes.length) {
    throw new Error('Invalid outcome index');
  }
  
  // Can't sell more than outstanding shares
  if (quantityToSell > outcomes[outcomeIndex].quantity) {
    throw new Error('Cannot sell more shares than outstanding');
  }

  // Current sum: Σexp(q_k / b)
  const currentSum = outcomes.reduce((sum, o) => sum + Math.exp(o.quantity / liquidityB), 0);
  
  // Adjusted sum after sale: Only outcome at outcomeIndex changes
  const currentExp = Math.exp(outcomes[outcomeIndex].quantity / liquidityB);
  const newExp = Math.exp((outcomes[outcomeIndex].quantity - quantityToSell) / liquidityB);
  const adjustedSum = currentSum - currentExp + newExp;
  
  // Revenue = b * ln(currentSum) - b * ln(adjustedSum)
  const revenue = liquidityB * Math.log(currentSum) - liquidityB * Math.log(adjustedSum);
  
  return Math.round(revenue * 100) / 100;
}

/**
 * Calculate complete market state including all prices
 */
export function getMarketPrices(market: LMSRMarket, userBalance: number = 0): PriceResult {
  const prices = calculatePrices(market);
  const costToBuy = market.outcomes.map((_, i) => calculateBuyCost(market, i, 1));
  
  // Calculate max shares user can buy of each outcome
  const maxBuyAmount: number[] = [];
  for (let i = 0; i < market.outcomes.length; i++) {
    // Binary search to find max affordable quantity
    let low = 0;
    let high = userBalance * 10; // Reasonable upper bound
    while (low < high) {
      const mid = Math.floor((low + high + 1) / 2);
      try {
        const cost = calculateBuyCost(market, i, mid);
        if (cost <= userBalance) {
          low = mid;
        } else {
          high = mid - 1;
        }
      } catch {
        high = mid - 1;
      }
    }
    maxBuyAmount.push(low);
  }
  
  return {
    prices,
    probabilities: prices,
    costToBuy,
    maxBuyAmount: Math.min(...maxBuyAmount)
  };
}

/**
 * Execute a buy trade and return the new market state
 */
export function executeBuy(
  market: LMSRMarket,
  outcomeIndex: number,
  quantity: number,
  userBalance: number
): TradeResult {
  try {
    // Validate inputs
    if (quantity <= 0) {
      return { success: false, error: 'Quantity must be positive' };
    }
    if (outcomeIndex < 0 || outcomeIndex >= market.outcomes.length) {
      return { success: false, error: 'Invalid outcome index' };
    }
    
    // Calculate cost
    const cost = calculateBuyCost(market, outcomeIndex, quantity);
    
    // Check if user has enough balance
    if (cost > userBalance) {
      return { success: false, error: 'Insufficient balance' };
    }
    
    // Calculate new quantity
    const newQuantity = market.outcomes[outcomeIndex].quantity + quantity;
    
    // Calculate new prices
    const updatedOutcomes = market.outcomes.map((o, i) => ({
      ...o,
      quantity: i === outcomeIndex ? newQuantity : o.quantity
    }));
    const updatedMarket = { ...market, outcomes: updatedOutcomes };
    const newPrices = calculatePrices(updatedMarket);
    
    return {
      success: true,
      cost,
      newQuantity,
      prices: newPrices
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Execute a sell trade and return the new market state
 */
export function executeSell(
  market: LMSRMarket,
  outcomeIndex: number,
  quantity: number,
  currentHolding: number
): TradeResult {
  try {
    // Validate inputs
    if (quantity <= 0) {
      return { success: false, error: 'Quantity must be positive' };
    }
    if (outcomeIndex < 0 || outcomeIndex >= market.outcomes.length) {
      return { success: false, error: 'Invalid outcome index' };
    }
    if (quantity > currentHolding) {
      return { success: false, error: 'Insufficient shares to sell' };
    }
    
    // Calculate revenue
    const revenue = calculateSellRevenue(market, outcomeIndex, quantity);
    
    // Calculate new quantity
    const newQuantity = market.outcomes[outcomeIndex].quantity - quantity;
    
    // Calculate new prices
    const updatedOutcomes = market.outcomes.map((o, i) => ({
      ...o,
      quantity: i === outcomeIndex ? newQuantity : o.quantity
    }));
    const updatedMarket = { ...market, outcomes: updatedOutcomes };
    const newPrices = calculatePrices(updatedMarket);
    
    return {
      success: true,
      cost: -revenue, // Negative cost = credits received
      newQuantity,
      prices: newPrices
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Calculate potential profit/loss for a holding
 */
export function calculateHoldingPnL(
  holdingQuantity: number,
  avgCost: number,
  currentPrice: number,
  liquidityB: number,
  outcomeIndex: number,
  marketOutcomes: LMSROutcome[]
): { unrealizedPnL: number; roi: number } {
  // Current value based on market price
  const currentValue = holdingQuantity * currentPrice;
  
  // Cost basis
  const costBasis = holdingQuantity * avgCost;
  
  // Unrealized P&L
  const unrealizedPnL = Math.round((currentValue - costBasis) * 100) / 100;
  
  // ROI percentage
  const roi = costBasis > 0 ? ((currentValue - costBasis) / costBasis) * 100 : 0;
  
  return { unrealizedPnL, roi };
}

/**
 * Example usage and testing
 */
export function lmsrExample() {
  // Create a simple binary market (Yes/No)
  const market: LMSRMarket = {
    id: 'example-market',
    liquidityB: 1000,
    outcomes: [
      { id: 'yes', name: 'Yes', quantity: 0 },
      { id: 'no', name: 'No', quantity: 0 }
    ]
  };
  
  console.log('Initial state:');
  console.log('Prices:', calculatePrices(market)); // [0.5, 0.5]
  
  // Buy 100 shares of Yes
  const cost1 = calculateBuyCost(market, 0, 100);
  console.log('\nCost to buy 100 Yes shares:', cost1);
  
  // Update market state
  market.outcomes[0].quantity += 100;
  console.log('Prices after buying Yes:', calculatePrices(market));
  
  // Buy another 100 shares of Yes
  const cost2 = calculateBuyCost(market, 0, 100);
  console.log('\nCost to buy another 100 Yes shares:', cost2);
  console.log('Total cost for 200 Yes:', cost1 + cost2);
  
  // Prices after more Yes buying
  market.outcomes[0].quantity += 100;
  console.log('Prices:', calculatePrices(market));
  
  // Sell 50 shares of Yes
  const revenue = calculateSellRevenue(market, 0, 50);
  console.log('\nRevenue from selling 50 Yes shares:', revenue);
  
  return {
    initialPrices: calculatePrices(market),
    cost1,
    cost2,
    totalCost: cost1 + cost2,
    revenue
  };
}

// Export example for testing
lmsrExample();
