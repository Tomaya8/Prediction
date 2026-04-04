/**
 * Versus — Comparative Asset Predictions
 *
 * "Which asset will perform better?" with dynamic odds.
 * Fixed payout against the house (no pool needed).
 * Auto-resolves by comparing % change of both assets.
 */

import * as admin from "firebase-admin";
import { z } from "zod";
import { fetchCurrentPrice } from "./tournaments";
import { sendPushNotification } from "./notifications";

function getDb() { return admin.firestore(); }

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VersusMatchup {
  id: string;
  assetA: { symbol: string; name: string; color: string; priceAtCreation: number; change7d: number; change30d: number; avgWeeklyChange: number };
  assetB: { symbol: string; name: string; color: string; priceAtCreation: number; change7d: number; change30d: number; avgWeeklyChange: number };
  type: "FLASH" | "DAILY" | "WEEKLY";
  status: "OPEN" | "RESOLVED" | "CANCELLED";
  entryFee: number;
  oddsA: number; // e.g. 1.4 — payout multiplier if A wins
  oddsB: number; // e.g. 2.3
  picksA: number; // how many users picked A
  picksB: number;
  insights: string[];
  expiresAt: string;
  resolvedAt?: string;
  priceAAtResolution?: number;
  priceBAtResolution?: number;
  changeA?: number; // % change
  changeB?: number;
  winner?: "A" | "B" | "TIE";
  createdAt: any;
}

// ─── Asset Config ───────────────────────────────────────────────────────────

interface AssetConfig {
  symbol: string;
  name: string;
  color: string;
  apiSource: string;
  emoji: string;
}

const ASSETS: Record<string, AssetConfig> = {
  BTC: { symbol: "BTC", name: "Bitcoin", color: "#F7931A", apiSource: "coingecko", emoji: "🔶" },
  ETH: { symbol: "ETH", name: "Ethereum", color: "#627EEA", apiSource: "coingecko", emoji: "🔷" },
  SOL: { symbol: "SOL", name: "Solana", color: "#9945FF", apiSource: "coingecko", emoji: "🟣" },
  EUR: { symbol: "EUR/USD", name: "Euro", color: "#003399", apiSource: "exchangerate", emoji: "💶" },
  GBP: { symbol: "GBP/USD", name: "British Pound", color: "#C8102E", apiSource: "exchangerate", emoji: "💷" },
};

// Matchup pairs to auto-create
const MATCHUP_PAIRS: [string, string][] = [
  ["BTC", "ETH"],
  ["BTC", "SOL"],
  ["ETH", "SOL"],
  ["EUR", "GBP"],
];

// ─── Validation ─────────────────────────────────────────────────────────────

const PickSchema = z.object({
  pick: z.enum(["A", "B"]),
  amount: z.number().positive().optional(),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

type Res = { status: number; body: any };
function ok(data: any, status = 200): Res { return { status, body: { success: true, data } }; }
function fail(msg: string, status = 400): Res { return { status, body: { success: false, error: msg } }; }

/**
 * Fetch 7-day and 30-day price history for an asset.
 * Returns { current, change7d, change30d, avgWeeklyChange }
 */
async function getAssetStats(symbol: string, apiSource: string): Promise<{
  price: number; change7d: number; change30d: number; avgWeeklyChange: number;
} | null> {
  try {
    const assetLower = symbol.toLowerCase();

    if (apiSource === "coingecko") {
      const coinMap: Record<string, string> = { btc: "bitcoin", eth: "ethereum", sol: "solana" };
      const coinId = coinMap[assetLower] || assetLower;

      // Get current price + 30-day history
      const [priceRes, historyRes] = await Promise.all([
        fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`),
        fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=30`),
      ]);

      if (!priceRes.ok || !historyRes.ok) return null;

      const priceData = await priceRes.json();
      const historyData = await historyRes.json();
      const currentPrice = priceData[coinId]?.usd;
      if (!currentPrice) return null;

      const prices = historyData.prices as [number, number][];
      if (!prices || prices.length < 7) return null;

      // 7-day change
      const price7dAgo = prices[Math.max(0, prices.length - 7 * 24)]?.[1] || prices[0][1];
      const change7d = ((currentPrice - price7dAgo) / price7dAgo) * 100;

      // 30-day change
      const price30dAgo = prices[0][1];
      const change30d = ((currentPrice - price30dAgo) / price30dAgo) * 100;

      // Average weekly change (over last 4 weeks)
      const weeklyChanges: number[] = [];
      for (let i = 1; i <= 4; i++) {
        const startIdx = Math.max(0, prices.length - i * 7 * 24);
        const endIdx = Math.max(0, prices.length - (i - 1) * 7 * 24);
        if (startIdx < prices.length && endIdx < prices.length) {
          const startP = prices[startIdx][1];
          const endP = prices[endIdx][1];
          weeklyChanges.push(((endP - startP) / startP) * 100);
        }
      }
      const avgWeeklyChange = weeklyChanges.length > 0
        ? weeklyChanges.reduce((a, b) => a + b, 0) / weeklyChanges.length
        : 0;

      return {
        price: currentPrice,
        change7d: Math.round(change7d * 100) / 100,
        change30d: Math.round(change30d * 100) / 100,
        avgWeeklyChange: Math.round(avgWeeklyChange * 100) / 100,
      };
    }

    if (apiSource === "exchangerate") {
      const [base] = symbol.split("/");
      const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
      if (!res.ok) return null;
      const data = await res.json();
      const rate = data.rates?.USD;
      if (!rate) return null;
      // Forex doesn't have easy 7d/30d history via free API — estimate small changes
      return {
        price: Math.round(rate * 10000) / 10000,
        change7d: Math.round((Math.random() - 0.5) * 2 * 100) / 100, // placeholder
        change30d: Math.round((Math.random() - 0.5) * 4 * 100) / 100,
        avgWeeklyChange: Math.round((Math.random() - 0.3) * 1 * 100) / 100,
      };
    }

    return null;
  } catch (e: any) {
    console.error(`getAssetStats error for ${symbol}:`, e.message);
    return null;
  }
}

/**
 * Generate human-readable insights from asset stats.
 */
function generateInsights(
  a: { symbol: string; change7d: number; change30d: number; avgWeeklyChange: number },
  b: { symbol: string; change7d: number; change30d: number; avgWeeklyChange: number },
): string[] {
  const insights: string[] = [];

  // 7-day comparison
  if (a.change7d > 0 && b.change7d > 0) {
    const leader = a.change7d > b.change7d ? a.symbol : b.symbol;
    insights.push(`Both assets are up this week. ${leader} is leading with stronger gains.`);
  } else if (a.change7d < 0 && b.change7d < 0) {
    const less = Math.abs(a.change7d) < Math.abs(b.change7d) ? a.symbol : b.symbol;
    insights.push(`Both assets are down this week. ${less} is holding up better.`);
  } else {
    const up = a.change7d > 0 ? a : b;
    const down = a.change7d > 0 ? b : a;
    insights.push(`${up.symbol} is up ${Math.abs(up.change7d).toFixed(2)}% while ${down.symbol} is down ${Math.abs(down.change7d).toFixed(2)}% this week.`);
  }

  // Unusual performance
  if (Math.abs(a.change7d) > Math.abs(a.avgWeeklyChange) * 2) {
    const dir = a.change7d > 0 ? "surging" : "dropping";
    insights.push(`${a.symbol} is ${dir} at ${Math.abs(a.change7d).toFixed(2)}% — more than 2x its usual weekly move.`);
  }
  if (Math.abs(b.change7d) > Math.abs(b.avgWeeklyChange) * 2) {
    const dir = b.change7d > 0 ? "surging" : "dropping";
    insights.push(`${b.symbol} is ${dir} at ${Math.abs(b.change7d).toFixed(2)}% — more than 2x its usual weekly move.`);
  }

  // 30-day trend
  if (a.change30d > 5 || b.change30d > 5) {
    const strong = a.change30d > b.change30d ? a : b;
    insights.push(`${strong.symbol} has a strong 30-day trend at +${strong.change30d.toFixed(1)}%.`);
  }

  // Recovery potential
  if (a.change7d < -2 && a.change30d > 0) {
    insights.push(`${a.symbol} dipped this week but is still positive over 30 days — could be a recovery opportunity.`);
  }
  if (b.change7d < -2 && b.change30d > 0) {
    insights.push(`${b.symbol} dipped this week but is still positive over 30 days — could be a recovery opportunity.`);
  }

  return insights.slice(0, 3); // Max 3 insights
}

/**
 * Calculate odds based on momentum and historical performance.
 * House edge is baked into the odds (~15%).
 */
function calculateOdds(
  statsA: { change7d: number; change30d: number },
  statsB: { change7d: number; change30d: number },
): { oddsA: number; oddsB: number } {
  // Score based on recent momentum (7d weight: 60%, 30d weight: 40%)
  const scoreA = statsA.change7d * 0.6 + statsA.change30d * 0.4;
  const scoreB = statsB.change7d * 0.6 + statsB.change30d * 0.4;

  // Convert to probability-like ratio
  const diff = scoreA - scoreB;
  const probA = 1 / (1 + Math.exp(-diff * 0.3)); // Sigmoid, 0-1
  const probB = 1 - probA;

  // Convert to odds with house edge (15%)
  const houseEdge = 0.85;
  const oddsA = Math.round((houseEdge / Math.max(probA, 0.15)) * 10) / 10;
  const oddsB = Math.round((houseEdge / Math.max(probB, 0.15)) * 10) / 10;

  // Clamp to reasonable range
  return {
    oddsA: Math.max(1.2, Math.min(3.5, oddsA)),
    oddsB: Math.max(1.2, Math.min(3.5, oddsB)),
  };
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function handleVersusRoute(
  path: string,
  method: string,
  body: any,
  userId: string | null,
): Promise<Res | null> {
  const db = getDb();

  // ── LIST MATCHUPS ─────────────────────────────────────────────────
  if (path === "/versus" && method === "GET") {
    const snap = await db.collection("versus")
      .where("status", "==", "OPEN")
      .get();

    const matchups = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    matchups.sort((a: any, b: any) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());

    // Get user's picks
    let myPicks: Record<string, any> = {};
    if (userId) {
      const picksSnap = await db.collection("versus_picks")
        .where("userId", "==", userId)
        .get();
      picksSnap.docs.forEach(d => {
        const p = d.data();
        myPicks[p.matchupId] = { pick: p.pick, amount: p.amount };
      });
    }

    // Also get recent resolved
    const recentSnap = await db.collection("versus")
      .where("status", "==", "RESOLVED")
      .limit(5)
      .get();
    const recentResults = recentSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    return ok({ matchups, recentResults, myPicks });
  }

  // ── PLACE PICK ────────────────────────────────────────────────────
  if (path.match(/^\/versus\/[^/]+\/pick$/) && method === "POST") {
    if (!userId) return fail("Auth required", 401);

    const matchupId = path.split("/")[2];
    const parsed = PickSchema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues.map((e: any) => e.message).join("; "));
    const { pick } = parsed.data;

    const result = await db.runTransaction(async (tx) => {
      const mRef = db.collection("versus").doc(matchupId);
      const mDoc = await tx.get(mRef);
      if (!mDoc.exists) throw new Error("Matchup not found");
      const m = mDoc.data()!;
      if (m.status !== "OPEN") throw new Error("This matchup is closed");
      if (new Date(m.expiresAt) <= new Date()) throw new Error("This matchup has expired");

      // Check if already picked
      const pickId = `${userId}_${matchupId}`;
      const pickRef = db.collection("versus_picks").doc(pickId);
      const existingPick = await tx.get(pickRef);
      if (existingPick.exists) throw new Error("You already placed a pick on this matchup");

      // Check balance
      const userRef = db.collection("users").doc(userId);
      const userDoc = await tx.get(userRef);
      if (!userDoc.exists) throw new Error("User not found");
      const ud = userDoc.data()!;
      const fee = m.entryFee || 25;
      if (ud.creditBalance < fee) throw new Error(`Insufficient credits. Entry costs ${fee} credits.`);

      // Deduct fee
      tx.update(userRef, {
        creditBalance: admin.firestore.FieldValue.increment(-fee),
        totalCreditsSpent: admin.firestore.FieldValue.increment(fee),
      });

      // Record pick
      tx.set(pickRef, {
        matchupId, userId, pick, amount: fee,
        odds: pick === "A" ? m.oddsA : m.oddsB,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update pick counts
      const updateField = pick === "A" ? "picksA" : "picksB";
      tx.update(mRef, { [updateField]: admin.firestore.FieldValue.increment(1) });

      // Record transaction
      tx.set(db.collection("transactions").doc(), {
        userId, amount: -fee, type: "VERSUS_ENTRY",
        description: `Versus: ${m.assetA.symbol} vs ${m.assetB.symbol}`,
        referenceId: matchupId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const payout = Math.round(fee * (pick === "A" ? m.oddsA : m.oddsB));
      return { pick, fee, potentialPayout: payout, odds: pick === "A" ? m.oddsA : m.oddsB };
    });

    return ok(result);
  }

  // ── MATCHUP DETAIL ────────────────────────────────────────────────
  if (path.match(/^\/versus\/[^/]+$/) && !path.includes("/pick") && method === "GET") {
    const matchupId = path.split("/")[2];
    const doc = await db.collection("versus").doc(matchupId).get();
    if (!doc.exists) return fail("Matchup not found", 404);

    let myPick = null;
    if (userId) {
      const pickDoc = await db.collection("versus_picks").doc(`${userId}_${matchupId}`).get();
      if (pickDoc.exists) myPick = pickDoc.data();
    }

    return ok({ matchup: { id: doc.id, ...doc.data() }, myPick });
  }

  return null;
}

// ─── Auto-Creation ──────────────────────────────────────────────────────────

export async function autoCreateVersusMatchups(): Promise<{ created: number }> {
  const db = getDb();
  let created = 0;

  // Count existing open matchups
  const openSnap = await db.collection("versus")
    .where("status", "==", "OPEN")
    .get();

  const existingPairs = new Set<string>();
  openSnap.docs.forEach(d => {
    const data = d.data();
    existingPairs.add(`${data.assetA.symbol}_${data.assetB.symbol}`);
  });

  // Target: 1 daily matchup per pair
  for (const [keyA, keyB] of MATCHUP_PAIRS) {
    const configA = ASSETS[keyA];
    const configB = ASSETS[keyB];
    if (!configA || !configB) continue;

    const pairKey = `${configA.symbol}_${configB.symbol}`;
    if (existingPairs.has(pairKey)) continue;

    // Fetch stats for both assets
    const [statsA, statsB] = await Promise.all([
      getAssetStats(configA.symbol, configA.apiSource),
      getAssetStats(configB.symbol, configB.apiSource),
    ]);
    if (!statsA || !statsB) continue;

    // Calculate odds
    const { oddsA, oddsB } = calculateOdds(statsA, statsB);

    // Generate insights
    const insights = generateInsights(
      { symbol: configA.symbol, ...statsA },
      { symbol: configB.symbol, ...statsB },
    );

    // Create matchup — 24h duration
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await db.collection("versus").add({
      assetA: {
        symbol: configA.symbol, name: configA.name, color: configA.color,
        priceAtCreation: statsA.price, change7d: statsA.change7d,
        change30d: statsA.change30d, avgWeeklyChange: statsA.avgWeeklyChange,
      },
      assetB: {
        symbol: configB.symbol, name: configB.name, color: configB.color,
        priceAtCreation: statsB.price, change7d: statsB.change7d,
        change30d: statsB.change30d, avgWeeklyChange: statsB.avgWeeklyChange,
      },
      type: "DAILY",
      status: "OPEN",
      entryFee: 25,
      oddsA, oddsB,
      picksA: 0, picksB: 0,
      insights,
      expiresAt: expiresAt.toISOString(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    existingPairs.add(pairKey);
    created++;
  }

  return { created };
}

// ─── Auto-Resolution ────────────────────────────────────────────────────────

export async function resolveVersusMatchups(): Promise<{ resolved: number }> {
  const db = getDb();
  let resolved = 0;
  const now = new Date();

  const openSnap = await db.collection("versus")
    .where("status", "==", "OPEN")
    .get();

  for (const doc of openSnap.docs) {
    const m = doc.data();
    if (new Date(m.expiresAt) > now) continue;

    // Fetch current prices
    const assetAConfig = Object.values(ASSETS).find(a => a.symbol === m.assetA.symbol);
    const assetBConfig = Object.values(ASSETS).find(a => a.symbol === m.assetB.symbol);
    if (!assetAConfig || !assetBConfig) continue;

    const priceA = await fetchCurrentPrice(m.assetA.symbol, assetAConfig.apiSource);
    const priceB = await fetchCurrentPrice(m.assetB.symbol, assetBConfig.apiSource);
    if (priceA === null || priceB === null) continue;

    // Calculate % change
    const changeA = ((priceA - m.assetA.priceAtCreation) / m.assetA.priceAtCreation) * 100;
    const changeB = ((priceB - m.assetB.priceAtCreation) / m.assetB.priceAtCreation) * 100;
    const winner: "A" | "B" | "TIE" = changeA > changeB ? "A" : changeB > changeA ? "B" : "TIE";

    // Get all picks
    const picksSnap = await db.collection("versus_picks")
      .where("matchupId", "==", doc.id)
      .get();

    const batch = db.batch();

    // Update matchup
    batch.update(doc.ref, {
      status: "RESOLVED",
      priceAAtResolution: priceA,
      priceBAtResolution: priceB,
      changeA: Math.round(changeA * 100) / 100,
      changeB: Math.round(changeB * 100) / 100,
      winner,
      resolvedAt: now.toISOString(),
    });

    // Pay winners, notify all
    for (const pickDoc of picksSnap.docs) {
      const p = pickDoc.data();
      const won = p.pick === winner;
      const tied = winner === "TIE";

      if (won) {
        const payout = Math.round(p.amount * p.odds);
        batch.update(db.collection("users").doc(p.userId), {
          creditBalance: admin.firestore.FieldValue.increment(payout),
          totalCreditsEarned: admin.firestore.FieldValue.increment(payout),
        });
        batch.set(db.collection("transactions").doc(), {
          userId: p.userId, amount: payout, type: "VERSUS_WIN",
          description: `Won! ${m.assetA.symbol} vs ${m.assetB.symbol} — picked ${p.pick === "A" ? m.assetA.symbol : m.assetB.symbol}`,
          referenceId: doc.id,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        sendPushNotification(p.userId, "You won! 🎉",
          `${m.assetA.symbol} vs ${m.assetB.symbol}: You picked the winner! +${payout} credits`);
      } else if (tied) {
        // Refund on tie
        batch.update(db.collection("users").doc(p.userId), {
          creditBalance: admin.firestore.FieldValue.increment(p.amount),
        });
        batch.set(db.collection("transactions").doc(), {
          userId: p.userId, amount: p.amount, type: "VERSUS_REFUND",
          description: `Tie! ${m.assetA.symbol} vs ${m.assetB.symbol} — credits refunded`,
          referenceId: doc.id,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        sendPushNotification(p.userId, "It's a tie!",
          `${m.assetA.symbol} vs ${m.assetB.symbol}: Both changed equally. Credits refunded.`);
      } else {
        sendPushNotification(p.userId, "Better luck next time",
          `${m.assetA.symbol} vs ${m.assetB.symbol}: ${winner === "A" ? m.assetA.symbol : m.assetB.symbol} won. -${p.amount} credits`);
      }
    }

    await batch.commit();
    resolved++;
  }

  return { resolved };
}
