/**
 * Predich — Firebase Cloud Functions Backend (Phase 1 Security + Stability)
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { z } from "zod";
import { handleAdminRoute } from "./admin";
import { handleTournamentRoute, handleTournamentAdminRoute, resolveTournament, updateTournamentStatuses, autoCreateTournaments, updateLiveValues, fetchCurrentPrice } from "./tournaments";
import { botEnterTournaments, botTrade } from "./bots";
import { handleVersusRoute, autoCreateVersusMatchups, resolveVersusMatchups } from "./versus";

admin.initializeApp();
const db = admin.firestore();

// JWT secret from Firebase config (set via: firebase functions:config:set app.jwt_secret="your-secret")
// Fallback for dev only
const JWT_SECRET = functions.config().app?.jwt_secret || process.env.JWT_SECRET || "predich-change-me-in-production";

// ─── CORS (P0-3: locked to known origins) ────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://predich-admin.web.app",
  "https://prediction-app-2026.web.app",
  "http://localhost:3000",
  "http://localhost:19006",
];

function getCorsHeaders(req: functions.Request): Record<string, string> {
  const origin = req.headers.origin || "";
  // Mobile apps send no origin — allow them. Web requests must match allowlist.
  const allowedOrigin = !origin || ALLOWED_ORIGINS.includes(origin) ? origin || "*" : "";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };
}

// ─── Zod Schemas (P0-4: input validation) ─────────────────────────────────────
const RegisterSchema = z.object({
  email: z.string().email("Valid email required").transform(v => v.trim().toLowerCase()),
  password: z.string().min(6, "Password must be at least 6 characters"),
  displayName: z.string().trim().min(1).max(50).optional(),
  referralCode: z.string().trim().max(20).optional(),
});

const LoginSchema = z.object({
  email: z.string().email().transform(v => v.trim().toLowerCase()),
  password: z.string().min(1, "Password required"),
});

const TradeSchema = z.object({
  marketId: z.string().min(1),
  outcomeId: z.string().min(1),
  amount: z.number().positive().max(1e6, "Amount too large"),
  maxCost: z.number().positive().optional(),
});

const SellSchema = z.object({
  marketId: z.string().min(1),
  outcomeId: z.string().min(1),
  amount: z.number().positive().max(1e6, "Amount too large"),
});

const PreviewSchema = z.object({
  marketId: z.string().min(1),
  outcomeId: z.string().min(1),
  amount: z.number().positive().optional(),
  credits: z.number().positive().optional(),
});

const CommentSchema = z.object({
  content: z.string().trim().min(1, "Comment cannot be empty").max(500, "Comment must be 1-500 characters"),
  parentId: z.string().optional(),
});

const ProposalSchema = z.object({
  title: z.string().trim().min(5, "Title must be at least 5 characters").max(200),
  description: z.string().trim().max(1000).optional(),
  category: z.string().optional().default("OTHER"),
  outcomes: z.array(z.string()).min(2).max(10).optional(),
  suggestedExpiry: z.string().optional().default(""),
  resolutionCriteria: z.string().max(500).optional(),
  sourceUrl: z.string().url().optional(),
});

function validate<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const msg = result.error.issues.map((e: any) => e.message).join("; ");
    return { success: false, error: msg };
  }
  return { success: true, data: result.data };
}

// ─── Rate Limiting (P0-2: Firestore-backed, survives instance restarts) ──────
async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const ref = db.collection("rate_limits").doc(key);
  const now = Date.now();
  try {
    const result = await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists || now > (doc.data()!.resetAt || 0)) {
        tx.set(ref, { count: 1, resetAt: now + windowMs });
        return true;
      }
      const count = (doc.data()!.count || 0) + 1;
      tx.update(ref, { count });
      return count <= limit;
    });
    return result;
  } catch {
    // If rate limit check fails, allow the request (fail open)
    return true;
  }
}

// Store req on res for CORS lookup (avoids changing every ok/fail call signature)
let _currentReq: functions.Request = null as any;
function send(res: functions.Response, status: number, body: any): void {
  Object.entries(getCorsHeaders(_currentReq)).forEach(([k, v]) => res.set(k, v));
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
  _currentReq = req;
  if (req.method === "OPTIONS") { Object.entries(getCorsHeaders(req)).forEach(([k, v]) => res.set(k, v)); res.status(204).send(""); return; }

  const ip = req.ip || req.headers["x-forwarded-for"] as string || "unknown";
  const path = req.path.replace(/^\/api/, "");
  const method = req.method;

  // Rate limit auth endpoints more strictly (Firestore-backed)
  if (path.startsWith("/auth/")) {
    if (!(await checkRateLimit(`auth:${ip}`, 10, 60000))) { fail(res, "Too many attempts. Try again later.", 429); return; }
  } else {
    if (!(await checkRateLimit(ip, 100, 60000))) { fail(res, "Rate limit exceeded.", 429); return; }
  }

  try {
    // ═══════════════════════════════════════════════════════════════════
    // AUTH
    // ═══════════════════════════════════════════════════════════════════

    if (path === "/auth/register" && method === "POST") {
      const v = validate(RegisterSchema, req.body);
      if (!v.success) { fail(res, v.error); return; }
      const { email, password, displayName, referralCode } = v.data;
      const ex = await db.collection("users").where("email", "==", email).limit(1).get();
      if (!ex.empty) { fail(res, "Email already in use", 409); return; }
      const hash = await bcrypt.hash(password, 10);
      const ref = db.collection("users").doc();
      const userData: any = {
        email, displayName: displayName || null, passwordHash: hash,
        creditBalance: 1000, totalCreditsEarned: 1000, totalCreditsSpent: 0, totalTrades: 0, winningTrades: 0,
        totalWinnings: 0, roi: 0, currentStreak: 0, longestStreak: 0, isPremium: false, isAdmin: false,
        referralCode: ref.id.slice(0, 8).toUpperCase(), // Generate unique referral code
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (referralCode) userData.referredBy = referralCode;
      await ref.set(userData);
      await db.collection("transactions").add({ userId: ref.id, amount: 1000, type: "STARTING_BONUS", description: "Welcome bonus", createdAt: admin.firestore.FieldValue.serverTimestamp() });
      const token = jwt.sign({ userId: ref.id, email: userData.email }, JWT_SECRET, { expiresIn: "30d" });
      ok(res, { token, user: { id: ref.id, email: userData.email, displayName: userData.displayName, creditBalance: 1000 } }, 201); return;
    }

    if (path === "/auth/login" && method === "POST") {
      const v = validate(LoginSchema, req.body);
      if (!v.success) { fail(res, v.error); return; }
      const { email, password } = v.data;
      const snap = await db.collection("users").where("email", "==", email).limit(1).get();
      if (snap.empty) { fail(res, "Invalid credentials", 401); return; }
      const doc = snap.docs[0]; const d = doc.data();
      if (!d.passwordHash || !(await bcrypt.compare(password, d.passwordHash))) { fail(res, "Invalid credentials", 401); return; }
      const token = jwt.sign({ userId: doc.id, email: d.email }, JWT_SECRET, { expiresIn: "30d" });
      ok(res, { token, user: { id: doc.id, email: d.email, displayName: d.displayName, creditBalance: d.creditBalance } }); return;
    }

    // Exchange Firebase ID token for app JWT (used by admin dashboard Google sign-in)
    if (path === "/auth/firebase-token" && method === "POST") {
      const { idToken } = req.body;
      if (!idToken) { fail(res, "idToken required"); return; }
      try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        const email = (decoded.email || "").toLowerCase();
        if (!email) { fail(res, "No email in token", 401); return; }
        // Find or create user
        let snap = await db.collection("users").where("email", "==", email).limit(1).get();
        let userId: string;
        let displayName: string;
        if (snap.empty) {
          const ref = db.collection("users").doc();
          await ref.set({
            email, displayName: decoded.name || email.split("@")[0], passwordHash: null,
            creditBalance: 1000, totalCreditsEarned: 1000, totalCreditsSpent: 0,
            totalTrades: 0, winningTrades: 0, totalWinnings: 0, roi: 0,
            currentStreak: 0, longestStreak: 0, isPremium: false, isAdmin: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          userId = ref.id;
          displayName = decoded.name || email.split("@")[0];
        } else {
          userId = snap.docs[0].id;
          displayName = snap.docs[0].data().displayName || email;
        }
        const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: "30d" });
        ok(res, { token, user: { id: userId, email, displayName } }); return;
      } catch (e: any) {
        fail(res, "Invalid Firebase token", 401); return;
      }
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
      // Notify all holders that the market was resolved
      const winningOutcome = mDoc.data()!.outcomes?.find((o: any) => o.id === outcomeId);
      notifyMarketHolders(marketId, "Market Resolved!", `"${mDoc.data()!.title}" resolved: ${winningOutcome?.name || "Unknown"}`);
      ok(res, { message: "Market resolved", winnersCount }); return;
    }

    // ═══════════════════════════════════════════════════════════════════
    // TRADING
    // ═══════════════════════════════════════════════════════════════════

    if (path === "/trades/preview-by-cost" && method === "POST") {
      const v = validate(PreviewSchema, req.body);
      if (!v.success) { fail(res, v.error); return; }
      const { marketId, outcomeId, credits } = v.data as any;
      if (!credits || credits <= 0) { fail(res, "credits must be positive"); return; }
      const doc = await db.collection("markets").doc(marketId).get();
      if (!doc.exists) { fail(res, "Market not found", 404); return; }
      const d = doc.data()!; const oc = parseOutcomes(d, doc.id); const b = d.liquidityParameter || 1000;
      const shares = sharesForCost(oc, b, outcomeId, credits);
      const actualCost = shares > 0 ? Math.max(1, Math.round(buyCost(oc, b, outcomeId, shares))) : 0;
      ok(res, { shares, actualCost, maxPayout: shares, pricePerShare: shares > 0 ? actualCost / shares : 0 }); return;
    }

    if (path === "/trades/preview" && method === "POST") {
      const v = validate(PreviewSchema, req.body);
      if (!v.success) { fail(res, v.error); return; }
      const { marketId, outcomeId, amount } = v.data as any;
      if (!amount || amount <= 0) { fail(res, "amount must be positive"); return; }
      const doc = await db.collection("markets").doc(marketId).get();
      if (!doc.exists) { fail(res, "Market not found", 404); return; }
      const d = doc.data()!; const oc = parseOutcomes(d, doc.id); const b = d.liquidityParameter || 1000;
      const cost = Math.max(1, Math.round(buyCost(oc, b, outcomeId, amount)));
      ok(res, { cost, pricePerShare: cost / amount, amount }); return;
    }

    if (path === "/trades/preview-sell" && method === "POST") {
      const v = validate(SellSchema, req.body);
      if (!v.success) { fail(res, v.error); return; }
      const { marketId, outcomeId, amount } = v.data;
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
      const v = validate(TradeSchema, req.body);
      if (!v.success) { fail(res, v.error); return; }
      const { marketId, outcomeId, amount, maxCost } = v.data;

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
      const v = validate(SellSchema, req.body);
      if (!v.success) { fail(res, v.error); return; }
      const { marketId, outcomeId, amount } = v.data;

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

    // ── CHANGE PASSWORD ──────────────────────────────────────────────
    if (path === "/users/me/password" && method === "PUT") {
      const user = await auth(req);
      if (!user) { fail(res, "Auth required", 401); return; }
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) { fail(res, "Current and new password required"); return; }
      if (newPassword.length < 6) { fail(res, "New password must be at least 6 characters"); return; }
      const userDoc = await db.collection("users").doc(user.id).get();
      if (!userDoc.exists) { fail(res, "User not found", 404); return; }
      const ud = userDoc.data()!;
      if (!ud.passwordHash) { fail(res, "Account uses social login — no password to change"); return; }
      if (!(await bcrypt.compare(currentPassword, ud.passwordHash))) { fail(res, "Current password is incorrect", 401); return; }
      const newHash = await bcrypt.hash(newPassword, 10);
      await db.collection("users").doc(user.id).update({ passwordHash: newHash });
      ok(res, { message: "Password changed successfully" }); return;
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
        // Rebalanced: base 25 + streak bonus (max 50) = max 75/day; premium gets 2x
        const baseReward = 25 + Math.min((d.currentStreak || 0) * 5, 50);
        const reward = d.isPremium ? baseReward * 2 : baseReward;
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

    // ── ACCOUNT DELETION (P0-1: Apple App Store requirement) ────────────
    if (path === "/users/me" && method === "DELETE") {
      const user = await auth(req);
      if (!user) { fail(res, "Auth required", 401); return; }
      const { password } = req.body || {};
      // Verify password for email/password users
      const userDoc = await db.collection("users").doc(user.id).get();
      if (!userDoc.exists) { fail(res, "User not found", 404); return; }
      const ud = userDoc.data()!;
      if (ud.passwordHash) {
        if (!password) { fail(res, "Password required to delete account"); return; }
        if (!(await bcrypt.compare(password, ud.passwordHash))) { fail(res, "Invalid password", 401); return; }
      }
      // Delete user data across all collections
      const batch = db.batch();
      // Delete holdings
      const holdings = await db.collection("holdings").where("userId", "==", user.id).get();
      holdings.docs.forEach(d => batch.delete(d.ref));
      // Delete transactions
      const txns = await db.collection("transactions").where("userId", "==", user.id).get();
      txns.docs.forEach(d => batch.delete(d.ref));
      // Delete trades
      const trades = await db.collection("trades").where("userId", "==", user.id).get();
      trades.docs.forEach(d => batch.delete(d.ref));
      // Delete follows (both directions)
      const following = await db.collection("follows").where("followerId", "==", user.id).get();
      following.docs.forEach(d => batch.delete(d.ref));
      const followers = await db.collection("follows").where("followingId", "==", user.id).get();
      followers.docs.forEach(d => batch.delete(d.ref));
      // Delete achievements
      const achievements = await db.collection("user_achievements").where("userId", "==", user.id).get();
      achievements.docs.forEach(d => batch.delete(d.ref));
      // Delete proposals
      const proposals = await db.collection("proposals").where("createdById", "==", user.id).get();
      proposals.docs.forEach(d => batch.delete(d.ref));
      // Delete the user document last
      batch.delete(db.collection("users").doc(user.id));
      await batch.commit();
      ok(res, { message: "Account deleted successfully" }); return;
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

    // ── CREDIT PACKS ──────────────────────────────────────────────────
    if (path === "/users/credit-packs" && method === "GET") {
      ok(res, [
        { code: "starter", name: "Starter Pack", credits: 500, description: "Get back in the game" },
        { code: "pro", name: "Pro Pack", credits: 2000, description: "For serious traders" },
        { code: "whale", name: "Whale Pack", credits: 10000, description: "Dominate the leaderboard" },
      ]); return;
    }

    if (path === "/users/me/buy-credits" && method === "POST") {
      const user = await auth(req);
      if (!user) { fail(res, "Auth required", 401); return; }
      const { packCode } = req.body;
      // Support both legacy pack codes and RevenueCat product IDs
      const packs: Record<string, number> = {
        starter: 500, pro: 2000, whale: 10000,
        predich_credits_500: 500, predich_credits_2000: 2000, predich_credits_10000: 10000,
      };
      const credits = packs[packCode];
      if (!credits) { fail(res, "Invalid pack code"); return; }
      // TODO: In production, validate RevenueCat receipt via webhook or server-side API
      await db.collection("users").doc(user.id).update({
        creditBalance: admin.firestore.FieldValue.increment(credits),
        totalCreditsEarned: admin.firestore.FieldValue.increment(credits),
      });
      await db.collection("transactions").add({
        userId: user.id, amount: credits, type: "CREDIT_PURCHASE",
        description: `Purchased ${packCode} pack (+${credits} credits)`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const doc = await db.collection("users").doc(user.id).get();
      ok(res, { creditsAdded: credits, newBalance: doc.data()!.creditBalance }); return;
    }

    // ── AD REWARD (P1-3: credits for watching rewarded video ads) ───
    if (path === "/users/me/ad-reward" && method === "POST") {
      const user = await auth(req);
      if (!user) { fail(res, "Auth required", 401); return; }
      const AD_CREDITS = 50;
      const MAX_ADS_PER_DAY = 5;
      const userRef = db.collection("users").doc(user.id);
      const result = await db.runTransaction(async (tx) => {
        const doc = await tx.get(userRef);
        if (!doc.exists) throw new Error("User not found");
        const d = doc.data()!;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const lastAdDate = d.lastAdRewardDate?.toDate();
        const adsToday = (lastAdDate && lastAdDate >= today) ? (d.adsWatchedToday || 0) : 0;
        if (adsToday >= MAX_ADS_PER_DAY) throw new Error("Daily ad limit reached");
        tx.update(userRef, {
          creditBalance: admin.firestore.FieldValue.increment(AD_CREDITS),
          totalCreditsEarned: admin.firestore.FieldValue.increment(AD_CREDITS),
          adsWatchedToday: adsToday + 1,
          lastAdRewardDate: admin.firestore.Timestamp.now(),
        });
        tx.set(db.collection("transactions").doc(), {
          userId: user.id, amount: AD_CREDITS, type: "AD_REWARD",
          description: "Watched rewarded video ad",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { credits: AD_CREDITS, adsRemaining: MAX_ADS_PER_DAY - (adsToday + 1), newBalance: d.creditBalance + AD_CREDITS };
      });
      ok(res, result); return;
    }

    // ── ACHIEVEMENT AUTO-TRACKING ────────────────────────────────────
    if (path === "/users/me/check-achievements" && method === "POST") {
      const user = await auth(req);
      if (!user) { fail(res, "Auth required", 401); return; }
      const doc = await db.collection("users").doc(user.id).get();
      if (!doc.exists) { fail(res, "User not found", 404); return; }
      const d = doc.data()!;

      const achievements = [
        { code: "FIRST_TRADE", check: d.totalTrades >= 1, reward: 50 },
        { code: "TRADES_10", check: d.totalTrades >= 10, reward: 200 },
        { code: "TRADES_50", check: d.totalTrades >= 50, reward: 500 },
        { code: "STREAK_5", check: d.currentStreak >= 5, reward: 100 },
        { code: "STREAK_30", check: d.currentStreak >= 30, reward: 500 },
        { code: "WINS_10", check: (d.winningTrades || 0) >= 10, reward: 300 },
      ];

      // Check which are already earned
      const earnedSnap = await db.collection("user_achievements").where("userId", "==", user.id).get();
      const earned = new Set(earnedSnap.docs.map(d => d.data().code));
      const newlyEarned: string[] = [];

      for (const a of achievements) {
        if (a.check && !earned.has(a.code)) {
          await db.collection("user_achievements").add({ userId: user.id, code: a.code, earnedAt: admin.firestore.FieldValue.serverTimestamp() });
          await db.collection("users").doc(user.id).update({
            creditBalance: admin.firestore.FieldValue.increment(a.reward),
            totalCreditsEarned: admin.firestore.FieldValue.increment(a.reward),
          });
          await db.collection("transactions").add({
            userId: user.id, amount: a.reward, type: "ACHIEVEMENT_REWARD",
            description: `Achievement: ${a.code}`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          newlyEarned.push(a.code);
        }
      }

      ok(res, { newlyEarned, totalEarned: earned.size + newlyEarned.length }); return;
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
      const vc = validate(CommentSchema, req.body);
      if (!vc.success) { fail(res, vc.error); return; }
      const { content } = vc.data;
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
      const referralCode = d.referralCode || user.id.slice(0, 8).toUpperCase();
      // If user doesn't have a referralCode stored yet, save it
      if (!d.referralCode) {
        await db.collection("users").doc(user.id).update({ referralCode });
      }
      ok(res, {
        referralCode,
        referralCount: d.referralCount || 0,
        creditsEarned: (d.referralCount || 0) * 500,
      }); return;
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
      const vp = validate(ProposalSchema, req.body);
      if (!vp.success) { fail(res, vp.error); return; }
      const { title, description, category, outcomes, suggestedExpiry, resolutionCriteria } = vp.data;
      const PROPOSAL_FEE = 50; // Credit sink: costs 50 credits to propose a market
      const userDoc = await db.collection("users").doc(user.id).get();
      if (!userDoc.exists) { fail(res, "User not found", 404); return; }
      const ud = userDoc.data()!;
      const displayName = ud.displayName || "Anonymous";
      // Premium users get free proposals
      if (!ud.isPremium) {
        if (ud.creditBalance < PROPOSAL_FEE) { fail(res, `Insufficient credits. Proposals cost ${PROPOSAL_FEE} credits.`); return; }
        await db.collection("users").doc(user.id).update({
          creditBalance: admin.firestore.FieldValue.increment(-PROPOSAL_FEE),
          totalCreditsSpent: admin.firestore.FieldValue.increment(PROPOSAL_FEE),
        });
        await db.collection("transactions").add({
          userId: user.id, amount: -PROPOSAL_FEE, type: "PROPOSAL_FEE",
          description: `Market proposal fee: ${title.trim()}`,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      const ref = await db.collection("proposals").add({
        title: title.trim(), description: description?.trim() || null, category: category || "OTHER",
        outcomes: Array.isArray(outcomes) && outcomes.length >= 2 ? outcomes : ["Yes", "No"],
        suggestedExpiry: suggestedExpiry || "", resolutionCriteria: resolutionCriteria || null,
        status: "PENDING", upvotes: 0, createdById: user.id,
        createdBy: { id: user.id, displayName },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      ok(res, { id: ref.id, title: title.trim(), status: "PENDING", upvotes: 0, fee: ud.isPremium ? 0 : PROPOSAL_FEE, createdBy: { id: user.id, displayName } }, 201); return;
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

    // ── TOURNAMENT JOIN (with entry fee credit sink) ─────────────────
    if (path.match(/^\/tournaments\/[^/]+\/join$/) && method === "POST") {
      const user = await auth(req);
      if (!user) { fail(res, "Auth required", 401); return; }
      const tournamentId = path.split("/")[2];
      const tDoc = await db.collection("tournaments").doc(tournamentId).get();
      if (!tDoc.exists) { fail(res, "Tournament not found", 404); return; }
      const t = tDoc.data()!;
      const entryFee = t.entryFee || 100; // default 100 credits entry fee

      const result = await db.runTransaction(async (tx) => {
        const userRef = db.collection("users").doc(user.id);
        const uDoc = await tx.get(userRef);
        if (!uDoc.exists) throw new Error("User not found");
        const ud = uDoc.data()!;
        if (ud.creditBalance < entryFee) throw new Error("Insufficient credits for entry fee");
        // Check if already joined
        const participantId = `${user.id}_${tournamentId}`;
        const pRef = db.collection("tournament_participants").doc(participantId);
        const pDoc = await tx.get(pRef);
        if (pDoc.exists) throw new Error("Already joined this tournament");
        // Deduct entry fee
        tx.update(userRef, {
          creditBalance: admin.firestore.FieldValue.increment(-entryFee),
          totalCreditsSpent: admin.firestore.FieldValue.increment(entryFee),
        });
        tx.set(pRef, { userId: user.id, tournamentId, joinedAt: admin.firestore.FieldValue.serverTimestamp() });
        tx.set(db.collection("transactions").doc(), {
          userId: user.id, amount: -entryFee, type: "TOURNAMENT_ENTRY",
          description: `Tournament entry fee: ${t.name || tournamentId}`,
          referenceId: tournamentId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { message: "Joined tournament", entryFee, newBalance: ud.creditBalance - entryFee };
      });
      ok(res, result); return;
    }

    // ═══════════════════════════════════════════════════════════════════
    // VERSUS (comparative asset predictions)
    // ═══════════════════════════════════════════════════════════════════

    if (path.startsWith("/versus")) {
      const user = await auth(req);
      const versusResult = await handleVersusRoute(path, method, req.body, user?.id || null);
      if (versusResult) { send(res, versusResult.status, versusResult.body); return; }
    }

    // ═══════════════════════════════════════════════════════════════════
    // TOURNAMENTS V2
    // ═══════════════════════════════════════════════════════════════════

    if (path.startsWith("/tournaments-v2")) {
      const user = await auth(req);
      const tournamentResult = await handleTournamentRoute(path, method, req.body, user?.id || null);
      if (tournamentResult) { send(res, tournamentResult.status, tournamentResult.body); return; }
    }

    // ═══════════════════════════════════════════════════════════════════
    // HEALTH
    // ═══════════════════════════════════════════════════════════════════

    // Admin routes (approve, reject, credits, ban, sync, stats, tournament admin)
    const user = await auth(req);
    if (user) {
      const uDoc = await db.collection("users").doc(user.id).get();
      if (uDoc.exists && uDoc.data()!.isAdmin) {
        // Tournament admin routes
        const tAdminResult = await handleTournamentAdminRoute(path, method, req.body);
        if (tAdminResult) { send(res, tAdminResult.status, tAdminResult.body); return; }
        // Other admin routes
        const adminResult = await handleAdminRoute(path, method, req.body, user.id);
        if (adminResult) { send(res, adminResult.status, adminResult.body); return; }
      }
    }

    if (path === "/health" || path === "/") { ok(res, { status: "ok", version: "1.2.0" }); return; }

    fail(res, "Route not found", 404);
  } catch (e: any) {
    console.error("API Error:", e);
    const status = e.message?.includes("not found") ? 404 : e.message?.includes("Insufficient") ? 400 : 500;
    fail(res, e.message || "Internal server error", status);
  }
});
// v1.3.0 — Node.js 22

// Push Notifications — imported from shared module
import { sendPushNotification, notifyMarketHolders } from "./notifications";

// ═══════════════════════════════════════════════════════════════════════════════
// Smart category detection from title keywords
// ═══════════════════════════════════════════════════════════════════════════════
const CAT_KEYWORDS: Record<string, string[]> = {
  POLITICS: ["president", "election", "congress", "senate", "trump", "biden", "democrat", "republican", "governor", "vote", "political", "supreme court", "legislation", "parliament", "prime minister", "party", "inaugur", "impeach", "nato", "sanctions", "tariff", "newsom", "desantis", "vance", "pence", "obama"],
  SPORTS: ["nba", "nfl", "mlb", "nhl", "ufc", "fifa", "world cup", "super bowl", "championship", "playoff", "ncaa", "tournament", "soccer", "football", "basketball", "baseball", "tennis", "golf", "olympic", "match", "league", "premier league", "champion", "medal", "athlete", "game", "purdue", "lakers", "celtics"],
  CRYPTO: ["bitcoin", "btc", "ethereum", "eth", "solana", "sol", "crypto", "blockchain", "token", "defi", "nft", "altcoin", "binance", "coinbase", "dogecoin", "xrp", "cardano", "mining", "halving", "stablecoin"],
  ENTERTAINMENT: ["movie", "oscar", "grammy", "emmy", "netflix", "disney", "spotify", "album", "box office", "celebrity", "taylor swift", "concert", "streaming", "tv show", "series", "music", "kanye", "drake", "beyonce", "marvel", "elon musk", "tweet", "tiktok", "youtube", "viral", "influencer"],
  SCIENCE: ["climate", "space", "nasa", "mars", "ai ", "artificial intelligence", "vaccine", "pandemic", "research", "scientific", "quantum", "genome", "discovery", "species", "asteroid", "satellite"],
  TECHNOLOGY: ["apple", "google", "microsoft", "openai", "chatgpt", "iphone", "tesla", "spacex", "startup", "ipo", "tech", "software", "chip", "semiconductor", "robot", "autonomous", "self-driving", "metaverse"],
  BUSINESS: ["stock", "market cap", "revenue", "profit", "gdp", "inflation", "fed", "interest rate", "recession", "unemployment", "s&p", "dow jones", "nasdaq", "merger", "acquisition", "ipo", "earnings", "company", "ceo"],
};

export function detectCategory(title: string, sourceCategory?: string): string {
  // Try source category first
  if (sourceCategory) {
    const catMap: Record<string, string> = { Politics: "POLITICS", Sports: "SPORTS", Crypto: "CRYPTO", "Pop Culture": "ENTERTAINMENT", Science: "SCIENCE", Tech: "TECHNOLOGY", Business: "BUSINESS" };
    if (catMap[sourceCategory]) return catMap[sourceCategory];
  }
  // Keyword matching
  const lower = title.toLowerCase();
  let best = "OTHER", bestScore = 0;
  for (const [cat, keywords] of Object.entries(CAT_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) { if (lower.includes(kw)) score++; }
    if (score > bestScore) { bestScore = score; best = cat; }
  }
  return best;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Scheduled sync — runs daily at 6 AM UTC
// ═══════════════════════════════════════════════════════════════════════════════
export const dailyMarketSync = functions.pubsub.schedule("every day 06:00").onRun(async () => {
  console.log("Daily market sync started");
  let created = 0, skipped = 0;

  // Get or create bot user
  let botSnap = await db.collection("users").where("email", "==", "bot@predich.system").limit(1).get();
  let botId: string;
  if (botSnap.empty) {
    const ref = db.collection("users").doc();
    await ref.set({ email: "bot@predich.system", displayName: "Predich Team", creditBalance: 0, totalTrades: 0, winningTrades: 0, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    botId = ref.id;
  } else {
    botId = botSnap.docs[0].id;
  }

  // Dedup
  const existing = new Set<string>();
  (await db.collection("markets").select("title").get()).docs.forEach(d => existing.add((d.data().title || "").toLowerCase()));
  (await db.collection("proposals").select("title").get()).docs.forEach(d => existing.add((d.data().title || "").toLowerCase()));

  // Polymarket
  try {
    const r = await fetch("https://gamma-api.polymarket.com/markets?limit=30&active=true&closed=false&order=volume24hr&ascending=false");
    if (r.ok) {
      const markets = await r.json();
      for (const m of markets) {
        const title = (m.question || "").trim();
        if (!title || existing.has(title.toLowerCase())) { skipped++; continue; }
        existing.add(title.toLowerCase());
        const category = detectCategory(title, m.category);
        let outcomes = ["Yes", "No"];
        try { outcomes = m.outcomes ? JSON.parse(m.outcomes) : outcomes; } catch {}
        await db.collection("proposals").add({
          title, description: (m.description || "").slice(0, 500) || null,
          category, outcomes, suggestedExpiry: m.endDate || "",
          resolutionCriteria: "Source: Polymarket", status: "PENDING", upvotes: 0,
          createdById: botId, createdBy: { id: botId, displayName: "Predich Team" },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        created++;
      }
    }
  } catch (e: any) { console.error("Polymarket error:", e.message); }

  // Manifold
  try {
    const r = await fetch("https://api.manifold.markets/v0/markets?limit=20&sort=score");
    if (r.ok) {
      const markets = await r.json();
      for (const m of markets) {
        const title = (m.question || "").trim();
        if (!title || existing.has(title.toLowerCase())) { skipped++; continue; }
        existing.add(title.toLowerCase());
        await db.collection("proposals").add({
          title, description: null, category: detectCategory(title), outcomes: ["Yes", "No"],
          suggestedExpiry: m.closeTime ? new Date(m.closeTime).toISOString() : "",
          resolutionCriteria: "Source: Manifold Markets", status: "PENDING", upvotes: 0,
          createdById: botId, createdBy: { id: botId, displayName: "Predich Team" },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        created++;
      }
    }
  } catch (e: any) { console.error("Manifold error:", e.message); }

  console.log(`Daily sync done: ${created} created, ${skipped} skipped`);
  return null;
});

// ═══════════════════════════════════════════════════════════════════════════════
// Automated Market Resolution — runs every 6 hours
// Flags expired markets and auto-resolves binary markets past their expiry
// ═══════════════════════════════════════════════════════════════════════════════
export const autoResolveMarkets = functions.pubsub.schedule("every 6 hours").onRun(async () => {
  console.log("Auto-resolve check started");
  const now = new Date();
  let flagged = 0, resolved = 0;

  // Find OPEN markets with expiresAt in the past
  const snap = await db.collection("markets")
    .where("status", "==", "OPEN")
    .get();

  for (const doc of snap.docs) {
    const d = doc.data();
    if (!d.expiresAt) continue;

    // Parse expiry — handle both Timestamp and string
    let expiryDate: Date;
    if (d.expiresAt.toDate) {
      expiryDate = d.expiresAt.toDate();
    } else {
      expiryDate = new Date(d.expiresAt);
    }
    if (isNaN(expiryDate.getTime()) || expiryDate > now) continue;

    // Market is expired — flag it
    const daysPastExpiry = (now.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysPastExpiry <= 7) {
      // Within 7 days: just flag as PENDING_RESOLUTION for admin review
      if (!d.pendingResolution) {
        await doc.ref.update({
          pendingResolution: true,
          flaggedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        flagged++;
      }
    } else {
      // Over 7 days past expiry with no admin action: auto-cancel and refund
      // This prevents markets from being stuck open indefinitely
      const holdingsSnap = await db.collection("holdings").where("marketId", "==", doc.id).get();

      await db.runTransaction(async (tx) => {
        tx.update(doc.ref, {
          status: "CANCELLED",
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
          cancellationReason: "Auto-cancelled: expired over 7 days with no resolution",
        });

        // Refund all holders based on their cost basis
        for (const hDoc of holdingsSnap.docs) {
          const h = hDoc.data();
          if (h.quantity <= 0) continue;
          const refund = Math.round((h.avgCost || 0) * h.quantity);
          if (refund <= 0) continue;
          const userRef = db.collection("users").doc(h.userId);
          tx.update(userRef, {
            creditBalance: admin.firestore.FieldValue.increment(refund),
            totalCreditsEarned: admin.firestore.FieldValue.increment(refund),
          });
          tx.set(db.collection("transactions").doc(), {
            userId: h.userId, amount: refund, type: "MARKET_CANCELLED_REFUND",
            description: `Refund for cancelled market: ${d.title}`,
            referenceId: doc.id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      });
      resolved++;
    }
  }

  console.log(`Auto-resolve done: ${flagged} flagged, ${resolved} auto-cancelled`);
  return null;
});

// ═══════════════════════════════════════════════════════════════════════════════
// Referral reward — called when a new user registers with a referral code
// ═══════════════════════════════════════════════════════════════════════════════
export const processReferral = functions.firestore
  .document("users/{userId}")
  .onCreate(async (snap) => {
    const newUser = snap.data();
    const referredBy = newUser.referredBy;
    if (!referredBy) return;

    const REFERRAL_REWARD = 500; // Both parties get 500 credits

    // Find the referrer
    const referrerSnap = await db.collection("users")
      .where("referralCode", "==", referredBy)
      .limit(1)
      .get();

    if (referrerSnap.empty) {
      // Try matching by user ID prefix (fallback)
      const allUsers = await db.collection("users").get();
      const referrer = allUsers.docs.find(d => d.id.slice(0, 8).toUpperCase() === referredBy);
      if (!referrer) return;
      await grantReferralRewards(referrer.id, snap.id, REFERRAL_REWARD);
    } else {
      await grantReferralRewards(referrerSnap.docs[0].id, snap.id, REFERRAL_REWARD);
    }
  });

async function grantReferralRewards(referrerId: string, newUserId: string, amount: number) {
  const batch = db.batch();

  // Grant credits to referrer
  const referrerRef = db.collection("users").doc(referrerId);
  batch.update(referrerRef, {
    creditBalance: admin.firestore.FieldValue.increment(amount),
    totalCreditsEarned: admin.firestore.FieldValue.increment(amount),
    referralCount: admin.firestore.FieldValue.increment(1),
  });
  batch.set(db.collection("transactions").doc(), {
    userId: referrerId, amount, type: "REFERRAL_REWARD",
    description: "Referral reward: friend joined!",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Grant credits to new user
  const newUserRef = db.collection("users").doc(newUserId);
  batch.update(newUserRef, {
    creditBalance: admin.firestore.FieldValue.increment(amount),
    totalCreditsEarned: admin.firestore.FieldValue.increment(amount),
  });
  batch.set(db.collection("transactions").doc(), {
    userId: newUserId, amount, type: "REFERRAL_REWARD",
    description: "Welcome bonus: referred by a friend!",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();
  // Notify referrer
  sendPushNotification(referrerId, "Referral Reward!", `A friend joined using your code! +${amount} credits`);
  console.log(`Referral reward: ${amount} credits to both ${referrerId} and ${newUserId}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tournament V2 Scheduler — runs every 15 minutes
// - Transitions REGISTRATION → LOCKED when registration closes
// - Resolves expired LOCKED tournaments via external APIs
// - Cancels tournaments with <2 players
// ═══════════════════════════════════════════════════════════════════════════════
export const tournamentScheduler = functions.runWith({ timeoutSeconds: 300, memory: "512MB" }).pubsub.schedule("every 15 minutes").onRun(async () => {
  console.log("Tournament scheduler started");

  // 1. Auto-create tournaments from templates
  const createResult = await autoCreateTournaments();
  console.log(`Auto-create: ${createResult.created} created, ${createResult.skipped} skipped`);

  // 2. Update live values for tracker
  const liveUpdated = await updateLiveValues();
  console.log(`Live values updated: ${liveUpdated}`);

  // 3. Send registration closing reminders (6h before close)
  const regSnap = await db.collection("tournament_v2")
    .where("status", "==", "REGISTRATION")
    .get();
  for (const doc of regSnap.docs) {
    const t = doc.data();
    const closeTime = new Date(t.registrationCloses).getTime();
    const now = Date.now();
    const hoursLeft = (closeTime - now) / (1000 * 60 * 60);
    // Send reminder between 5.75h and 6h (so it triggers once per 15-min cycle)
    if (hoursLeft > 5.75 && hoursLeft <= 6 && (t.playerCount || 0) > 0) {
      const entries = await db.collection("tournament_entries")
        .where("tournamentId", "==", doc.id)
        .get();
      for (const eDoc of entries.docs) {
        sendPushNotification(eDoc.data().userId,
          "Tournament Closing Soon!",
          `"${t.question}" registration closes in 6h. ${t.playerCount} players competing.`
        );
      }
    }
  }

  // 4. Update statuses (REGISTRATION → LOCKED, cancel if <2 players)
  const statusResult = await updateTournamentStatuses();
  console.log(`Statuses: ${statusResult.locked} locked, ${statusResult.cancelled} cancelled`);

  // Notifications for locked/cancelled are now handled inside updateTournamentStatuses()

  // 5. Resolve expired LOCKED tournaments
  const now = new Date();
  const lockedSnap = await db.collection("tournament_v2")
    .where("status", "==", "LOCKED")
    .get();

  let resolved = 0;
  const expiredTournaments = lockedSnap.docs.filter(d => new Date(d.data().expiresAt) <= now);
  console.log(`Found ${expiredTournaments.length} expired LOCKED tournaments to resolve`);

  for (const doc of expiredTournaments) {
    const t = doc.data();
    console.log(`Resolving tournament ${doc.id}: asset=${t.asset}, apiSource=${t.apiSource}`);

    // Try fetching price with retry (CoinGecko rate limits)
    let actualValue: number | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      actualValue = await fetchCurrentPrice(t.asset, t.apiSource);
      if (actualValue !== null) break;
      console.log(`Fetch attempt ${attempt + 1} failed for ${t.asset}, retrying in 2s...`);
      await new Promise(r => setTimeout(r, 2000));
    }

    // Fallback: use the last known live value
    if (actualValue === null && t.currentLiveValue) {
      console.log(`Using last known live value: ${t.currentLiveValue}`);
      actualValue = t.currentLiveValue;
    }

    if (actualValue === null) {
      console.error(`FAILED to get value for tournament ${doc.id} (${t.asset}) after 3 attempts`);
      continue;
    }

    try {
      console.log(`Resolving ${doc.id} with actual value: ${actualValue}`);
      await resolveTournament(doc.id, actualValue);
      // Re-read entries after resolution (they now have rank/payout)
      const entries = await db.collection("tournament_entries")
        .where("tournamentId", "==", doc.id)
        .get();
      for (const eDoc of entries.docs) {
        const e = eDoc.data();
        if (!e.rank) continue;
        const msg = e.payout && e.payout > 0
          ? `You placed #${e.rank}! Won ${e.payout} credits`
          : `You placed #${e.rank}. Better luck next time!`;
        sendPushNotification(e.userId, "Tournament Results!", msg);
      }
      resolved++;
      console.log(`Tournament ${doc.id} resolved successfully`);
    } catch (e: any) {
      console.error(`Failed to resolve tournament ${doc.id}:`, e.message);
    }
  }

  console.log(`Tournament scheduler done: ${resolved} resolved`);

  // 6. Versus matchups — auto-create and resolve
  try {
    const versusCreated = await autoCreateVersusMatchups();
    console.log(`Versus: ${versusCreated.created} matchups created`);
    const versusResolved = await resolveVersusMatchups();
    console.log(`Versus: ${versusResolved.resolved} matchups resolved`);
  } catch (e: any) {
    console.error("Versus error:", e.message);
  }

  // 7. Bot activity — enter tournaments and trade on markets
  try {
    const botTournamentResult = await botEnterTournaments();
    console.log(`Bots entered ${botTournamentResult.entered} tournaments`);
    const botTradeResult = await botTrade();
    console.log(`Bots made ${botTradeResult.trades} trades`);
  } catch (e: any) {
    console.error("Bot activity error:", e.message);
  }

  return null;
});

// getTimeLabel removed — notifications now handled in tournaments.ts

// ─── External API value fetcher ─────────────────────────────────────────────
// fetchActualValue removed — replaced by fetchCurrentPrice from tournaments.ts
