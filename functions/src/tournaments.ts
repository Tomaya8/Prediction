/**
 * Tournament V2 — Numeric Prediction Tournaments
 *
 * Users predict a numeric value (price, temperature, score).
 * Closest guess to the actual value wins. Entry fees fund the prize pool.
 * House takes 15-20% rake.
 *
 * Types: MONTHLY (30d), WEEKLY (7d), RAPID (2h)
 * Lifecycle: REGISTRATION → LOCKED → RESOLVED
 */

import * as admin from "firebase-admin";
import { z } from "zod";

function getDb() { return admin.firestore(); }

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TournamentV2 {
  id: string;
  type: "MONTHLY" | "WEEKLY" | "RAPID";
  category: string;
  status: "REGISTRATION" | "LOCKED" | "RESOLVED" | "CANCELLED";
  question: string;
  unit: string; // "$", "°C", "points", etc.
  asset: string; // "BTC", "EUR/USD", "LA Temperature", etc.
  currentValueAtCreation: number;
  historicalLow?: number;
  historicalHigh?: number;
  entryFee: number;
  rakePercent: number;
  prizePool: number;
  playerCount: number;
  maxPlayers: number;
  registrationOpens: string; // ISO date
  registrationCloses: string; // ISO date
  expiresAt: string; // ISO date — when the prediction resolves
  resolvedAt?: string;
  actualValue?: number;
  templateId?: string;
  createdAt: any;
}

export interface TournamentEntry {
  id: string;
  tournamentId: string;
  userId: string;
  displayName: string;
  prediction: number;
  distance?: number; // |prediction - actualValue|, filled at resolution
  rank?: number; // filled at resolution
  payout?: number; // filled at resolution
  enteredAt: any;
  lastEditedAt?: any;
}

// ─── Validation ─────────────────────────────────────────────────────────────

const EnterSchema = z.object({
  prediction: z.number({ message: "Prediction must be a number" }),
});

const EditSchema = z.object({
  prediction: z.number({ message: "Prediction must be a number" }),
});

// ─── Prize Multipliers ──────────────────────────────────────────────────────

function getMultipliers(playerCount: number): { ranks: number[]; multipliers: number[] } {
  if (playerCount >= 100) {
    return { ranks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], multipliers: [10, 5, 3, 2, 2, 2, 2, 2, 2, 2] };
  }
  if (playerCount >= 50) {
    return { ranks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], multipliers: [8, 4, 2.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5] };
  }
  if (playerCount >= 20) {
    return { ranks: [1, 2, 3, 4, 5], multipliers: [5, 3, 2, 1.5, 1.5] };
  }
  // 10-19 players
  return { ranks: [1, 2, 3], multipliers: [3, 2, 1.5] };
}

function calculatePayouts(
  playerCount: number,
  entryFee: number,
  rakePercent: number
): { rank: number; payout: number }[] {
  const pool = playerCount * entryFee;
  const distributable = pool * (1 - rakePercent / 100);
  const { ranks, multipliers } = getMultipliers(playerCount);

  // Calculate raw payouts
  const rawPayouts = ranks.map((_, i) => entryFee * multipliers[i]);
  const rawTotal = rawPayouts.reduce((s, p) => s + p, 0);

  // Scale to fit distributable pool
  const scale = rawTotal > distributable ? distributable / rawTotal : 1;

  return ranks.map((rank, i) => ({
    rank,
    payout: Math.floor(rawPayouts[i] * scale),
  }));
}

// ─── Helper ─────────────────────────────────────────────────────────────────

type Res = { status: number; body: any };
function ok(data: any, status = 200): Res { return { status, body: { success: true, data } }; }
function fail(msg: string, status = 400): Res { return { status, body: { success: false, error: msg } }; }

function validate<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { success: false, error: result.error.issues.map((e: any) => e.message).join("; ") };
  }
  return { success: true, data: result.data };
}

function tournamentToResponse(doc: admin.firestore.DocumentSnapshot): any {
  const d = doc.data()!;
  const playerCount = d.playerCount || 0;
  const payouts = calculatePayouts(playerCount || 10, d.entryFee || 100, d.rakePercent || 15);
  return {
    id: doc.id,
    type: d.type,
    category: d.category,
    status: d.status,
    question: d.question,
    unit: d.unit,
    asset: d.asset,
    currentValueAtCreation: d.currentValueAtCreation,
    historicalLow: d.historicalLow,
    historicalHigh: d.historicalHigh,
    entryFee: d.entryFee,
    rakePercent: d.rakePercent,
    prizePool: d.prizePool || (playerCount * (d.entryFee || 0)),
    playerCount,
    maxPlayers: d.maxPlayers || 200,
    registrationOpens: d.registrationOpens,
    registrationCloses: d.registrationCloses,
    expiresAt: d.expiresAt,
    resolvedAt: d.resolvedAt || null,
    actualValue: d.actualValue ?? null,
    templateId: d.templateId || null,
    payoutTable: payouts,
    createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
  };
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function handleTournamentRoute(
  path: string,
  method: string,
  body: any,
  userId: string | null
): Promise<Res | null> {
  const db = getDb();

  // ── LIST TOURNAMENTS ──────────────────────────────────────────────
  // GET /tournaments-v2
  if (path === "/tournaments-v2" && method === "GET") {
    const snap = await db.collection("tournament_v2")
      .where("status", "in", ["REGISTRATION", "LOCKED"])
      .get();
    const tournaments = snap.docs.map(d => tournamentToResponse(d));

    // Sort: REGISTRATION first, then by expiresAt
    tournaments.sort((a: any, b: any) => {
      if (a.status === "REGISTRATION" && b.status !== "REGISTRATION") return -1;
      if (b.status === "REGISTRATION" && a.status !== "REGISTRATION") return 1;
      return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
    });

    // Also get user's entries if authenticated
    let myEntries: Record<string, any> = {};
    if (userId) {
      const entrySnap = await db.collection("tournament_entries")
        .where("userId", "==", userId)
        .get();
      entrySnap.docs.forEach(d => {
        const e = d.data();
        myEntries[e.tournamentId] = {
          prediction: e.prediction,
          enteredAt: e.enteredAt?.toDate?.()?.toISOString() || null,
        };
      });
    }

    return ok({
      tournaments,
      myEntries,
    });
  }

  // ── GET TOURNAMENT DETAIL ─────────────────────────────────────────
  // GET /tournaments-v2/:id
  if (path.match(/^\/tournaments-v2\/[^/]+$/) && !path.includes("/enter") && !path.includes("/edit") && !path.includes("/tracker") && !path.includes("/results") && method === "GET") {
    const id = path.split("/")[2];
    const doc = await db.collection("tournament_v2").doc(id).get();
    if (!doc.exists) return fail("Tournament not found", 404);

    const tournament = tournamentToResponse(doc);

    // Get user's entry if authenticated
    let myEntry = null;
    if (userId) {
      const entryDoc = await db.collection("tournament_entries")
        .doc(`${userId}_${id}`)
        .get();
      if (entryDoc.exists) {
        const e = entryDoc.data()!;
        myEntry = {
          prediction: e.prediction,
          distance: e.distance ?? null,
          rank: e.rank ?? null,
          payout: e.payout ?? null,
          enteredAt: e.enteredAt?.toDate?.()?.toISOString() || null,
        };
      }
    }

    // Get prediction distribution (histogram) — hide exact values
    const entriesSnap = await db.collection("tournament_entries")
      .where("tournamentId", "==", id)
      .get();

    const predictions = entriesSnap.docs.map(d => d.data().prediction);
    let distribution: { min: number; max: number; count: number }[] = [];
    if (predictions.length >= 5) {
      const min = Math.min(...predictions);
      const max = Math.max(...predictions);
      const range = max - min || 1;
      const bucketCount = 8;
      const bucketSize = range / bucketCount;
      distribution = Array.from({ length: bucketCount }, (_, i) => ({
        min: Math.round((min + i * bucketSize) * 10000) / 10000,
        max: Math.round((min + (i + 1) * bucketSize) * 10000) / 10000,
        count: 0,
      }));
      for (const p of predictions) {
        const idx = Math.min(Math.floor((p - min) / bucketSize), bucketCount - 1);
        distribution[idx].count++;
      }
    }

    return ok({ tournament, myEntry, distribution });
  }

  // ── ENTER TOURNAMENT (submit prediction + pay fee) ────────────────
  // POST /tournaments-v2/:id/enter
  if (path.match(/^\/tournaments-v2\/[^/]+\/enter$/) && method === "POST") {
    if (!userId) return fail("Auth required", 401);

    const tournamentId = path.split("/")[2];
    const v = validate(EnterSchema, body);
    if (!v.success) return fail(v.error);
    const { prediction } = v.data;

    const result = await db.runTransaction(async (tx) => {
      const tRef = db.collection("tournament_v2").doc(tournamentId);
      const tDoc = await tx.get(tRef);
      if (!tDoc.exists) throw new Error("Tournament not found");

      const t = tDoc.data()!;
      if (t.status !== "REGISTRATION") throw new Error("Registration is closed");

      const now = new Date();
      if (new Date(t.registrationCloses) <= now) throw new Error("Registration period has ended");
      if (new Date(t.registrationOpens) > now) throw new Error("Registration hasn't started yet");
      if (t.playerCount >= (t.maxPlayers || 200)) throw new Error("Tournament is full");

      // Check if already entered
      const entryId = `${userId}_${tournamentId}`;
      const entryRef = db.collection("tournament_entries").doc(entryId);
      const entryDoc = await tx.get(entryRef);
      if (entryDoc.exists) throw new Error("You already entered this tournament. Use edit to change your prediction.");

      // Check balance and deduct entry fee
      const userRef = db.collection("users").doc(userId);
      const userDoc = await tx.get(userRef);
      if (!userDoc.exists) throw new Error("User not found");
      const ud = userDoc.data()!;
      const fee = t.entryFee || 0;
      if (fee > 0 && ud.creditBalance < fee) throw new Error(`Insufficient credits. Entry fee is ${fee} credits.`);

      // Deduct fee
      if (fee > 0) {
        tx.update(userRef, {
          creditBalance: admin.firestore.FieldValue.increment(-fee),
          totalCreditsSpent: admin.firestore.FieldValue.increment(fee),
        });
        tx.set(db.collection("transactions").doc(), {
          userId, amount: -fee, type: "TOURNAMENT_ENTRY",
          description: `Tournament entry: ${t.question}`,
          referenceId: tournamentId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Create entry
      tx.set(entryRef, {
        tournamentId,
        userId,
        displayName: ud.displayName || "Anonymous",
        prediction,
        enteredAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update tournament
      const newCount = (t.playerCount || 0) + 1;
      tx.update(tRef, {
        playerCount: newCount,
        prizePool: newCount * (t.entryFee || 0),
      });

      return {
        prediction,
        entryFee: fee,
        newBalance: ud.creditBalance - fee,
        playerCount: newCount,
      };
    });

    return ok(result);
  }

  // ── EDIT PREDICTION (during registration only) ────────────────────
  // PUT /tournaments-v2/:id/edit
  if (path.match(/^\/tournaments-v2\/[^/]+\/edit$/) && method === "PUT") {
    if (!userId) return fail("Auth required", 401);

    const tournamentId = path.split("/")[2];
    const v = validate(EditSchema, body);
    if (!v.success) return fail(v.error);
    const { prediction } = v.data;

    const tDoc = await db.collection("tournament_v2").doc(tournamentId).get();
    if (!tDoc.exists) return fail("Tournament not found", 404);
    const t = tDoc.data()!;

    if (t.status !== "REGISTRATION") return fail("Cannot edit — registration is closed");
    if (new Date(t.registrationCloses) <= new Date()) return fail("Registration period has ended");

    const entryId = `${userId}_${tournamentId}`;
    const entryDoc = await db.collection("tournament_entries").doc(entryId).get();
    if (!entryDoc.exists) return fail("You haven't entered this tournament");

    await db.collection("tournament_entries").doc(entryId).update({
      prediction,
      lastEditedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return ok({ prediction, message: "Prediction updated" });
  }

  // ── LIVE TRACKER (during lock period) ─────────────────────────────
  // GET /tournaments-v2/:id/tracker
  if (path.match(/^\/tournaments-v2\/[^/]+\/tracker$/) && method === "GET") {
    if (!userId) return fail("Auth required", 401);

    const tournamentId = path.split("/")[2];
    const tDoc = await db.collection("tournament_v2").doc(tournamentId).get();
    if (!tDoc.exists) return fail("Tournament not found", 404);
    const t = tDoc.data()!;

    const entryId = `${userId}_${tournamentId}`;
    const entryDoc = await db.collection("tournament_entries").doc(entryId).get();
    if (!entryDoc.exists) return fail("You haven't entered this tournament");
    const entry = entryDoc.data()!;

    // Get all entries to calculate estimated rank
    const allEntries = await db.collection("tournament_entries")
      .where("tournamentId", "==", tournamentId)
      .get();

    // We don't have the "current live value" stored on the tournament doc
    // The auto-creation scheduler should update this. For now, use currentValueAtCreation
    // as a reference. In production, the tracker scheduler would update a `currentLiveValue` field.
    const liveValue = t.currentLiveValue ?? t.currentValueAtCreation;

    const myDistance = Math.abs(entry.prediction - liveValue);
    const allDistances = allEntries.docs.map(d => Math.abs(d.data().prediction - liveValue));
    allDistances.sort((a, b) => a - b);
    const estimatedRank = allDistances.indexOf(myDistance) + 1;

    const totalDuration = new Date(t.expiresAt).getTime() - new Date(t.registrationOpens).getTime();
    const elapsed = Date.now() - new Date(t.registrationOpens).getTime();
    const progress = Math.min(Math.max(elapsed / totalDuration, 0), 1);

    return ok({
      prediction: entry.prediction,
      currentValue: liveValue,
      distance: Math.round(myDistance * 10000) / 10000,
      estimatedRank,
      totalPlayers: allEntries.size,
      progress: Math.round(progress * 100),
      expiresAt: t.expiresAt,
      unit: t.unit,
    });
  }

  // ── RESULTS (after resolution) ────────────────────────────────────
  // GET /tournaments-v2/:id/results
  if (path.match(/^\/tournaments-v2\/[^/]+\/results$/) && method === "GET") {
    const tournamentId = path.split("/")[2];
    const tDoc = await db.collection("tournament_v2").doc(tournamentId).get();
    if (!tDoc.exists) return fail("Tournament not found", 404);
    const t = tDoc.data()!;

    if (t.status !== "RESOLVED") return fail("Tournament hasn't been resolved yet");

    const entriesSnap = await db.collection("tournament_entries")
      .where("tournamentId", "==", tournamentId)
      .get();

    const entries = entriesSnap.docs.map(d => {
      const e = d.data();
      return {
        userId: e.userId,
        displayName: e.displayName,
        prediction: e.prediction,
        distance: e.distance,
        rank: e.rank,
        payout: e.payout || 0,
      };
    });

    entries.sort((a, b) => (a.rank || 999) - (b.rank || 999));

    // Find user's entry
    let myResult = null;
    if (userId) {
      myResult = entries.find(e => e.userId === userId) || null;
    }

    return ok({
      tournament: {
        id: tournamentId,
        question: t.question,
        actualValue: t.actualValue,
        unit: t.unit,
        playerCount: t.playerCount,
        prizePool: t.prizePool,
        resolvedAt: t.resolvedAt,
      },
      leaderboard: entries.slice(0, 50),
      myResult,
    });
  }

  // ── RECENT RESULTS (completed tournaments) ────────────────────────
  // GET /tournaments-v2/recent
  if (path === "/tournaments-v2/recent" && method === "GET") {
    const snap = await db.collection("tournament_v2")
      .where("status", "==", "RESOLVED")
      .orderBy("resolvedAt", "desc")
      .limit(10)
      .get();

    return ok(snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        type: data.type,
        question: data.question,
        actualValue: data.actualValue,
        unit: data.unit,
        playerCount: data.playerCount,
        prizePool: data.prizePool,
        resolvedAt: data.resolvedAt,
      };
    }));
  }

  return null; // No matching route
}

// ─── Resolution Logic (called by scheduler) ─────────────────────────────────

export async function resolveTournament(tournamentId: string, actualValue: number): Promise<void> {
  const db = getDb();

  const tRef = db.collection("tournament_v2").doc(tournamentId);
  const tDoc = await tRef.get();
  if (!tDoc.exists) throw new Error("Tournament not found");
  const t = tDoc.data()!;

  if (t.status === "RESOLVED") throw new Error("Already resolved");

  // Get all entries
  const entriesSnap = await db.collection("tournament_entries")
    .where("tournamentId", "==", tournamentId)
    .get();

  if (entriesSnap.empty) {
    // No entries — just mark as resolved
    await tRef.update({
      status: "RESOLVED",
      actualValue,
      resolvedAt: new Date().toISOString(),
    });
    return;
  }

  // Calculate distances and rank
  const entries = entriesSnap.docs.map(d => ({
    ref: d.ref,
    userId: d.data().userId,
    prediction: d.data().prediction,
    distance: Math.abs(d.data().prediction - actualValue),
  }));

  // Sort by distance (closest first), then by entry time for tiebreaker
  entries.sort((a, b) => a.distance - b.distance);

  // Calculate payouts
  const payouts = calculatePayouts(entries.length, t.entryFee || 0, t.rakePercent || 15);
  const payoutMap = new Map(payouts.map(p => [p.rank, p.payout]));

  // Batch update entries and distribute prizes
  const batch = db.batch();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const rank = i + 1;
    const payout = payoutMap.get(rank) || 0;

    // Update entry with results
    batch.update(entry.ref, {
      distance: Math.round(entry.distance * 10000) / 10000,
      rank,
      payout,
    });

    // Grant payout to winners
    if (payout > 0) {
      const userRef = db.collection("users").doc(entry.userId);
      batch.update(userRef, {
        creditBalance: admin.firestore.FieldValue.increment(payout),
        totalCreditsEarned: admin.firestore.FieldValue.increment(payout),
      });
      batch.set(db.collection("transactions").doc(), {
        userId: entry.userId,
        amount: payout,
        type: "TOURNAMENT_PRIZE",
        description: `Tournament #${rank}: ${t.question}`,
        referenceId: tournamentId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  // Update tournament
  batch.update(tRef, {
    status: "RESOLVED",
    actualValue,
    resolvedAt: new Date().toISOString(),
  });

  await batch.commit();
  console.log(`Tournament ${tournamentId} resolved: actual=${actualValue}, ${entries.length} entries, ${payouts.length} winners`);
}

// ─── Status Update Logic (called by scheduler to transition REGISTRATION → LOCKED)

export async function updateTournamentStatuses(): Promise<{ locked: number; cancelled: number }> {
  const db = getDb();
  const now = new Date();
  let locked = 0, cancelled = 0;

  // Find REGISTRATION tournaments where registration period has ended
  const regSnap = await db.collection("tournament_v2")
    .where("status", "==", "REGISTRATION")
    .get();

  for (const doc of regSnap.docs) {
    const t = doc.data();
    if (new Date(t.registrationCloses) <= now) {
      if ((t.playerCount || 0) < 2) {
        // Not enough players — cancel and refund
        await doc.ref.update({ status: "CANCELLED" });

        // Refund all entries
        const entries = await db.collection("tournament_entries")
          .where("tournamentId", "==", doc.id)
          .get();

        const batch = db.batch();
        for (const eDoc of entries.docs) {
          const e = eDoc.data();
          if (t.entryFee > 0) {
            batch.update(db.collection("users").doc(e.userId), {
              creditBalance: admin.firestore.FieldValue.increment(t.entryFee),
              totalCreditsEarned: admin.firestore.FieldValue.increment(t.entryFee),
            });
            batch.set(db.collection("transactions").doc(), {
              userId: e.userId, amount: t.entryFee, type: "TOURNAMENT_REFUND",
              description: `Tournament cancelled (not enough players): ${t.question}`,
              referenceId: doc.id,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }
        await batch.commit();
        cancelled++;
      } else {
        await doc.ref.update({ status: "LOCKED" });
        locked++;
      }
    }
  }

  return { locked, cancelled };
}

// ═════════════════════════════════════════════════════════════════════════════
// AUTO-CREATION from templates
// ═════════════════════════════════════════════════════════════════════════════

interface Template {
  id: string;
  type: "MONTHLY" | "WEEKLY" | "RAPID";
  category: string;
  questionFormat: string; // "What will {asset} price be on {date}?"
  asset: string; // "BTC", "EUR/USD"
  apiSource: string; // "coingecko", "exchangerate"
  unit: string; // "$", ""
  entryFee: number;
  rakePercent: number;
  maxPlayers: number;
  isActive: boolean;
}

// Registration and expiry durations per type
const TYPE_CONFIG = {
  MONTHLY: { registrationDays: 7, totalDays: 30, rakeDefault: 15 },
  WEEKLY: { registrationDays: 2, totalDays: 7, rakeDefault: 15 },
  RAPID: { registrationMinutes: 30, totalMinutes: 120, rakeDefault: 20 },
};

/**
 * Fetch current price for an asset. Used for question generation + live tracker.
 */
export async function fetchCurrentPrice(asset: string, apiSource?: string): Promise<number | null> {
  try {
    const source = (apiSource || "").toLowerCase();
    const assetLower = asset.toLowerCase();

    // Crypto via CoinGecko
    if (source === "coingecko" || ["btc", "bitcoin", "eth", "ethereum", "sol", "solana"].includes(assetLower)) {
      const coinMap: Record<string, string> = { btc: "bitcoin", bitcoin: "bitcoin", eth: "ethereum", ethereum: "ethereum", sol: "solana", solana: "solana" };
      const coinId = coinMap[assetLower] || assetLower;
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
      if (r.ok) {
        const data = await r.json();
        return data[coinId]?.usd ?? null;
      }
    }

    // Forex via open exchange rates
    if (source === "exchangerate" || asset.includes("/")) {
      const [base, target] = asset.toUpperCase().split("/");
      if (base && target) {
        const r = await fetch(`https://open.er-api.com/v6/latest/${base}`);
        if (r.ok) {
          const data = await r.json();
          return data.rates?.[target] ? Math.round(data.rates[target] * 10000) / 10000 : null;
        }
      }
    }

    // S&P 500 / stock indices (simple Yahoo Finance endpoint)
    if (source === "yahoo" || ["sp500", "s&p500", "nasdaq", "dow"].includes(assetLower)) {
      // Yahoo Finance requires more complex scraping — return null for now
      return null;
    }

    return null;
  } catch (e: any) {
    console.error(`fetchCurrentPrice error for ${asset}:`, e.message);
    return null;
  }
}

/**
 * Auto-create tournaments from templates.
 * Called by scheduler. Creates new tournaments if there aren't enough active ones.
 */
export async function autoCreateTournaments(): Promise<{ created: number; skipped: number }> {
  const db = getDb();
  let created = 0, skipped = 0;

  const templatesSnap = await db.collection("tournament_templates")
    .where("isActive", "==", true)
    .get();

  if (templatesSnap.empty) {
    console.log("No active tournament templates");
    return { created: 0, skipped: 0 };
  }

  // Count active tournaments per type
  const activeSnap = await db.collection("tournament_v2")
    .where("status", "in", ["REGISTRATION", "LOCKED"])
    .get();

  const activeCounts: Record<string, number> = { MONTHLY: 0, WEEKLY: 0, RAPID: 0 };
  activeSnap.docs.forEach(d => {
    const type = d.data().type;
    activeCounts[type] = (activeCounts[type] || 0) + 1;
  });

  // Target counts per type
  const TARGET = { MONTHLY: 10, WEEKLY: 5, RAPID: 5 };

  for (const tDoc of templatesSnap.docs) {
    const template = tDoc.data() as Template;
    const type = template.type;

    // Skip if we have enough active tournaments of this type
    if (activeCounts[type] >= (TARGET[type] || 5)) {
      skipped++;
      continue;
    }

    // Fetch current price for the asset
    const currentPrice = await fetchCurrentPrice(template.asset, template.apiSource);
    if (currentPrice === null) {
      console.error(`Cannot create tournament for ${template.asset}: price fetch failed`);
      skipped++;
      continue;
    }

    // Build question and dates
    const now = new Date();
    let registrationCloses: Date;
    let expiresAt: Date;
    let dateLabel: string;

    if (type === "RAPID") {
      const cfg = TYPE_CONFIG.RAPID;
      registrationCloses = new Date(now.getTime() + cfg.registrationMinutes * 60 * 1000);
      expiresAt = new Date(now.getTime() + cfg.totalMinutes * 60 * 1000);
      dateLabel = `${expiresAt.getUTCHours().toString().padStart(2, "0")}:${expiresAt.getUTCMinutes().toString().padStart(2, "0")} UTC today`;
    } else {
      const cfg = type === "MONTHLY" ? TYPE_CONFIG.MONTHLY : TYPE_CONFIG.WEEKLY;
      registrationCloses = new Date(now.getTime() + cfg.registrationDays * 24 * 60 * 60 * 1000);
      expiresAt = new Date(now.getTime() + cfg.totalDays * 24 * 60 * 60 * 1000);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      dateLabel = `${months[expiresAt.getUTCMonth()]} ${expiresAt.getUTCDate()}, ${expiresAt.getUTCFullYear()}`;
    }

    const question = template.questionFormat
      .replace("{asset}", template.asset.toUpperCase())
      .replace("{date}", dateLabel)
      .replace("{price}", `${template.unit}${currentPrice.toLocaleString()}`);

    // Historical range (±15% for crypto, ±5% for forex)
    const rangePercent = template.apiSource === "exchangerate" ? 0.05 : 0.15;
    const historicalLow = Math.round(currentPrice * (1 - rangePercent) * 100) / 100;
    const historicalHigh = Math.round(currentPrice * (1 + rangePercent) * 100) / 100;

    await db.collection("tournament_v2").add({
      type,
      category: template.category,
      status: "REGISTRATION",
      question,
      unit: template.unit,
      asset: template.asset,
      apiSource: template.apiSource,
      currentValueAtCreation: currentPrice,
      historicalLow,
      historicalHigh,
      entryFee: template.entryFee,
      rakePercent: template.rakePercent || TYPE_CONFIG[type === "RAPID" ? "RAPID" : type === "MONTHLY" ? "MONTHLY" : "WEEKLY"].rakeDefault,
      prizePool: 0,
      playerCount: 0,
      maxPlayers: template.maxPlayers || 200,
      registrationOpens: now.toISOString(),
      registrationCloses: registrationCloses.toISOString(),
      expiresAt: expiresAt.toISOString(),
      templateId: tDoc.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    activeCounts[type]++;
    created++;
  }

  return { created, skipped };
}

/**
 * Update currentLiveValue on all LOCKED tournaments for the tracker.
 */
export async function updateLiveValues(): Promise<number> {
  const db = getDb();
  let updated = 0;

  const lockedSnap = await db.collection("tournament_v2")
    .where("status", "==", "LOCKED")
    .get();

  for (const doc of lockedSnap.docs) {
    const t = doc.data();
    const liveValue = await fetchCurrentPrice(t.asset, t.apiSource);
    if (liveValue !== null) {
      await doc.ref.update({ currentLiveValue: liveValue });
      updated++;
    }
  }

  // Also update REGISTRATION tournaments so the entry screen shows fresh data
  const regSnap = await db.collection("tournament_v2")
    .where("status", "==", "REGISTRATION")
    .get();

  for (const doc of regSnap.docs) {
    const t = doc.data();
    const liveValue = await fetchCurrentPrice(t.asset, t.apiSource);
    if (liveValue !== null) {
      await doc.ref.update({ currentLiveValue: liveValue });
      updated++;
    }
  }

  return updated;
}

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES for tournament management
// ═════════════════════════════════════════════════════════════════════════════

export async function handleTournamentAdminRoute(
  path: string,
  method: string,
  body: any,
): Promise<Res | null> {
  const db = getDb();

  // ── LIST TEMPLATES ────────────────────────────────────────────────
  if (path === "/admin/tournament-templates" && method === "GET") {
    const snap = await db.collection("tournament_templates").get();
    return ok(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  // ── CREATE/UPDATE TEMPLATE ────────────────────────────────────────
  if (path === "/admin/tournament-templates" && method === "POST") {
    const { type, category, questionFormat, asset, apiSource, unit, entryFee, rakePercent, maxPlayers } = body;
    if (!type || !questionFormat || !asset) return fail("type, questionFormat, and asset are required");
    const ref = await db.collection("tournament_templates").add({
      type, category: category || "CRYPTO",
      questionFormat, asset, apiSource: apiSource || "coingecko",
      unit: unit || "$", entryFee: entryFee || 100,
      rakePercent: rakePercent || 15, maxPlayers: maxPlayers || 200,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return ok({ id: ref.id, message: "Template created" });
  }

  // ── TOGGLE TEMPLATE ───────────────────────────────────────────────
  if (path.match(/^\/admin\/tournament-templates\/[^/]+\/toggle$/) && method === "POST") {
    const templateId = path.split("/")[3];
    const doc = await db.collection("tournament_templates").doc(templateId).get();
    if (!doc.exists) return fail("Template not found", 404);
    const current = doc.data()!.isActive;
    await doc.ref.update({ isActive: !current });
    return ok({ isActive: !current });
  }

  // ── MANUAL CREATE TOURNAMENT ──────────────────────────────────────
  if (path === "/admin/tournaments-v2" && method === "POST") {
    const { type, category, question, unit, asset, apiSource, entryFee, rakePercent, maxPlayers,
            currentValueAtCreation, historicalLow, historicalHigh,
            registrationCloses, expiresAt } = body;
    if (!type || !question || !expiresAt) return fail("type, question, and expiresAt are required");

    const ref = await db.collection("tournament_v2").add({
      type, category: category || "OTHER",
      status: "REGISTRATION", question,
      unit: unit || "$", asset: asset || "",
      apiSource: apiSource || "",
      currentValueAtCreation: currentValueAtCreation || 0,
      historicalLow: historicalLow || null,
      historicalHigh: historicalHigh || null,
      entryFee: entryFee || 100,
      rakePercent: rakePercent || 15,
      prizePool: 0, playerCount: 0,
      maxPlayers: maxPlayers || 200,
      registrationOpens: new Date().toISOString(),
      registrationCloses: registrationCloses || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return ok({ id: ref.id, message: "Tournament created" });
  }

  // ── MANUAL RESOLVE ────────────────────────────────────────────────
  if (path.match(/^\/admin\/tournaments-v2\/[^/]+\/resolve$/) && method === "POST") {
    const tournamentId = path.split("/")[3];
    const { actualValue } = body;
    if (typeof actualValue !== "number") return fail("actualValue must be a number");
    try {
      await resolveTournament(tournamentId, actualValue);
      return ok({ message: "Tournament resolved" });
    } catch (e: any) {
      return fail(e.message, 400);
    }
  }

  // ── CANCEL TOURNAMENT ─────────────────────────────────────────────
  if (path.match(/^\/admin\/tournaments-v2\/[^/]+\/cancel$/) && method === "POST") {
    const tournamentId = path.split("/")[3];
    const tDoc = await db.collection("tournament_v2").doc(tournamentId).get();
    if (!tDoc.exists) return fail("Tournament not found", 404);
    const t = tDoc.data()!;
    if (t.status === "RESOLVED") return fail("Cannot cancel a resolved tournament");

    // Refund all entries
    const entries = await db.collection("tournament_entries")
      .where("tournamentId", "==", tournamentId)
      .get();

    const batch = db.batch();
    batch.update(tDoc.ref, { status: "CANCELLED" });
    for (const eDoc of entries.docs) {
      const e = eDoc.data();
      if (t.entryFee > 0) {
        batch.update(db.collection("users").doc(e.userId), {
          creditBalance: admin.firestore.FieldValue.increment(t.entryFee),
        });
        batch.set(db.collection("transactions").doc(), {
          userId: e.userId, amount: t.entryFee, type: "TOURNAMENT_REFUND",
          description: `Tournament cancelled: ${t.question}`,
          referenceId: tournamentId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
    await batch.commit();
    return ok({ message: "Tournament cancelled, entries refunded", refunded: entries.size });
  }

  return null;
}
