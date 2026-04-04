/**
 * Bot System — 20 AI-powered house users that trade and enter tournaments.
 *
 * Each bot has a personality/expertise that affects their prediction style:
 * - Conservative: predicts close to current value
 * - Aggressive: predicts wider swings
 * - Specialist: better at their domain (crypto, forex, etc.)
 *
 * Bots enter tournaments with realistic predictions (not random) and
 * place trades on LMSR markets to create volume and activity.
 */

import * as admin from "firebase-admin";

function getDb() { return admin.firestore(); }

// ─── Bot Profiles ───────────────────────────────────────────────────────────

interface BotProfile {
  displayName: string;
  email: string;
  style: "conservative" | "moderate" | "aggressive";
  specialty: string[]; // categories they're good at
  tradeFrequency: number; // 0-1, how often they trade per cycle
  tournamentFrequency: number; // 0-1, how often they enter tournaments
}

const BOT_PROFILES: BotProfile[] = [
  { displayName: "Alex Chen", email: "bot_alex@predich.system", style: "moderate", specialty: ["CRYPTO"], tradeFrequency: 0.7, tournamentFrequency: 0.8 },
  { displayName: "Sarah Miller", email: "bot_sarah@predich.system", style: "conservative", specialty: ["FOREX", "BUSINESS"], tradeFrequency: 0.5, tournamentFrequency: 0.9 },
  { displayName: "Marcus Johnson", email: "bot_marcus@predich.system", style: "aggressive", specialty: ["CRYPTO", "TECHNOLOGY"], tradeFrequency: 0.8, tournamentFrequency: 0.7 },
  { displayName: "Emma Davis", email: "bot_emma@predich.system", style: "moderate", specialty: ["POLITICS", "BUSINESS"], tradeFrequency: 0.6, tournamentFrequency: 0.8 },
  { displayName: "James Wilson", email: "bot_james@predich.system", style: "aggressive", specialty: ["SPORTS", "ENTERTAINMENT"], tradeFrequency: 0.9, tournamentFrequency: 0.6 },
  { displayName: "Olivia Brown", email: "bot_olivia@predich.system", style: "conservative", specialty: ["SCIENCE", "TECHNOLOGY"], tradeFrequency: 0.4, tournamentFrequency: 0.9 },
  { displayName: "Daniel Kim", email: "bot_daniel@predich.system", style: "moderate", specialty: ["CRYPTO", "FOREX"], tradeFrequency: 0.7, tournamentFrequency: 0.8 },
  { displayName: "Sofia Martinez", email: "bot_sofia@predich.system", style: "aggressive", specialty: ["ENTERTAINMENT", "POLITICS"], tradeFrequency: 0.8, tournamentFrequency: 0.7 },
  { displayName: "Ryan Taylor", email: "bot_ryan@predich.system", style: "moderate", specialty: ["SPORTS", "CRYPTO"], tradeFrequency: 0.6, tournamentFrequency: 0.8 },
  { displayName: "Mia Anderson", email: "bot_mia@predich.system", style: "conservative", specialty: ["FOREX", "SCIENCE"], tradeFrequency: 0.5, tournamentFrequency: 0.9 },
  { displayName: "Liam Thomas", email: "bot_liam@predich.system", style: "aggressive", specialty: ["CRYPTO", "BUSINESS"], tradeFrequency: 0.9, tournamentFrequency: 0.6 },
  { displayName: "Ava Jackson", email: "bot_ava@predich.system", style: "moderate", specialty: ["POLITICS", "SCIENCE"], tradeFrequency: 0.6, tournamentFrequency: 0.8 },
  { displayName: "Noah White", email: "bot_noah@predich.system", style: "conservative", specialty: ["TECHNOLOGY", "BUSINESS"], tradeFrequency: 0.5, tournamentFrequency: 0.7 },
  { displayName: "Isabella Garcia", email: "bot_isabella@predich.system", style: "aggressive", specialty: ["ENTERTAINMENT", "SPORTS"], tradeFrequency: 0.7, tournamentFrequency: 0.8 },
  { displayName: "Ethan Lee", email: "bot_ethan@predich.system", style: "moderate", specialty: ["CRYPTO", "TECHNOLOGY"], tradeFrequency: 0.8, tournamentFrequency: 0.7 },
  { displayName: "Charlotte Moore", email: "bot_charlotte@predich.system", style: "conservative", specialty: ["FOREX", "POLITICS"], tradeFrequency: 0.4, tournamentFrequency: 0.9 },
  { displayName: "Mason Clark", email: "bot_mason@predich.system", style: "aggressive", specialty: ["SPORTS", "CRYPTO"], tradeFrequency: 0.9, tournamentFrequency: 0.6 },
  { displayName: "Amelia Rodriguez", email: "bot_amelia@predich.system", style: "moderate", specialty: ["BUSINESS", "TECHNOLOGY"], tradeFrequency: 0.6, tournamentFrequency: 0.8 },
  { displayName: "Lucas Walker", email: "bot_lucas@predich.system", style: "aggressive", specialty: ["CRYPTO", "FOREX"], tradeFrequency: 0.7, tournamentFrequency: 0.7 },
  { displayName: "Harper Hall", email: "bot_harper@predich.system", style: "conservative", specialty: ["SCIENCE", "POLITICS"], tradeFrequency: 0.5, tournamentFrequency: 0.9 },
];

// ─── Bot User Creation ──────────────────────────────────────────────────────

/**
 * Ensure all 20 bot users exist in Firestore. Creates any missing ones.
 */
export async function ensureBotUsers(): Promise<Map<string, BotProfile>> {
  const db = getDb();
  const botMap = new Map<string, BotProfile>();

  // Fetch all bot users in one query
  const existingSnap = await db.collection("users")
    .where("isBot", "==", true)
    .get();

  const existingByEmail = new Map<string, admin.firestore.DocumentSnapshot>();
  existingSnap.docs.forEach(d => {
    existingByEmail.set(d.data().email, d);
  });

  const batch = db.batch();
  let batchCount = 0;

  for (const profile of BOT_PROFILES) {
    const existing = existingByEmail.get(profile.email);
    if (existing) {
      botMap.set(existing.id, profile);
      // Top up credits if low
      if ((existing.data()!.creditBalance || 0) < 5000) {
        batch.update(existing.ref, { creditBalance: admin.firestore.FieldValue.increment(10000) });
        batchCount++;
      }
    } else {
      const ref = db.collection("users").doc();
      batch.set(ref, {
        email: profile.email,
        displayName: profile.displayName,
        passwordHash: null,
        creditBalance: 50000,
        totalCreditsEarned: 50000,
        totalCreditsSpent: 0,
        totalTrades: 0,
        winningTrades: 0,
        totalWinnings: 0,
        roi: 0,
        currentStreak: Math.floor(Math.random() * 15),
        longestStreak: Math.floor(Math.random() * 30) + 5,
        isPremium: false,
        isAdmin: false,
        isBot: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      botMap.set(ref.id, profile);
      batchCount++;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`Bot users: ${batchCount} created/updated`);
  }

  return botMap;
}

// ─── Tournament Bot Logic ───────────────────────────────────────────────────

/**
 * Generate a realistic prediction based on bot style and current value.
 */
function generatePrediction(
  currentValue: number,
  style: "conservative" | "moderate" | "aggressive",
  isSpecialist: boolean,
  type: string
): number {
  // Base variance depends on tournament type
  let baseVariance: number;
  switch (type) {
    case "RAPID": baseVariance = 0.005; break;   // ±0.5% for 2-hour prediction
    case "WEEKLY": baseVariance = 0.03; break;    // ±3% for weekly
    case "MONTHLY": baseVariance = 0.08; break;   // ±8% for monthly
    default: baseVariance = 0.03;
  }

  // Style modifier
  const styleMultiplier = style === "conservative" ? 0.6 : style === "aggressive" ? 1.5 : 1.0;

  // Specialists are more accurate (tighter spread)
  const specialistMultiplier = isSpecialist ? 0.7 : 1.0;

  const variance = baseVariance * styleMultiplier * specialistMultiplier;

  // Generate prediction with slight bias (bots aren't perfectly centered)
  const bias = (Math.random() - 0.5) * 0.3; // slight directional bias
  const noise = (Math.random() - 0.5) * 2; // -1 to 1
  const change = currentValue * variance * (noise + bias);

  const prediction = currentValue + change;

  // Round appropriately based on magnitude
  if (currentValue > 1000) return Math.round(prediction);
  if (currentValue > 10) return Math.round(prediction * 100) / 100;
  return Math.round(prediction * 10000) / 10000;
}

/**
 * Bots enter open tournaments. Each bot decides independently whether to enter.
 */
export async function botEnterTournaments(): Promise<{ entered: number }> {
  const db = getDb();
  const botMap = await ensureBotUsers();
  let entered = 0;

  // Get open tournaments
  const tournamentsSnap = await db.collection("tournament_v2")
    .where("status", "==", "REGISTRATION")
    .get();

  for (const tDoc of tournamentsSnap.docs) {
    const t = tDoc.data();
    const currentValue = t.currentLiveValue || t.currentValueAtCreation;
    if (!currentValue) continue;

    for (const [botId, profile] of botMap) {
      // Skip if already entered
      const entryId = `${botId}_${tDoc.id}`;
      const existingEntry = await db.collection("tournament_entries").doc(entryId).get();
      if (existingEntry.exists) continue;

      // Decide whether to enter based on frequency + some randomness
      if (Math.random() > profile.tournamentFrequency) continue;

      // Check if bot has enough credits
      const botDoc = await db.collection("users").doc(botId).get();
      if (!botDoc.exists) continue;
      const botData = botDoc.data()!;
      if (botData.creditBalance < (t.entryFee || 0)) continue;

      // Generate prediction
      const isSpecialist = profile.specialty.includes(t.category);
      const prediction = generatePrediction(currentValue, profile.style, isSpecialist, t.type);

      // Enter tournament
      const fee = t.entryFee || 0;
      const batch = db.batch();

      if (fee > 0) {
        batch.update(db.collection("users").doc(botId), {
          creditBalance: admin.firestore.FieldValue.increment(-fee),
          totalCreditsSpent: admin.firestore.FieldValue.increment(fee),
        });
        batch.set(db.collection("transactions").doc(), {
          userId: botId, amount: -fee, type: "TOURNAMENT_ENTRY",
          description: `Tournament entry: ${t.question}`,
          referenceId: tDoc.id,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      batch.set(db.collection("tournament_entries").doc(entryId), {
        tournamentId: tDoc.id,
        userId: botId,
        displayName: profile.displayName,
        prediction,
        enteredAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      batch.update(tDoc.ref, {
        playerCount: admin.firestore.FieldValue.increment(1),
        prizePool: admin.firestore.FieldValue.increment(fee),
      });

      await batch.commit();
      entered++;
    }
  }

  return { entered };
}

// ─── Market Trading Bot Logic ───────────────────────────────────────────────

/**
 * Bots place trades on LMSR markets to create volume and price movement.
 */
export async function botTrade(): Promise<{ trades: number }> {
  const db = getDb();
  const botMap = await ensureBotUsers();
  let trades = 0;

  // Get active markets with some volume
  const marketsSnap = await db.collection("markets")
    .where("status", "==", "OPEN")
    .limit(20)
    .get();

  if (marketsSnap.empty) return { trades: 0 };

  for (const [botId, profile] of botMap) {
    // Each bot trades on 0-3 markets per cycle based on frequency
    if (Math.random() > profile.tradeFrequency) continue;

    const botDoc = await db.collection("users").doc(botId).get();
    if (!botDoc.exists) continue;
    const botData = botDoc.data()!;
    if (botData.creditBalance < 20) continue;

    // Pick a random market
    const marketDoc = marketsSnap.docs[Math.floor(Math.random() * marketsSnap.docs.length)];
    const market = marketDoc.data();
    const outcomes = market.outcomes || [];
    if (outcomes.length < 2) continue;

    // Pick an outcome — specialists make slightly better picks
    const isSpecialist = profile.specialty.includes(market.category);
    const outcomeIndex = Math.random() < (isSpecialist ? 0.55 : 0.5) ? 0 : Math.min(1, outcomes.length - 1);
    const outcome = outcomes[outcomeIndex];

    // Trade amount: 5-50 credits based on style
    const maxBet = profile.style === "aggressive" ? 50 : profile.style === "conservative" ? 15 : 30;
    const amount = Math.min(
      Math.floor(Math.random() * maxBet) + 5,
      Math.floor(botData.creditBalance * 0.05) // Never bet more than 5% of balance
    );

    if (amount < 5) continue;

    // Use the LMSR pricing to calculate cost — call the trade endpoint internally
    // For simplicity, we'll do a direct Firestore trade (same logic as the API)
    const b = market.liquidityParameter || 1000;
    const cost = lmsrBuyCost(outcomes, b, outcome.id, amount);
    if (cost > botData.creditBalance || cost <= 0) continue;

    const roundedCost = Math.max(1, Math.round(cost));
    const updatedOutcomes = outcomes.map((o: any) =>
      o.id === outcome.id ? { ...o, quantity: (o.quantity || 0) + amount } : o
    );

    const hId = `${botId}_${marketDoc.id}_${outcome.id}`;

    try {
      await db.runTransaction(async (tx) => {
        // ALL READS FIRST (Firestore requirement)
        const hRef = db.collection("holdings").doc(hId);
        const hDoc = await tx.get(hRef);

        // THEN ALL WRITES
        tx.update(marketDoc.ref, {
          outcomes: updatedOutcomes,
          totalVolume: (market.totalVolume || 0) + roundedCost,
        });
        tx.update(db.collection("users").doc(botId), {
          creditBalance: admin.firestore.FieldValue.increment(-roundedCost),
          totalCreditsSpent: admin.firestore.FieldValue.increment(roundedCost),
          totalTrades: admin.firestore.FieldValue.increment(1),
        });
        tx.set(db.collection("trades").doc(), {
          userId: botId, marketId: marketDoc.id, outcomeId: outcome.id,
          type: "BUY", quantity: amount, totalCost: roundedCost,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        if (hDoc.exists) {
          const h = hDoc.data()!;
          const nq = h.quantity + amount;
          tx.update(hRef, { quantity: nq, avgCost: (h.avgCost * h.quantity + roundedCost) / nq });
        } else {
          tx.set(hRef, { userId: botId, marketId: marketDoc.id, outcomeId: outcome.id, quantity: amount, avgCost: roundedCost / amount });
        }

        tx.set(db.collection("transactions").doc(), {
          userId: botId, amount: -roundedCost, type: "TRADE_BUY",
          description: `Bought ${amount} shares`,
          referenceId: marketDoc.id,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      trades++;
    } catch (e: any) {
      // Transaction failed — skip this trade
      console.error(`Bot trade failed for ${profile.displayName}:`, e.message);
    }
  }

  return { trades };
}

// ─── LMSR helper (duplicated from index.ts for bot use) ─────────────────────

function lmsrBuyCost(outcomes: any[], b: number, outcomeId: string, amount: number): number {
  const costBefore = lmsrCostFn(outcomes, b);
  const costAfter = lmsrCostFn(
    outcomes.map((o: any) => o.id === outcomeId ? { ...o, quantity: (o.quantity || 0) + amount } : o),
    b
  );
  return costAfter - costBefore;
}

function lmsrCostFn(outcomes: any[], b: number): number {
  let s = 0;
  for (const o of outcomes) {
    const q = Math.min((o.quantity || 0), b * 500);
    s += Math.exp(q / b);
  }
  return b * Math.log(Math.max(s, 1e-10));
}
