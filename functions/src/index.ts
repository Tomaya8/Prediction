/**
 * Predich — Firebase Cloud Functions Backend (Phase 1 Security + Stability)
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";

admin.initializeApp();
const db = admin.firestore();

// JWT secret from Firebase config (set via: firebase functions:config:set app.jwt_secret="your-secret")
// Fallback for dev only
const JWT_SECRET = functions.config().app?.jwt_secret || process.env.JWT_SECRET || "predich-change-me-in-production";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

function send(res: functions.Response, status: number, body: any): void {
  Object.entries(CORS).forEach(([k, v]) => res.set(k, v));
  res.status(status).json(body);
}
function ok(res: functions.Response, data: any, status = 200): void { send(res, status, { success: true, data }); }
function fail(res: functions.Response, msg: string, status = 400): void { send(res, status, { success: false, error: msg }); }

async function auth(req: functions.Request): Promise<{ id: string; email: string } | null> {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try {
    const p = jwt.verify(h.slice(7), JWT_SECRET) as any;
    return { id: p.userId, email: p.email };
  } catch { return null; }
}

function requireAuth(req: functions.Request, res: functions.Response): Promise<{ id: string; email: string }> | null {
  return auth(req).then(u => { if (!u) { fail(res, "Auth required", 401); return null; } return u; }) as any;
}

// ─── LMSR Pricing ────────────────────────────────────────────────────────────

function lmsrCost(outcomes: any[], b: number): number {
  let s = 0;
  for (const o of outcomes) {
    const q = Math.min((o.quantity || 0), b * 500); // Guard overflow
    s += Math.exp(q / b);
  }
  return b * Math.log(Math.max(s, 1e-10));
}

function buyCost(outcomes: any[], b: number, oid: string, amt: number): number {
  const before = lmsrCost(outcomes, b);
  const after = lmsrCost(outcomes.map((o: any) => o.id === oid ? { ...o, quantity: (o.quantity || 0) + amt } : o), b);
  return Math.round((after - before) * 100) / 100;
}

function prices(outcomes: any[], b: number): Record<string, number> {
  let s = 0;
  for (const o of outcomes) s += Math.exp(Math.min((o.quantity || 0), b * 500) / b);
  const p: Record<string, number> = {};
  for (const o of outcomes) p[o.id] = Math.round((Math.exp(Math.min((o.quantity || 0), b * 500) / b) / Math.max(s, 1e-10)) * 10000) / 10000;
  return p;
}

function sharesForCost(outcomes: any[], b: number, oid: string, budget: number): number {
  if (budget <= 0) return 0;
  let lo = 0, hi = Math.min(budget * 10, 1e7);
  for (let i = 0; i < 64; i++) { const m = (lo + hi) / 2; if (buyCost(outcomes, b, oid, m) < budget) lo = m; else hi = m; }
  return Math.floor(lo);
}

function parseOutcomes(d: any, docId: string): any[] {
  return (d.outcomes || []).map((o: any, i: number) => ({
    id: o.id || `${docId}-o${i}`, name: o.name, color: o.color || (i === 0 ? "#16A34A" : "#DC2626"), quantity: o.quantity || 0,
  }));
}

function marketToResponse(doc: admin.firestore.DocumentSnapshot): any {
  const d = doc.data()!;
  const oc = parseOutcomes(d, doc.id);
  const p = prices(oc, d.liquidityParameter || 1000);
  return {
    id: doc.id, title: d.title, description: d.description, category: d.category,
    expiresAt: d.expiresAt, totalVolume: d.totalVolume || 0, status: d.status || "ACTIVE",
    outcomes: oc.map((o: any) => ({ ...o, currentPrice: p[o.id] })), prices: p,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════

export const api = functions.https.onRequest(async (req, res) => {
  if (req.method === "OPTIONS") { Object.entries(CORS).forEach(([k, v]) => res.set(k, v)); res.status(204).send(""); return; }

  const path = req.path.replace(/^\/api/, "");
  const method = req.method;

  try {
    // ═══════════════════════════════════════════════════════════════════
    // AUTH
    // ═══════════════════════════════════════════════════════════════════

    if (path === "/auth/register" && method === "POST") {
      const { email, password, displayName } = req.body;
      if (!email || typeof email !== "string") { fail(res, "Valid email required"); return; }
      if (!password || password.length < 6) { fail(res, "Password must be at least 6 characters"); return; }
      const ex = await db.collection("users").where("email", "==", email.trim().toLowerCase()).limit(1).get();
      if (!ex.empty) { fail(res, "Email already in use", 409); return; }
      const hash = await bcrypt.hash(password, 10);
      const ref = db.collection("users").doc();
      const userData = {
        email: email.trim().toLowerCase(), displayName: displayName?.trim() || null, passwordHash: hash,
        creditBalance: 1000, totalCreditsEarned: 1000, totalCreditsSpent: 0, totalTrades: 0, winningTrades: 0,
        totalWinnings: 0, roi: 0, currentStreak: 0, longestStreak: 0, isPremium: false, isAdmin: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      await ref.set(userData);
      await db.collection("transactions").add({ userId: ref.id, amount: 1000, type: "STARTING_BONUS", description: "Welcome bonus", createdAt: admin.firestore.FieldValue.serverTimestamp() });
      const token = jwt.sign({ userId: ref.id, email: userData.email }, JWT_SECRET, { expiresIn: "30d" });
      ok(res, { token, user: { id: ref.id, email: userData.email, displayName: userData.displayName, creditBalance: 1000 } }, 201); return;
    }

    if (path === "/auth/login" && method === "POST") {
      const { email, password } = req.body;
      if (!email || !password) { fail(res, "Email and password required"); return; }
      const snap = await db.collection("users").where("email", "==", email.trim().toLowerCase()).limit(1).get();
      if (snap.empty) { fail(res, "Invalid credentials", 401); return; }
      const doc = snap.docs[0]; const d = doc.data();
      if (!d.passwordHash || !(await bcrypt.compare(password, d.passwordHash))) { fail(res, "Invalid credentials", 401); return; }
      const token = jwt.sign({ userId: doc.id, email: d.email }, JWT_SECRET, { expiresIn: "30d" });
      ok(res, { token, user: { id: doc.id, email: d.email, displayName: d.displayName, creditBalance: d.creditBalance } }); return;
    }

    // ═══════════════════════════════════════════════════════════════════
    // MARKETS
    // ═══════════════════════════════════════════════════════════════════

    if (path === "/markets/meta/trending" && method === "GET") {
      const snap = await db.collection("markets").orderBy("totalVolume", "desc").limit(10).get();
      ok(res, snap.docs.map(d => marketToResponse(d))); return;
    }

    if (path === "/markets/meta/categories" && method === "GET") {
      ok(res, ["POLITICS", "SPORTS", "CRYPTO", "ENTERTAINMENT", "SCIENCE", "TECHNOLOGY", "BUSINESS", "OTHER"]); return;
    }

    if ((path === "/markets" || path === "/trades/markets") && method === "GET") {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      let q: admin.firestore.Query = db.collection("markets").limit(limit);
      const category = req.query.category as string;
      if (category) q = q.where("category", "==", category);
      const snap = await q.get();
      ok(res, snap.docs.map(d => marketToResponse(d))); return;
    }

    if ((path.match(/^\/markets\/[^/]+$/) || path.match(/^\/trades\/markets\/[^/]+$/)) && !path.includes("/comments") && method === "GET") {
      const parts = path.split("/"); const marketId = parts[parts.length - 1];
      if (marketId === "meta") { fail(res, "Route not found", 404); return; }
      const doc = await db.collection("markets").doc(marketId).get();
      if (!doc.exists) { fail(res, "Market not found", 404); return; }
      ok(res, marketToResponse(doc)); return;
    }

    // ═══════════════════════════════════════════════════════════════════
    // MARKET RESOLUTION (admin)
    // ═══════════════════════════════════════════════════════════════════

    if (path.match(/^\/markets\/[^/]+\/resolve$/) && method === "POST") {
      const user = await auth(req);
      if (!user) { fail(res, "Auth required", 401); return; }
      const uDoc = await db.collection("users").doc(user.id).get();
      if (!uDoc.exists || !uDoc.data()!.isAdmin) { fail(res, "Admin required", 403); return; }

      const marketId = path.split("/")[2];
      const { outcomeId } = req.body;
      if (!outcomeId) { fail(res, "outcomeId required"); return; }

      const marketRef = db.collection("markets").doc(marketId);
      const mDoc = await marketRef.get();
      if (!mDoc.exists) { fail(res, "Market not found", 404); return; }

      // Get all holdings for this market
      const holdingsSnap = await db.collection("holdings").where("marketId", "==", marketId).get();
      let winnersCount = 0;

      await db.runTransaction(async (tx) => {
        tx.update(marketRef, { status: "RESOLVED", resolvedOutcomeId: outcomeId, resolvedAt: admin.firestore.FieldValue.serverTimestamp() });

        for (const hDoc of holdingsSnap.docs) {
          const h = hDoc.data();
          if (h.quantity <= 0) continue;
          if (h.outcomeId === outcomeId) {
            const winnings = Math.floor(h.quantity);
            const userRef = db.collection("users").doc(h.userId);
            tx.update(userRef, {
              creditBalance: admin.firestore.FieldValue.increment(winnings),
              totalCreditsEarned: admin.firestore.FieldValue.increment(winnings),
              totalWinnings: admin.firestore.FieldValue.increment(winnings),
              winningTrades: admin.firestore.FieldValue.increment(1),
            });
            tx.set(db.collection("transactions").doc(), {
              userId: h.userId, amount: winnings, type: "MARKET_RESOLVED",
              description: `Winnings from ${mDoc.data()!.title}`, referenceId: marketId,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            winnersCount++;
          }
        }
      });
      ok(res, { message: "Market resolved", winnersCount }); return;
    }

    // ═══════════════════════════════════════════════════════════════════
    // TRADING
    // ═══════════════════════════════════════════════════════════════════

    if (path === "/trades/preview-by-cost" && method === "POST") {
      const { marketId, outcomeId, credits } = req.body;
      if (!marketId || !outcomeId || !credits || credits <= 0) { fail(res, "Missing fields"); return; }
      const doc = await db.collection("markets").doc(marketId).get();
      if (!doc.exists) { fail(res, "Market not found", 404); return; }
      const d = doc.data()!; const oc = parseOutcomes(d, doc.id); const b = d.liquidityParameter || 1000;
      const shares = sharesForCost(oc, b, outcomeId, credits);
      const actualCost = shares > 0 ? Math.max(1, Math.round(buyCost(oc, b, outcomeId, shares))) : 0;
      ok(res, { shares, actualCost, maxPayout: shares, pricePerShare: shares > 0 ? actualCost / shares : 0 }); return;
    }

    if (path === "/trades/preview" && method === "POST") {
      const { marketId, outcomeId, amount } = req.body;
      if (!marketId || !outcomeId || !amount || amount <= 0) { fail(res, "Missing fields"); return; }
      const doc = await db.collection("markets").doc(marketId).get();
      if (!doc.exists) { fail(res, "Market not found", 404); return; }
      const d = doc.data()!; const oc = parseOutcomes(d, doc.id); const b = d.liquidityParameter || 1000;
      const cost = Math.max(1, Math.round(buyCost(oc, b, outcomeId, amount)));
      ok(res, { cost, pricePerShare: cost / amount, amount }); return;
    }

    if (path === "/trades/preview-sell" && method === "POST") {
      const { marketId, outcomeId, amount } = req.body;
      if (!marketId || !outcomeId || !amount || amount <= 0) { fail(res, "Missing fields"); return; }
      const doc = await db.collection("markets").doc(marketId).get();
      if (!doc.exists) { fail(res, "Market not found", 404); return; }
      const d = doc.data()!; const oc = parseOutcomes(d, doc.id); const b = d.liquidityParameter || 1000;
      const revenue = Math.max(0, Math.round(-buyCost(oc, b, outcomeId, -amount)));
      const currentPrice = prices(oc, b)[outcomeId] || 0;
      ok(res, { revenue, pricePerShare: amount > 0 ? revenue / amount : 0, amount, currentPrice }); return;
    }

    if (path === "/trades/trade" && method === "POST") {
      const user = await auth(req);
      if (!user) { fail(res, "Auth required", 401); return; }
      const { marketId, outcomeId, amount, maxCost } = req.body;
      if (!marketId || !outcomeId || !amount || amount <= 0 || typeof amount !== "number") { fail(res, "Missing or invalid fields"); return; }
      if (amount > 1e6) { fail(res, "Amount too large"); return; }

      const marketRef = db.collection("markets").doc(marketId);
      const userRef = db.collection("users").doc(user.id);
      const hId = `${user.id}_${marketId}_${outcomeId}`;
      const hRef = db.collection("holdings").doc(hId);
      const result = await db.runTransaction(async (tx) => {
        const mDoc = await tx.get(marketRef);
        const uDoc = await tx.get(userRef);
        const hDoc = await tx.get(hRef);
        if (!mDoc.exists) throw new Error("Market not found");
        if (!uDoc.exists) throw new Error("User not found");
        const mD = mDoc.data()!; const uD = uDoc.data()!;
        if (mD.status === "RESOLVED" || mD.status === "CANCELLED") throw new Error("Market is closed");
        const b = mD.liquidityParameter || 1000; const oc = parseOutcomes(mD, mDoc.id);
        const c = Math.max(1, Math.round(buyCost(oc, b, outcomeId, amount)));
        if (uD.creditBalance < c) throw new Error("Insufficient credits");
        if (maxCost && c > maxCost) throw new Error(`Price moved. Cost ${c} exceeds max ${maxCost}`);
        const updated = oc.map((o: any) => o.id === outcomeId ? { ...o, quantity: o.quantity + amount } : o);
        tx.update(marketRef, { outcomes: updated, totalVolume: (mD.totalVolume || 0) + c });
        tx.update(userRef, { creditBalance: uD.creditBalance - c, totalCreditsSpent: (uD.totalCreditsSpent || 0) + c, totalTrades: (uD.totalTrades || 0) + 1 });
        tx.set(db.collection("trades").doc(), { userId: user.id, marketId, outcomeId, type: "BUY", quantity: amount, totalCost: c, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        if (hDoc.exists) { const h = hDoc.data()!; const nq = h.quantity + amount; tx.update(hRef, { quantity: nq, avgCost: (h.avgCost * h.quantity + c) / nq }); }
        else { tx.set(hRef, { userId: user.id, marketId, outcomeId, quantity: amount, avgCost: c / amount }); }
        tx.set(db.collection("transactions").doc(), { userId: user.id, amount: -c, type: "TRADE_BUY", description: `Bought ${amount} shares`, referenceId: marketId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        const newPrices = prices(updated, b);
        // Record price history snapshot
        tx.set(db.collection("price_history").doc(), { marketId, prices: newPrices, timestamp: admin.firestore.FieldValue.serverTimestamp() });
        return { cost: c, newBalance: uD.creditBalance - c, prices: newPrices, shares: amount };
      });
      ok(res, result); return;
    }

    if (path === "/trades/sell" && method === "POST") {
      const user = await auth(req);
      if (!user) { fail(res, "Auth required", 401); return; }
      const { marketId, outcomeId, amount } = req.body;
      if (!marketId || !outcomeId || !amount || amount <= 0 || typeof amount !== "number") { fail(res, "Missing or invalid fields"); return; }

      const marketRef = db.collection("markets").doc(marketId);
      const userRef = db.collection("users").doc(user.id);
      const hId = `${user.id}_${marketId}_${outcomeId}`;
      const hRef = db.collection("holdings").doc(hId);
      const result = await db.runTransaction(async (tx) => {
        const mDoc = await tx.get(marketRef);
        const uDoc = await tx.get(userRef);
        const hDoc = await tx.get(hRef);
        if (!mDoc.exists) throw new Error("Market not found");
        if (!uDoc.exists) throw new Error("User not found");
        if (!hDoc.exists || (hDoc.data()!.quantity || 0) < amount) throw new Error(`Insufficient shares. You own ${hDoc.exists ? hDoc.data()!.quantity : 0}`);
        const mD = mDoc.data()!; const uD = uDoc.data()!;
        if (mD.status === "RESOLVED" || mD.status === "CANCELLED") throw new Error("Market is closed");
        const b = mD.liquidityParameter || 1000; const oc = parseOutcomes(mD, mDoc.id);
        const revenue = Math.max(0, Math.round(-buyCost(oc, b, outcomeId, -amount)));
        const updated = oc.map((o: any) => o.id === outcomeId ? { ...o, quantity: o.quantity - amount } : o);
        tx.update(marketRef, { outcomes: updated, totalVolume: (mD.totalVolume || 0) + revenue });
        tx.update(userRef, { creditBalance: uD.creditBalance + revenue, totalCreditsEarned: (uD.totalCreditsEarned || 0) + revenue, totalTrades: (uD.totalTrades || 0) + 1 });
        const newQty = hDoc.data()!.quantity - amount;
        if (newQty <= 0) { tx.delete(hRef); } else { tx.update(hRef, { quantity: newQty }); }
        tx.set(db.collection("trades").doc(), { userId: user.id, marketId, outcomeId, type: "SELL", quantity: amount, totalCost: revenue, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        tx.set(db.collection("transactions").doc(), { userId: user.id, amount: revenue, type: "TRADE_SELL", description: `Sold ${amount} shares`, referenceId: marketId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        const newPrices = prices(updated, b);
        tx.set(db.collection("price_history").doc(), { marketId, prices: newPrices, timestamp: admin.firestore.FieldValue.serverTimestamp() });
        return { revenue, newBalance: uD.creditBalance + revenue, prices: newPrices, shares: amount };
      });
      ok(res, result); return;
    }

    if (path.match(/^\/markets\/[^/]+\/price-history$/) && method === "GET") {
      const marketId = path.split("/")[2];
      const snap = await db.collection("price_history").where("marketId", "==", marketId).orderBy("timestamp", "desc").limit(50).get();
      if (snap.empty) {
        // Return current prices as single data point
        const doc = await db.collection("markets").doc(marketId).get();
        if (doc.exists) {
          const d = doc.data()!; const oc = parseOutcomes(d, doc.id); const p = prices(oc, d.liquidityParameter || 1000);
          ok(res, [{ prices: p, timestamp: new Date().toISOString() }]);
        } else {
          ok(res, []);
        }
        return;
      }
      ok(res, snap.docs.map(d => {
        const data = d.data();
        return { prices: data.prices, timestamp: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString() };
      }).reverse()); return;
    }

    if (path.match(/^\/trades\/portfolio\/[^/]+$/) && method === "GET") {
      const userId = path.split("/")[3];
      const snap = await db.collection("holdings").where("userId", "==", userId).get();
      if (snap.empty) { ok(res, []); return; }

      // Batch read all markets (fix N+1)
      const marketIds = [...new Set(snap.docs.map(d => d.data().marketId))];
      const marketDocs = await db.getAll(...marketIds.map(id => db.collection("markets").doc(id)));
      const marketMap = new Map<string, admin.firestore.DocumentSnapshot>();
      marketDocs.forEach(d => { if (d.exists) marketMap.set(d.id, d); });

      const portfolio: any[] = [];
      for (const doc of snap.docs) {
        const h = doc.data(); if ((h.quantity || 0) <= 0) continue;
        const mDoc = marketMap.get(h.marketId);
        if (!mDoc) continue;
        const mD = mDoc.data()!; const oc = parseOutcomes(mD, mDoc.id); const b = mD.liquidityParameter || 1000;
        const p = prices(oc, b); const cp = p[h.outcomeId] || 0;
        const outcome = oc.find((o: any) => o.id === h.outcomeId);
        portfolio.push({
          id: doc.id, marketId: h.marketId, marketTitle: mD.title, marketStatus: mD.status || "ACTIVE",
          outcomeId: h.outcomeId, outcomeName: outcome?.name || "Unknown", outcomeColor: outcome?.color,
          quantity: h.quantity, avgCost: h.avgCost, currentPrice: cp,
          currentValue: Math.round(cp * h.quantity * 100) / 100,
          costBasis: Math.round(h.avgCost * h.quantity * 100) / 100,
          profitLoss: Math.round((cp * h.quantity - h.avgCost * h.quantity) * 100) / 100,
        });
      }
      ok(res, portfolio); return;
    }

    // ═══════════════════════════════════════════════════════════════════
    // USERS
    // ═══════════════════════════════════════════════════════════════════

    if (path === "/users/me" && method === "GET") {
      const user = await auth(req);
      if (!user) { fail(res, "Auth required", 401); return; }
      const doc = await db.collection("users").doc(user.id).get();
      if (!doc.exists) { fail(res, "User not found", 404); return; }
      const d = doc.data()!;
      ok(res, {
        id: doc.id, email: d.email, displayName: d.displayName, creditBalance: d.creditBalance,
        totalCreditsEarned: d.totalCreditsEarned || 0, totalCreditsSpent: d.totalCreditsSpent || 0,
        totalTrades: d.totalTrades || 0, winningTrades: d.winningTrades || 0, totalWinnings: d.totalWinnings || 0,
        roi: d.roi || 0, currentStreak: d.currentStreak || 0, longestStreak: d.longestStreak || 0,
        isPremium: d.isPremium || false,
        winRate: d.totalTrades > 0 ? Math.round((d.winningTrades / d.totalTrades) * 10000) / 100 : 0,
      }); return;
    }

    if (path === "/users/me" && method === "PUT") {
      const user = await auth(req);
      if (!user) { fail(res, "Auth required", 401); return; }
      const { displayName, avatarUrl } = req.body;
      const updates: any = {};
      if (displayName !== undefined) updates.displayName = displayName?.trim() || null;
      if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl?.trim() || null;
      if (Object.keys(updates).length === 0) { fail(res, "Nothing to update"); return; }
      await db.collection("users").doc(user.id).update(updates);
      ok(res, { message: "Profile updated" }); return;
    }

    if (path === "/users/me/transactions" && method === "GET") {
      const user = await auth(req);
      if (!user) { fail(res, "Auth required", 401); return; }
      const snap = await db.collection("transactions").where("userId", "==", user.id).orderBy("createdAt", "desc").limit(50).get();
      ok(res, snap.docs.map(d => ({ id: d.id, ...d.data() }))); return;
    }

    if (path === "/users/me/daily-reward" && method === "POST") {
      const user = await auth(req);
      if (!user) { fail(res, "Auth required", 401); return; }
      const userRef = db.collection("users").doc(user.id);

      // Use transaction to prevent race condition
      const result = await db.runTransaction(async (tx) => {
        const doc = await tx.get(userRef);
        if (!doc.exists) throw new Error("User not found");
        const d = doc.data()!;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        if (d.lastActiveDate && d.lastActiveDate.toDate() >= today) throw new Error("Already claimed");
        const reward = 50 + Math.min((d.currentStreak || 0) * 10, 100);
        const streak = (d.currentStreak || 0) + 1;
        tx.update(userRef, {
          creditBalance: admin.firestore.FieldValue.increment(reward),
          totalCreditsEarned: admin.firestore.FieldValue.increment(reward),
          currentStreak: streak,
          longestStreak: Math.max(d.longestStreak || 0, streak),
          lastActiveDate: admin.firestore.Timestamp.now(),
        });
        tx.set(db.collection("transactions").doc(), {
          userId: user.id, amount: reward, type: "DAILY_REWARD",
          description: `Daily reward (streak: ${streak})`,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { reward, streak, balance: d.creditBalance + reward };
      });
      ok(res, result); return;
    }

    if (path === "/users/search" && method === "GET") {
      const q = (req.query.q as string || "").trim();
      if (q.length < 2) { fail(res, "Query too short"); return; }
      const snap = await db.collection("users").orderBy("displayName").startAt(q).endAt(q + "\uf8ff").limit(20).get();
      const user = await auth(req);
      ok(res, snap.docs.filter(d => d.id !== user?.id).map(doc => {
        const d = doc.data();
        return { id: doc.id, displayName: d.displayName, creditBalance: d.creditBalance, totalTrades: d.totalTrades || 0, winRate: d.totalTrades > 0 ? Math.round((d.winningTrades / d.totalTrades) * 100) : 0 };
      })); return;
    }

    // ═══════════════════════════════════════════════════════════════════
    // LEADERBOARD
    // ═══════════════════════════════════════════════════════════════════

    if (path === "/leaderboard" && method === "GET") {
      const snap = await db.collection("users").orderBy("creditBalance", "desc").limit(50).get();
      const user = await auth(req);
      let userRank: number | null = null;
      const lb = snap.docs.map((doc, i) => {
        const d = doc.data();
        if (doc.id === user?.id) userRank = i + 1;
        return { rank: i + 1, userId: doc.id, displayName: d.displayName || "Anonymous", score: d.creditBalance, totalTrades: d.totalTrades || 0, winRate: d.totalTrades > 0 ? Math.round((d.winningTrades / d.totalTrades) * 100) : 0 };
      });
      ok(res, { leaderboard: lb, userRank }); return;
    }

    if (path === "/leaderboard/achievements" && method === "GET") {
      const defaults = [
        { id: "1", code: "FIRST_TRADE", name: "First Trade", description: "Complete your first trade", criteriaType: "TRADES", criteriaValue: 1, creditReward: 50, earned: false },
        { id: "2", code: "STREAK_5", name: "5-Day Streak", description: "Login 5 days in a row", criteriaType: "STREAK", criteriaValue: 5, creditReward: 100, earned: false },
        { id: "3", code: "TRADES_10", name: "Active Trader", description: "Complete 10 trades", criteriaType: "TRADES", criteriaValue: 10, creditReward: 200, earned: false },
        { id: "4", code: "TRADES_50", name: "Power Trader", description: "Complete 50 trades", criteriaType: "TRADES", criteriaValue: 50, creditReward: 500, earned: false },
        { id: "5", code: "STREAK_30", name: "Monthly Streak", description: "Login 30 days in a row", criteriaType: "STREAK", criteriaValue: 30, creditReward: 500, earned: false },
        { id: "6", code: "WINS_10", name: "Winner", description: "Win 10 predictions", criteriaType: "WINS", criteriaValue: 10, creditReward: 300, earned: false },
      ];
      ok(res, defaults); return;
    }

    // ═══════════════════════════════════════════════════════════════════
    // COMMENTS (with auth on likes)
    // ═══════════════════════════════════════════════════════════════════

    if (path.match(/^\/markets\/[^/]+\/comments$/) && method === "GET") {
      const marketId = path.split("/")[2];
      const snap = await db.collection("comments").where("marketId", "==", marketId).limit(20).get();
      const comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      comments.sort((a: any, b: any) => (b.createdAt?._seconds || 0) - (a.createdAt?._seconds || 0));
      ok(res, comments); return;
    }

    if (path.match(/^\/markets\/[^/]+\/comments$/) && method === "POST") {
      const user = await auth(req);
      if (!user) { fail(res, "Auth required", 401); return; }
      const marketId = path.split("/")[2];
      const { content } = req.body;
      if (!content?.trim() || content.trim().length > 500) { fail(res, "Comment must be 1-500 characters"); return; }
      const userDoc = await db.collection("users").doc(user.id).get();
      const displayName = userDoc.exists ? userDoc.data()!.displayName : "Anonymous";
      const ref = await db.collection("comments").add({
        marketId, userId: user.id, content: content.trim(), likes: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        user: { id: user.id, displayName },
      });
      ok(res, { id: ref.id, marketId, userId: user.id, content: content.trim(), likes: 0, user: { id: user.id, displayName } }, 201); return;
    }

    if (path.match(/^\/markets\/[^/]+\/comments\/[^/]+\/like$/) && method === "POST") {
      const user = await auth(req);
      if (!user) { fail(res, "Auth required", 401); return; }
      const parts = path.split("/"); const commentId = parts[4];
      // Prevent duplicate likes
      const likeId = `${user.id}_${commentId}`;
      const likeRef = db.collection("comment_likes").doc(likeId);
      const likeDoc = await likeRef.get();
      if (likeDoc.exists) { fail(res, "Already liked", 409); return; }
      await likeRef.set({ userId: user.id, commentId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      await db.collection("comments").doc(commentId).update({ likes: admin.firestore.FieldValue.increment(1) });
      ok(res, { message: "Liked" }); return;
    }

    // ═══════════════════════════════════════════════════════════════════
    // SOCIAL
    // ═══════════════════════════════════════════════════════════════════

    if (path === "/social/friends" && method === "GET") {
      const user = await auth(req);
      if (!user) { fail(res, "Auth required", 401); return; }
      const snap = await db.collection("follows").where("followerId", "==", user.id).get();
      if (snap.empty) { ok(res, []); return; }

      // Batch read users (fix N+1)
      const userIds = snap.docs.map(d => d.data().followingId);
      const userDocs = await db.getAll(...userIds.map(id => db.collection("users").doc(id)));
      const friends = userDocs.filter(d => d.exists).map(d => {
        const data = d.data()!;
        return { id: d.id, displayName: data.displayName, creditBalance: data.creditBalance, totalTrades: data.totalTrades || 0, winRate: data.totalTrades > 0 ? Math.round((data.winningTrades / data.totalTrades) * 100) : 0 };
      });
      ok(res, friends); return;
    }

    if (path.match(/^\/social\/follow\/[^/]+$/) && method === "POST") {
      const user = await auth(req);
      if (!user) { fail(res, "Auth required", 401); return; }
      const followingId = path.split("/")[3];
      if (followingId === user.id) { fail(res, "Cannot follow yourself"); return; }
      await db.collection("follows").doc(`${user.id}_${followingId}`).set({ followerId: user.id, followingId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      ok(res, { message: "Following" }); return;
    }

    if (path.match(/^\/social\/follow\/[^/]+$/) && method === "DELETE") {
      const user = await auth(req);
      if (!user) { fail(res, "Auth required", 401); return; }
      await db.collection("follows").doc(`${user.id}_${path.split("/")[3]}`).delete();
      ok(res, { message: "Unfollowed" }); return;
    }

    if (path === "/social/challenges" && method === "GET") {
      const user = await auth(req);
      if (!user) { fail(res, "Auth required", 401); return; }
      ok(res, []); return;
    }

    if (path === "/social/referral" && method === "GET") {
      const user = await auth(req);
      if (!user) { fail(res, "Auth required", 401); return; }
      const doc = await db.collection("users").doc(user.id).get();
      const d = doc.data() || {};
      ok(res, { referralCode: d.referralCode || user.id.slice(0, 8).toUpperCase(), referralCount: 0, creditsEarned: 0 }); return;
    }

    // ═══════════════════════════════════════════════════════════════════
    // PROPOSALS (with duplicate vote prevention)
    // ═══════════════════════════════════════════════════════════════════

    if (path === "/proposals" && method === "GET") {
      const status = (req.query.status as string) || "PENDING";
      const snap = await db.collection("proposals").where("status", "==", status).limit(20).get();
      const proposals = snap.docs.map(d => ({ id: d.id, ...d.data(), hasVoted: false }));
      proposals.sort((a: any, b: any) => (b.upvotes || 0) - (a.upvotes || 0));
      ok(res, proposals); return;
    }

    if (path === "/proposals" && method === "POST") {
      const user = await auth(req);
      if (!user) { fail(res, "Auth required", 401); return; }
      const { title, description, category, outcomes, suggestedExpiry, resolutionCriteria } = req.body;
      if (!title?.trim() || title.trim().length < 5) { fail(res, "Title must be at least 5 characters"); return; }
      const userDoc = await db.collection("users").doc(user.id).get();
      const displayName = userDoc.exists ? userDoc.data()!.displayName : "Anonymous";
      const ref = await db.collection("proposals").add({
        title: title.trim(), description: description?.trim() || null, category: category || "OTHER",
        outcomes: Array.isArray(outcomes) && outcomes.length >= 2 ? outcomes : ["Yes", "No"],
        suggestedExpiry: suggestedExpiry || "", resolutionCriteria: resolutionCriteria || null,
        status: "PENDING", upvotes: 0, createdById: user.id,
        createdBy: { id: user.id, displayName },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      ok(res, { id: ref.id, title: title.trim(), status: "PENDING", upvotes: 0, createdBy: { id: user.id, displayName } }, 201); return;
    }

    if (path === "/proposals/mine" && method === "GET") {
      const user = await auth(req);
      if (!user) { fail(res, "Auth required", 401); return; }
      const snap = await db.collection("proposals").where("createdById", "==", user.id).limit(20).get();
      const proposals = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      proposals.sort((a: any, b: any) => (b.createdAt?._seconds || 0) - (a.createdAt?._seconds || 0));
      ok(res, proposals); return;
    }

    if (path.match(/^\/proposals\/[^/]+\/vote$/) && method === "POST") {
      const user = await auth(req);
      if (!user) { fail(res, "Auth required", 401); return; }
      const proposalId = path.split("/")[2];
      // Prevent duplicate votes
      const voteId = `${user.id}_${proposalId}`;
      const voteRef = db.collection("proposal_votes").doc(voteId);
      const voteDoc = await voteRef.get();
      if (voteDoc.exists) { fail(res, "Already voted", 409); return; }
      await voteRef.set({ userId: user.id, proposalId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      await db.collection("proposals").doc(proposalId).update({ upvotes: admin.firestore.FieldValue.increment(1) });
      ok(res, { message: "Voted" }); return;
    }

    // ═══════════════════════════════════════════════════════════════════
    // TOURNAMENTS
    // ═══════════════════════════════════════════════════════════════════

    if (path === "/tournaments" && method === "GET") {
      const snap = await db.collection("tournaments").get();
      ok(res, snap.docs.map(d => ({ id: d.id, ...d.data(), participants: 0 }))); return;
    }

    // ═══════════════════════════════════════════════════════════════════
    // HEALTH
    // ═══════════════════════════════════════════════════════════════════

    if (path === "/health" || path === "/") { ok(res, { status: "ok", version: "1.1.0" }); return; }

    fail(res, "Route not found", 404);
  } catch (e: any) {
    console.error("API Error:", e);
    const status = e.message?.includes("not found") ? 404 : e.message?.includes("Insufficient") ? 400 : 500;
    fail(res, e.message || "Internal server error", status);
  }
});
