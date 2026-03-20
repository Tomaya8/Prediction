// LMSR (Logarithmic Market Scoring Rule) Implementation
// Used for automated market making in prediction markets

export interface Outcome {
  id: string;
  name: string;
  quantity: number; // Current quantity of shares outstanding
}

export interface Market {
  id: string;
  outcomes: Outcome[];
  liquidityParameter: number; // "b" parameter - controls price sensitivity
}

/**
 * Calculate the cost to buy a certain number of shares using LMSR
 * 
 * LMSR Formula: cost = b * ln(sum(exp(q_i / b)))
 * where q_i is the quantity of shares for each outcome after purchase
 * 
 * @param market - The market with current quantities
 * @param outcomeId - The outcome to buy shares for
 * @param amount - Number of shares to buy
 * @returns The cost in credits
 */
export function calculateBuyCost(
  market: Market,
  outcomeId: string,
  amount: number
): number {
  const { outcomes, liquidityParameter } = market;
  
  // Find the outcome index
  const outcomeIndex = outcomes.findIndex(o => o.id === outcomeId);
  if (outcomeIndex === -1) {
    throw new Error(`Outcome ${outcomeId} not found`);
  }
  
  // Calculate current cost before purchase
  const currentCost = calculateCost(outcomes, liquidityParameter);
  
  // Create new quantities with the purchase
  const newOutcomes = outcomes.map((o, i) => ({
    ...o,
    quantity: i === outcomeIndex ? o.quantity + amount : o.quantity,
  }));
  
  // Calculate cost after purchase
  const newCost = calculateCost(newOutcomes, liquidityParameter);
  
  // Return the difference (cost of the purchase)
  return Math.round((newCost - currentCost) * 100) / 100;
}

/**
 * Calculate the current cost for a given set of quantities
 */
function calculateCost(outcomes: Outcome[], b: number): number {
  let sum = 0;
  for (const outcome of outcomes) {
    sum += Math.exp(outcome.quantity / b);
  }
  return b * Math.log(sum);
}

/**
 * Calculate the current price of an outcome using LMSR
 * 
 * Price Formula: price_i = exp(q_i / b) / sum(exp(q_j / b))
 * 
 * @param market - The market
 * @param outcomeId - The outcome to get price for
 * @returns Price between 0 and 1
 */
export function calculatePrice(market: Market, outcomeId: string): number {
  const { outcomes, liquidityParameter } = market;
  
  const outcomeIndex = outcomes.findIndex(o => o.id === outcomeId);
  if (outcomeIndex === -1) {
    throw new Error(`Outcome ${outcomeId} not found`);
  }
  
  // Calculate denominator (sum of all exp(q_i / b))
  let sum = 0;
  for (const outcome of outcomes) {
    sum += Math.exp(outcome.quantity / liquidityParameter);
  }
  
  // Calculate price
  const price = Math.exp(outcomes[outcomeIndex].quantity / liquidityParameter) / sum;
  
  return Math.round(price * 10000) / 10000; // Round to 4 decimal places
}

/**
 * Calculate all prices for a market
 */
export function calculateAllPrices(market: Market): Record<string, number> {
  const prices: Record<string, number> = {};
  
  for (const outcome of market.outcomes) {
    prices[outcome.id] = calculatePrice(market, outcome.id);
  }
  
  return prices;
}

/**
 * Calculate potential profit if an outcome wins
 * 
 * @param market - The market
 * @param outcomeId - The winning outcome
 * @param userHoldings - Map of outcomeId to number of shares owned
 * @returns Net profit (can be negative for loss)
 */
export function calculateProfit(
  market: Market,
  outcomeId: string,
  userHoldings: Record<string, number>
): number {
  let totalProfit = 0;
  
  for (const [heldOutcomeId, shares] of Object.entries(userHoldings)) {
    if (shares > 0) {
      if (heldOutcomeId === outcomeId) {
        // Winning outcome: profit = shares - cost paid
        const cost = calculateBuyCostForShares(market, heldOutcomeId, shares);
        totalProfit += shares - cost;
      } else {
        // Losing outcome: loss = -cost paid
        const cost = calculateBuyCostForShares(market, heldOutcomeId, shares);
        totalProfit -= cost;
      }
    }
  }
  
  return Math.round(totalProfit * 100) / 100;
}

/**
 * Calculate cost for multiple shares at once (for calculating historical cost basis)
 */
function calculateBuyCostForShares(
  market: Market,
  outcomeId: string,
  totalShares: number
): number {
  // Simulate buying shares one at a time to get average cost
  // In production, you'd track this more efficiently
  let totalCost = 0;
  let tempMarket = { ...market, outcomes: market.outcomes.map(o => ({ ...o })) };
  
  for (let i = 0; i < totalShares; i++) {
    totalCost += calculateBuyCost(tempMarket, outcomeId, 1);
    // Update temp market
    const idx = tempMarket.outcomes.findIndex(o => o.id === outcomeId);
    tempMarket.outcomes[idx].quantity++;
  }
  
  return totalCost;
}

/**
 * Execute a trade and return updated market state
 */
export function executeTrade(
  market: Market,
  outcomeId: string,
  amount: number
): { market: Market; cost: number } {
  const cost = calculateBuyCost(market, outcomeId, amount);
  
  const updatedMarket: Market = {
    ...market,
    outcomes: market.outcomes.map(o => 
      o.id === outcomeId 
        ? { ...o, quantity: o.quantity + amount }
        : o
    ),
  };
  
  return { market: updatedMarket, cost };
}

/**
 * Create a new market with initial prices
 */
export function createMarket(
  id: string,
  outcomeNames: string[],
  initialPrice: number = 0.5,
  liquidityParameter: number = 1000
): Market {
  // Calculate initial quantities that give the desired initial price
  // For binary market: price = 0.5 means q_yes = q_no
  // Using b=1000, at price=0.5: exp(q/b) = exp(q_no/b), so q_yes = q_no
  
  const quantities = outcomeNames.map(() => {
    // For initial price p, q = b * ln(p / (1-p)) for binary
    // But simpler: just use b * ln(1/p) for equal pricing
    return Math.round(liquidityParameter * Math.log(1 / initialPrice));
  });
  
  const outcomes: Outcome[] = outcomeNames.map((name, i) => ({
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    quantity: quantities[i],
  }));
  
  return {
    id,
    outcomes,
    liquidityParameter,
  };
}

/**
 * Inverse LMSR: given a credit budget, find the number of shares that can be bought.
 * Uses binary search since calculateBuyCost is monotonically increasing in amount.
 */
export function calculateSharesForCost(
  market: Market,
  outcomeId: string,
  targetCredits: number
): number {
  if (targetCredits <= 0) return 0;
  const currentPrice = calculatePrice(market, outcomeId);
  // Upper bound: rough estimate, generous to cover price impact
  let lo = 0;
  let hi = (targetCredits / Math.max(currentPrice, 0.001)) * 1.5;
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    const cost = calculateBuyCost(market, outcomeId, mid);
    if (cost < targetCredits) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo); // floor ensures we never exceed budget
}

// Alias used by markets.ts route
export const calculatePrices = calculateAllPrices;

// Example usage:
// const market = createMarket('btc-100k', ['Yes', 'No'], 0.5, 1000);
// const price = calculatePrice(market, 'yes'); // ~0.5
// const cost = calculateBuyCost(market, 'yes', 10); // Cost to buy 10 Yes shares
