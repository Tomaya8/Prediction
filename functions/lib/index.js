"use strict";
/**
 * Predich — Firebase Cloud Functions Backend (Phase 1 Security + Stability)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const bcrypt = __importStar(require("bcryptjs"));
const jwt = __importStar(require("jsonwebtoken"));
admin.initializeApp();
const db = admin.firestore();
// JWT secret from Firebase config (set via: firebase functions:config:set app.jwt_secret="your-secret")
// Fallback for dev only
const JWT_SECRET = ((_a = functions.config().app) === null || _a === void 0 ? void 0 : _a.jwt_secret) || process.env.JWT_SECRET || "predich-change-me-in-production";
const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
};
function send(res, status, body) {
    Object.entries(CORS).forEach(([k, v]) => res.set(k, v));
    res.status(status).json(body);
}
function ok(res, data, status = 200) { send(res, status, { success: true, data }); }
function fail(res, msg, status = 400) { send(res, status, { success: false, error: msg }); }
async function auth(req) {
    const h = req.headers.authorization;
    if (!(h === null || h === void 0 ? void 0 : h.startsWith("Bearer ")))
        return null;
    try {
        const p = jwt.verify(h.slice(7), JWT_SECRET);
        return { id: p.userId, email: p.email };
    }
    catch (_a) {
        return null;
    }
}
function requireAuth(req, res) {
    return auth(req).then(u => { if (!u) {
        fail(res, "Auth required", 401);
        return null;
    } return u; });
}
// ─── LMSR Pricing ────────────────────────────────────────────────────────────
function lmsrCost(outcomes, b) {
    let s = 0;
    for (const o of outcomes) {
        const q = Math.min((o.quantity || 0), b * 500); // Guard overflow
        s += Math.exp(q / b);
    }
    return b * Math.log(Math.max(s, 1e-10));
}
function buyCost(outcomes, b, oid, amt) {
    const before = lmsrCost(outcomes, b);
    const after = lmsrCost(outcomes.map((o) => o.id === oid ? { ...o, quantity: (o.quantity || 0) + amt } : o), b);
    return Math.round((after - before) * 100) / 100;
}
function prices(outcomes, b) {
    let s = 0;
    for (const o of outcomes)
        s += Math.exp(Math.min((o.quantity || 0), b * 500) / b);
    const p = {};
    for (const o of outcomes)
        p[o.id] = Math.round((Math.exp(Math.min((o.quantity || 0), b * 500) / b) / Math.max(s, 1e-10)) * 10000) / 10000;
    return p;
}
function sharesForCost(outcomes, b, oid, budget) {
    if (budget <= 0)
        return 0;
    let lo = 0, hi = Math.min(budget * 10, 1e7);
    for (let i = 0; i < 64; i++) {
        const m = (lo + hi) / 2;
        if (buyCost(outcomes, b, oid, m) < budget)
            lo = m;
        else
            hi = m;
    }
    return Math.floor(lo);
}
function parseOutcomes(d, docId) {
    return (d.outcomes || []).map((o, i) => ({
        id: o.id || `${docId}-o${i}`, name: o.name, color: o.color || (i === 0 ? "#16A34A" : "#DC2626"), quantity: o.quantity || 0,
    }));
}
function marketToResponse(doc) {
    const d = doc.data();
    const oc = parseOutcomes(d, doc.id);
    const p = prices(oc, d.liquidityParameter || 1000);
    return {
        id: doc.id, title: d.title, description: d.description, category: d.category,
        expiresAt: d.expiresAt, totalVolume: d.totalVolume || 0, status: d.status || "ACTIVE",
        outcomes: oc.map((o) => ({ ...o, currentPrice: p[o.id] })), prices: p,
    };
}
// ─── Rate Limiting (in-memory, per Cloud Function instance) ──────────────────
const rateLimitMap = new Map();
function checkRateLimit(ip, limit, windowMs) {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
        return true;
    }
    entry.count++;
    return entry.count <= limit;
}
// ═══════════════════════════════════════════════════════════════════════════════
exports.api = functions.https.onRequest(async (req, res) => {
    var _a, _b;
    if (req.method === "OPTIONS") {
        Object.entries(CORS).forEach(([k, v]) => res.set(k, v));
        res.status(204).send("");
        return;
    }
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const path = req.path.replace(/^\/api/, "");
    const method = req.method;
    // Rate limit auth endpoints more strictly
    if (path.startsWith("/auth/")) {
        if (!checkRateLimit(`auth:${ip}`, 10, 60000)) {
            fail(res, "Too many attempts. Try again later.", 429);
            return;
        }
    }
    else {
        if (!checkRateLimit(ip, 100, 60000)) {
            fail(res, "Rate limit exceeded.", 429);
            return;
        }
    }
    try {
        // ═══════════════════════════════════════════════════════════════════
        // AUTH
        // ═══════════════════════════════════════════════════════════════════
        if (path === "/auth/register" && method === "POST") {
            const { email, password, displayName } = req.body;
            if (!email || typeof email !== "string") {
                fail(res, "Valid email required");
                return;
            }
            if (!password || password.length < 6) {
                fail(res, "Password must be at least 6 characters");
                return;
            }
            const ex = await db.collection("users").where("email", "==", email.trim().toLowerCase()).limit(1).get();
            if (!ex.empty) {
                fail(res, "Email already in use", 409);
                return;
            }
            const hash = await bcrypt.hash(password, 10);
            const ref = db.collection("users").doc();
            const userData = {
                email: email.trim().toLowerCase(), displayName: (displayName === null || displayName === void 0 ? void 0 : displayName.trim()) || null, passwordHash: hash,
                creditBalance: 1000, totalCreditsEarned: 1000, totalCreditsSpent: 0, totalTrades: 0, winningTrades: 0,
                totalWinnings: 0, roi: 0, currentStreak: 0, longestStreak: 0, isPremium: false, isAdmin: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            await ref.set(userData);
            await db.collection("transactions").add({ userId: ref.id, amount: 1000, type: "STARTING_BONUS", description: "Welcome bonus", createdAt: admin.firestore.FieldValue.serverTimestamp() });
            const token = jwt.sign({ userId: ref.id, email: userData.email }, JWT_SECRET, { expiresIn: "30d" });
            ok(res, { token, user: { id: ref.id, email: userData.email, displayName: userData.displayName, creditBalance: 1000 } }, 201);
            return;
        }
        if (path === "/auth/login" && method === "POST") {
            const { email, password } = req.body;
            if (!email || !password) {
                fail(res, "Email and password required");
                return;
            }
            const snap = await db.collection("users").where("email", "==", email.trim().toLowerCase()).limit(1).get();
            if (snap.empty) {
                fail(res, "Invalid credentials", 401);
                return;
            }
            const doc = snap.docs[0];
            const d = doc.data();
            if (!d.passwordHash || !(await bcrypt.compare(password, d.passwordHash))) {
                fail(res, "Invalid credentials", 401);
                return;
            }
            const token = jwt.sign({ userId: doc.id, email: d.email }, JWT_SECRET, { expiresIn: "30d" });
            ok(res, { token, user: { id: doc.id, email: d.email, displayName: d.displayName, creditBalance: d.creditBalance } });
            return;
        }
        // ═══════════════════════════════════════════════════════════════════
        // MARKETS
        // ═══════════════════════════════════════════════════════════════════
        if (path === "/markets/meta/trending" && method === "GET") {
            const snap = await db.collection("markets").orderBy("totalVolume", "desc").limit(10).get();
            ok(res, snap.docs.map(d => marketToResponse(d)));
            return;
        }
        if (path === "/markets/meta/categories" && method === "GET") {
            ok(res, ["POLITICS", "SPORTS", "CRYPTO", "ENTERTAINMENT", "SCIENCE", "TECHNOLOGY", "BUSINESS", "OTHER"]);
            return;
        }
        if ((path === "/markets" || path === "/trades/markets") && method === "GET") {
            const limit = Math.min(parseInt(req.query.limit) || 20, 50);
            let q = db.collection("markets").limit(limit);
            const category = req.query.category;
            if (category)
                q = q.where("category", "==", category);
            const snap = await q.get();
            ok(res, snap.docs.map(d => marketToResponse(d)));
            return;
        }
        if ((path.match(/^\/markets\/[^/]+$/) || path.match(/^\/trades\/markets\/[^/]+$/)) && !path.includes("/comments") && method === "GET") {
            const parts = path.split("/");
            const marketId = parts[parts.length - 1];
            if (marketId === "meta") {
                fail(res, "Route not found", 404);
                return;
            }
            const doc = await db.collection("markets").doc(marketId).get();
            if (!doc.exists) {
                fail(res, "Market not found", 404);
                return;
            }
            ok(res, marketToResponse(doc));
            return;
        }
        // ═══════════════════════════════════════════════════════════════════
        // MARKET RESOLUTION (admin)
        // ═══════════════════════════════════════════════════════════════════
        if (path.match(/^\/markets\/[^/]+\/resolve$/) && method === "POST") {
            const user = await auth(req);
            if (!user) {
                fail(res, "Auth required", 401);
                return;
            }
            const uDoc = await db.collection("users").doc(user.id).get();
            if (!uDoc.exists || !uDoc.data().isAdmin) {
                fail(res, "Admin required", 403);
                return;
            }
            const marketId = path.split("/")[2];
            const { outcomeId } = req.body;
            if (!outcomeId) {
                fail(res, "outcomeId required");
                return;
            }
            const marketRef = db.collection("markets").doc(marketId);
            const mDoc = await marketRef.get();
            if (!mDoc.exists) {
                fail(res, "Market not found", 404);
                return;
            }
            // Get all holdings for this market
            const holdingsSnap = await db.collection("holdings").where("marketId", "==", marketId).get();
            let winnersCount = 0;
            await db.runTransaction(async (tx) => {
                tx.update(marketRef, { status: "RESOLVED", resolvedOutcomeId: outcomeId, resolvedAt: admin.firestore.FieldValue.serverTimestamp() });
                for (const hDoc of holdingsSnap.docs) {
                    const h = hDoc.data();
                    if (h.quantity <= 0)
                        continue;
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
                            description: `Winnings from ${mDoc.data().title}`, referenceId: marketId,
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                        winnersCount++;
                    }
                }
            });
            ok(res, { message: "Market resolved", winnersCount });
            return;
        }
        // ═══════════════════════════════════════════════════════════════════
        // TRADING
        // ═══════════════════════════════════════════════════════════════════
        if (path === "/trades/preview-by-cost" && method === "POST") {
            const { marketId, outcomeId, credits } = req.body;
            if (!marketId || !outcomeId || !credits || credits <= 0) {
                fail(res, "Missing fields");
                return;
            }
            const doc = await db.collection("markets").doc(marketId).get();
            if (!doc.exists) {
                fail(res, "Market not found", 404);
                return;
            }
            const d = doc.data();
            const oc = parseOutcomes(d, doc.id);
            const b = d.liquidityParameter || 1000;
            const shares = sharesForCost(oc, b, outcomeId, credits);
            const actualCost = shares > 0 ? Math.max(1, Math.round(buyCost(oc, b, outcomeId, shares))) : 0;
            ok(res, { shares, actualCost, maxPayout: shares, pricePerShare: shares > 0 ? actualCost / shares : 0 });
            return;
        }
        if (path === "/trades/preview" && method === "POST") {
            const { marketId, outcomeId, amount } = req.body;
            if (!marketId || !outcomeId || !amount || amount <= 0) {
                fail(res, "Missing fields");
                return;
            }
            const doc = await db.collection("markets").doc(marketId).get();
            if (!doc.exists) {
                fail(res, "Market not found", 404);
                return;
            }
            const d = doc.data();
            const oc = parseOutcomes(d, doc.id);
            const b = d.liquidityParameter || 1000;
            const cost = Math.max(1, Math.round(buyCost(oc, b, outcomeId, amount)));
            ok(res, { cost, pricePerShare: cost / amount, amount });
            return;
        }
        if (path === "/trades/preview-sell" && method === "POST") {
            const { marketId, outcomeId, amount } = req.body;
            if (!marketId || !outcomeId || !amount || amount <= 0) {
                fail(res, "Missing fields");
                return;
            }
            const doc = await db.collection("markets").doc(marketId).get();
            if (!doc.exists) {
                fail(res, "Market not found", 404);
                return;
            }
            const d = doc.data();
            const oc = parseOutcomes(d, doc.id);
            const b = d.liquidityParameter || 1000;
            const revenue = Math.max(0, Math.round(-buyCost(oc, b, outcomeId, -amount)));
            const currentPrice = prices(oc, b)[outcomeId] || 0;
            ok(res, { revenue, pricePerShare: amount > 0 ? revenue / amount : 0, amount, currentPrice });
            return;
        }
        if (path === "/trades/trade" && method === "POST") {
            const user = await auth(req);
            if (!user) {
                fail(res, "Auth required", 401);
                return;
            }
            const { marketId, outcomeId, amount, maxCost } = req.body;
            if (!marketId || !outcomeId || !amount || amount <= 0 || typeof amount !== "number") {
                fail(res, "Missing or invalid fields");
                return;
            }
            if (amount > 1e6) {
                fail(res, "Amount too large");
                return;
            }
            const marketRef = db.collection("markets").doc(marketId);
            const userRef = db.collection("users").doc(user.id);
            const hId = `${user.id}_${marketId}_${outcomeId}`;
            const hRef = db.collection("holdings").doc(hId);
            const result = await db.runTransaction(async (tx) => {
                const mDoc = await tx.get(marketRef);
                const uDoc = await tx.get(userRef);
                const hDoc = await tx.get(hRef);
                if (!mDoc.exists)
                    throw new Error("Market not found");
                if (!uDoc.exists)
                    throw new Error("User not found");
                const mD = mDoc.data();
                const uD = uDoc.data();
                if (mD.status === "RESOLVED" || mD.status === "CANCELLED")
                    throw new Error("Market is closed");
                const b = mD.liquidityParameter || 1000;
                const oc = parseOutcomes(mD, mDoc.id);
                const c = Math.max(1, Math.round(buyCost(oc, b, outcomeId, amount)));
                if (uD.creditBalance < c)
                    throw new Error("Insufficient credits");
                if (maxCost && c > maxCost)
                    throw new Error(`Price moved. Cost ${c} exceeds max ${maxCost}`);
                const updated = oc.map((o) => o.id === outcomeId ? { ...o, quantity: o.quantity + amount } : o);
                tx.update(marketRef, { outcomes: updated, totalVolume: (mD.totalVolume || 0) + c });
                tx.update(userRef, { creditBalance: uD.creditBalance - c, totalCreditsSpent: (uD.totalCreditsSpent || 0) + c, totalTrades: (uD.totalTrades || 0) + 1 });
                tx.set(db.collection("trades").doc(), { userId: user.id, marketId, outcomeId, type: "BUY", quantity: amount, totalCost: c, createdAt: admin.firestore.FieldValue.serverTimestamp() });
                if (hDoc.exists) {
                    const h = hDoc.data();
                    const nq = h.quantity + amount;
                    tx.update(hRef, { quantity: nq, avgCost: (h.avgCost * h.quantity + c) / nq });
                }
                else {
                    tx.set(hRef, { userId: user.id, marketId, outcomeId, quantity: amount, avgCost: c / amount });
                }
                tx.set(db.collection("transactions").doc(), { userId: user.id, amount: -c, type: "TRADE_BUY", description: `Bought ${amount} shares`, referenceId: marketId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
                const newPrices = prices(updated, b);
                // Record price history snapshot
                tx.set(db.collection("price_history").doc(), { marketId, prices: newPrices, timestamp: admin.firestore.FieldValue.serverTimestamp() });
                return { cost: c, newBalance: uD.creditBalance - c, prices: newPrices, shares: amount };
            });
            ok(res, result);
            return;
        }
        if (path === "/trades/sell" && method === "POST") {
            const user = await auth(req);
            if (!user) {
                fail(res, "Auth required", 401);
                return;
            }
            const { marketId, outcomeId, amount } = req.body;
            if (!marketId || !outcomeId || !amount || amount <= 0 || typeof amount !== "number") {
                fail(res, "Missing or invalid fields");
                return;
            }
            const marketRef = db.collection("markets").doc(marketId);
            const userRef = db.collection("users").doc(user.id);
            const hId = `${user.id}_${marketId}_${outcomeId}`;
            const hRef = db.collection("holdings").doc(hId);
            const result = await db.runTransaction(async (tx) => {
                const mDoc = await tx.get(marketRef);
                const uDoc = await tx.get(userRef);
                const hDoc = await tx.get(hRef);
                if (!mDoc.exists)
                    throw new Error("Market not found");
                if (!uDoc.exists)
                    throw new Error("User not found");
                if (!hDoc.exists || (hDoc.data().quantity || 0) < amount)
                    throw new Error(`Insufficient shares. You own ${hDoc.exists ? hDoc.data().quantity : 0}`);
                const mD = mDoc.data();
                const uD = uDoc.data();
                if (mD.status === "RESOLVED" || mD.status === "CANCELLED")
                    throw new Error("Market is closed");
                const b = mD.liquidityParameter || 1000;
                const oc = parseOutcomes(mD, mDoc.id);
                const revenue = Math.max(0, Math.round(-buyCost(oc, b, outcomeId, -amount)));
                const updated = oc.map((o) => o.id === outcomeId ? { ...o, quantity: o.quantity - amount } : o);
                tx.update(marketRef, { outcomes: updated, totalVolume: (mD.totalVolume || 0) + revenue });
                tx.update(userRef, { creditBalance: uD.creditBalance + revenue, totalCreditsEarned: (uD.totalCreditsEarned || 0) + revenue, totalTrades: (uD.totalTrades || 0) + 1 });
                const newQty = hDoc.data().quantity - amount;
                if (newQty <= 0) {
                    tx.delete(hRef);
                }
                else {
                    tx.update(hRef, { quantity: newQty });
                }
                tx.set(db.collection("trades").doc(), { userId: user.id, marketId, outcomeId, type: "SELL", quantity: amount, totalCost: revenue, createdAt: admin.firestore.FieldValue.serverTimestamp() });
                tx.set(db.collection("transactions").doc(), { userId: user.id, amount: revenue, type: "TRADE_SELL", description: `Sold ${amount} shares`, referenceId: marketId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
                const newPrices = prices(updated, b);
                tx.set(db.collection("price_history").doc(), { marketId, prices: newPrices, timestamp: admin.firestore.FieldValue.serverTimestamp() });
                return { revenue, newBalance: uD.creditBalance + revenue, prices: newPrices, shares: amount };
            });
            ok(res, result);
            return;
        }
        if (path.match(/^\/markets\/[^/]+\/price-history$/) && method === "GET") {
            const marketId = path.split("/")[2];
            const snap = await db.collection("price_history").where("marketId", "==", marketId).orderBy("timestamp", "desc").limit(50).get();
            if (snap.empty) {
                // Return current prices as single data point
                const doc = await db.collection("markets").doc(marketId).get();
                if (doc.exists) {
                    const d = doc.data();
                    const oc = parseOutcomes(d, doc.id);
                    const p = prices(oc, d.liquidityParameter || 1000);
                    ok(res, [{ prices: p, timestamp: new Date().toISOString() }]);
                }
                else {
                    ok(res, []);
                }
                return;
            }
            ok(res, snap.docs.map(d => {
                var _a, _b, _c;
                const data = d.data();
                return { prices: data.prices, timestamp: ((_c = (_b = (_a = data.timestamp) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) === null || _c === void 0 ? void 0 : _c.toISOString()) || new Date().toISOString() };
            }).reverse());
            return;
        }
        if (path.match(/^\/trades\/portfolio\/[^/]+$/) && method === "GET") {
            const userId = path.split("/")[3];
            const snap = await db.collection("holdings").where("userId", "==", userId).get();
            if (snap.empty) {
                ok(res, []);
                return;
            }
            // Batch read all markets (fix N+1)
            const marketIds = [...new Set(snap.docs.map(d => d.data().marketId))];
            const marketDocs = await db.getAll(...marketIds.map(id => db.collection("markets").doc(id)));
            const marketMap = new Map();
            marketDocs.forEach(d => { if (d.exists)
                marketMap.set(d.id, d); });
            const portfolio = [];
            for (const doc of snap.docs) {
                const h = doc.data();
                if ((h.quantity || 0) <= 0)
                    continue;
                const mDoc = marketMap.get(h.marketId);
                if (!mDoc)
                    continue;
                const mD = mDoc.data();
                const oc = parseOutcomes(mD, mDoc.id);
                const b = mD.liquidityParameter || 1000;
                const p = prices(oc, b);
                const cp = p[h.outcomeId] || 0;
                const outcome = oc.find((o) => o.id === h.outcomeId);
                portfolio.push({
                    id: doc.id, marketId: h.marketId, marketTitle: mD.title, marketStatus: mD.status || "ACTIVE",
                    outcomeId: h.outcomeId, outcomeName: (outcome === null || outcome === void 0 ? void 0 : outcome.name) || "Unknown", outcomeColor: outcome === null || outcome === void 0 ? void 0 : outcome.color,
                    quantity: h.quantity, avgCost: h.avgCost, currentPrice: cp,
                    currentValue: Math.round(cp * h.quantity * 100) / 100,
                    costBasis: Math.round(h.avgCost * h.quantity * 100) / 100,
                    profitLoss: Math.round((cp * h.quantity - h.avgCost * h.quantity) * 100) / 100,
                });
            }
            ok(res, portfolio);
            return;
        }
        // ═══════════════════════════════════════════════════════════════════
        // USERS
        // ═══════════════════════════════════════════════════════════════════
        if (path === "/users/me" && method === "GET") {
            const user = await auth(req);
            if (!user) {
                fail(res, "Auth required", 401);
                return;
            }
            const doc = await db.collection("users").doc(user.id).get();
            if (!doc.exists) {
                fail(res, "User not found", 404);
                return;
            }
            const d = doc.data();
            ok(res, {
                id: doc.id, email: d.email, displayName: d.displayName, creditBalance: d.creditBalance,
                totalCreditsEarned: d.totalCreditsEarned || 0, totalCreditsSpent: d.totalCreditsSpent || 0,
                totalTrades: d.totalTrades || 0, winningTrades: d.winningTrades || 0, totalWinnings: d.totalWinnings || 0,
                roi: d.roi || 0, currentStreak: d.currentStreak || 0, longestStreak: d.longestStreak || 0,
                isPremium: d.isPremium || false,
                winRate: d.totalTrades > 0 ? Math.round((d.winningTrades / d.totalTrades) * 10000) / 100 : 0,
            });
            return;
        }
        if (path === "/users/me" && method === "PUT") {
            const user = await auth(req);
            if (!user) {
                fail(res, "Auth required", 401);
                return;
            }
            const { displayName, avatarUrl } = req.body;
            const updates = {};
            if (displayName !== undefined)
                updates.displayName = (displayName === null || displayName === void 0 ? void 0 : displayName.trim()) || null;
            if (avatarUrl !== undefined)
                updates.avatarUrl = (avatarUrl === null || avatarUrl === void 0 ? void 0 : avatarUrl.trim()) || null;
            if (Object.keys(updates).length === 0) {
                fail(res, "Nothing to update");
                return;
            }
            await db.collection("users").doc(user.id).update(updates);
            ok(res, { message: "Profile updated" });
            return;
        }
        if (path === "/users/me/transactions" && method === "GET") {
            const user = await auth(req);
            if (!user) {
                fail(res, "Auth required", 401);
                return;
            }
            const snap = await db.collection("transactions").where("userId", "==", user.id).orderBy("createdAt", "desc").limit(50).get();
            ok(res, snap.docs.map(d => ({ id: d.id, ...d.data() })));
            return;
        }
        if (path === "/users/me/daily-reward" && method === "POST") {
            const user = await auth(req);
            if (!user) {
                fail(res, "Auth required", 401);
                return;
            }
            const userRef = db.collection("users").doc(user.id);
            // Use transaction to prevent race condition
            const result = await db.runTransaction(async (tx) => {
                const doc = await tx.get(userRef);
                if (!doc.exists)
                    throw new Error("User not found");
                const d = doc.data();
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (d.lastActiveDate && d.lastActiveDate.toDate() >= today)
                    throw new Error("Already claimed");
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
            ok(res, result);
            return;
        }
        if (path === "/users/search" && method === "GET") {
            const q = (req.query.q || "").trim();
            if (q.length < 2) {
                fail(res, "Query too short");
                return;
            }
            const snap = await db.collection("users").orderBy("displayName").startAt(q).endAt(q + "\uf8ff").limit(20).get();
            const user = await auth(req);
            ok(res, snap.docs.filter(d => d.id !== (user === null || user === void 0 ? void 0 : user.id)).map(doc => {
                const d = doc.data();
                return { id: doc.id, displayName: d.displayName, creditBalance: d.creditBalance, totalTrades: d.totalTrades || 0, winRate: d.totalTrades > 0 ? Math.round((d.winningTrades / d.totalTrades) * 100) : 0 };
            }));
            return;
        }
        // ── CREDIT PACKS ──────────────────────────────────────────────────
        if (path === "/users/credit-packs" && method === "GET") {
            ok(res, [
                { code: "starter", name: "Starter Pack", credits: 500, description: "Get back in the game" },
                { code: "pro", name: "Pro Pack", credits: 2000, description: "For serious traders" },
                { code: "whale", name: "Whale Pack", credits: 10000, description: "Dominate the leaderboard" },
            ]);
            return;
        }
        if (path === "/users/me/buy-credits" && method === "POST") {
            const user = await auth(req);
            if (!user) {
                fail(res, "Auth required", 401);
                return;
            }
            const { packCode } = req.body;
            const packs = { starter: 500, pro: 2000, whale: 10000 };
            const credits = packs[packCode];
            if (!credits) {
                fail(res, "Invalid pack code");
                return;
            }
            // In production: validate payment here. For now: free virtual credits
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
            ok(res, { creditsAdded: credits, newBalance: doc.data().creditBalance });
            return;
        }
        // ── ACHIEVEMENT AUTO-TRACKING ────────────────────────────────────
        if (path === "/users/me/check-achievements" && method === "POST") {
            const user = await auth(req);
            if (!user) {
                fail(res, "Auth required", 401);
                return;
            }
            const doc = await db.collection("users").doc(user.id).get();
            if (!doc.exists) {
                fail(res, "User not found", 404);
                return;
            }
            const d = doc.data();
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
            const newlyEarned = [];
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
            ok(res, { newlyEarned, totalEarned: earned.size + newlyEarned.length });
            return;
        }
        // ═══════════════════════════════════════════════════════════════════
        // LEADERBOARD
        // ═══════════════════════════════════════════════════════════════════
        if (path === "/leaderboard" && method === "GET") {
            const snap = await db.collection("users").orderBy("creditBalance", "desc").limit(50).get();
            const user = await auth(req);
            let userRank = null;
            const lb = snap.docs.map((doc, i) => {
                const d = doc.data();
                if (doc.id === (user === null || user === void 0 ? void 0 : user.id))
                    userRank = i + 1;
                return { rank: i + 1, userId: doc.id, displayName: d.displayName || "Anonymous", score: d.creditBalance, totalTrades: d.totalTrades || 0, winRate: d.totalTrades > 0 ? Math.round((d.winningTrades / d.totalTrades) * 100) : 0 };
            });
            ok(res, { leaderboard: lb, userRank });
            return;
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
            ok(res, defaults);
            return;
        }
        // ═══════════════════════════════════════════════════════════════════
        // COMMENTS (with auth on likes)
        // ═══════════════════════════════════════════════════════════════════
        if (path.match(/^\/markets\/[^/]+\/comments$/) && method === "GET") {
            const marketId = path.split("/")[2];
            const snap = await db.collection("comments").where("marketId", "==", marketId).limit(20).get();
            const comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            comments.sort((a, b) => { var _a, _b; return (((_a = b.createdAt) === null || _a === void 0 ? void 0 : _a._seconds) || 0) - (((_b = a.createdAt) === null || _b === void 0 ? void 0 : _b._seconds) || 0); });
            ok(res, comments);
            return;
        }
        if (path.match(/^\/markets\/[^/]+\/comments$/) && method === "POST") {
            const user = await auth(req);
            if (!user) {
                fail(res, "Auth required", 401);
                return;
            }
            const marketId = path.split("/")[2];
            const { content } = req.body;
            if (!(content === null || content === void 0 ? void 0 : content.trim()) || content.trim().length > 500) {
                fail(res, "Comment must be 1-500 characters");
                return;
            }
            const userDoc = await db.collection("users").doc(user.id).get();
            const displayName = userDoc.exists ? userDoc.data().displayName : "Anonymous";
            const ref = await db.collection("comments").add({
                marketId, userId: user.id, content: content.trim(), likes: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                user: { id: user.id, displayName },
            });
            ok(res, { id: ref.id, marketId, userId: user.id, content: content.trim(), likes: 0, user: { id: user.id, displayName } }, 201);
            return;
        }
        if (path.match(/^\/markets\/[^/]+\/comments\/[^/]+\/like$/) && method === "POST") {
            const user = await auth(req);
            if (!user) {
                fail(res, "Auth required", 401);
                return;
            }
            const parts = path.split("/");
            const commentId = parts[4];
            // Prevent duplicate likes
            const likeId = `${user.id}_${commentId}`;
            const likeRef = db.collection("comment_likes").doc(likeId);
            const likeDoc = await likeRef.get();
            if (likeDoc.exists) {
                fail(res, "Already liked", 409);
                return;
            }
            await likeRef.set({ userId: user.id, commentId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
            await db.collection("comments").doc(commentId).update({ likes: admin.firestore.FieldValue.increment(1) });
            ok(res, { message: "Liked" });
            return;
        }
        // ═══════════════════════════════════════════════════════════════════
        // SOCIAL
        // ═══════════════════════════════════════════════════════════════════
        if (path === "/social/friends" && method === "GET") {
            const user = await auth(req);
            if (!user) {
                fail(res, "Auth required", 401);
                return;
            }
            const snap = await db.collection("follows").where("followerId", "==", user.id).get();
            if (snap.empty) {
                ok(res, []);
                return;
            }
            // Batch read users (fix N+1)
            const userIds = snap.docs.map(d => d.data().followingId);
            const userDocs = await db.getAll(...userIds.map(id => db.collection("users").doc(id)));
            const friends = userDocs.filter(d => d.exists).map(d => {
                const data = d.data();
                return { id: d.id, displayName: data.displayName, creditBalance: data.creditBalance, totalTrades: data.totalTrades || 0, winRate: data.totalTrades > 0 ? Math.round((data.winningTrades / data.totalTrades) * 100) : 0 };
            });
            ok(res, friends);
            return;
        }
        if (path.match(/^\/social\/follow\/[^/]+$/) && method === "POST") {
            const user = await auth(req);
            if (!user) {
                fail(res, "Auth required", 401);
                return;
            }
            const followingId = path.split("/")[3];
            if (followingId === user.id) {
                fail(res, "Cannot follow yourself");
                return;
            }
            await db.collection("follows").doc(`${user.id}_${followingId}`).set({ followerId: user.id, followingId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
            ok(res, { message: "Following" });
            return;
        }
        if (path.match(/^\/social\/follow\/[^/]+$/) && method === "DELETE") {
            const user = await auth(req);
            if (!user) {
                fail(res, "Auth required", 401);
                return;
            }
            await db.collection("follows").doc(`${user.id}_${path.split("/")[3]}`).delete();
            ok(res, { message: "Unfollowed" });
            return;
        }
        if (path === "/social/challenges" && method === "GET") {
            const user = await auth(req);
            if (!user) {
                fail(res, "Auth required", 401);
                return;
            }
            ok(res, []);
            return;
        }
        if (path === "/social/referral" && method === "GET") {
            const user = await auth(req);
            if (!user) {
                fail(res, "Auth required", 401);
                return;
            }
            const doc = await db.collection("users").doc(user.id).get();
            const d = doc.data() || {};
            ok(res, { referralCode: d.referralCode || user.id.slice(0, 8).toUpperCase(), referralCount: 0, creditsEarned: 0 });
            return;
        }
        // ═══════════════════════════════════════════════════════════════════
        // PROPOSALS (with duplicate vote prevention)
        // ═══════════════════════════════════════════════════════════════════
        if (path === "/proposals" && method === "GET") {
            const status = req.query.status || "PENDING";
            const snap = await db.collection("proposals").where("status", "==", status).limit(20).get();
            const proposals = snap.docs.map(d => ({ id: d.id, ...d.data(), hasVoted: false }));
            proposals.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
            ok(res, proposals);
            return;
        }
        if (path === "/proposals" && method === "POST") {
            const user = await auth(req);
            if (!user) {
                fail(res, "Auth required", 401);
                return;
            }
            const { title, description, category, outcomes, suggestedExpiry, resolutionCriteria } = req.body;
            if (!(title === null || title === void 0 ? void 0 : title.trim()) || title.trim().length < 5) {
                fail(res, "Title must be at least 5 characters");
                return;
            }
            const userDoc = await db.collection("users").doc(user.id).get();
            const displayName = userDoc.exists ? userDoc.data().displayName : "Anonymous";
            const ref = await db.collection("proposals").add({
                title: title.trim(), description: (description === null || description === void 0 ? void 0 : description.trim()) || null, category: category || "OTHER",
                outcomes: Array.isArray(outcomes) && outcomes.length >= 2 ? outcomes : ["Yes", "No"],
                suggestedExpiry: suggestedExpiry || "", resolutionCriteria: resolutionCriteria || null,
                status: "PENDING", upvotes: 0, createdById: user.id,
                createdBy: { id: user.id, displayName },
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            ok(res, { id: ref.id, title: title.trim(), status: "PENDING", upvotes: 0, createdBy: { id: user.id, displayName } }, 201);
            return;
        }
        if (path === "/proposals/mine" && method === "GET") {
            const user = await auth(req);
            if (!user) {
                fail(res, "Auth required", 401);
                return;
            }
            const snap = await db.collection("proposals").where("createdById", "==", user.id).limit(20).get();
            const proposals = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            proposals.sort((a, b) => { var _a, _b; return (((_a = b.createdAt) === null || _a === void 0 ? void 0 : _a._seconds) || 0) - (((_b = a.createdAt) === null || _b === void 0 ? void 0 : _b._seconds) || 0); });
            ok(res, proposals);
            return;
        }
        if (path.match(/^\/proposals\/[^/]+\/vote$/) && method === "POST") {
            const user = await auth(req);
            if (!user) {
                fail(res, "Auth required", 401);
                return;
            }
            const proposalId = path.split("/")[2];
            // Prevent duplicate votes
            const voteId = `${user.id}_${proposalId}`;
            const voteRef = db.collection("proposal_votes").doc(voteId);
            const voteDoc = await voteRef.get();
            if (voteDoc.exists) {
                fail(res, "Already voted", 409);
                return;
            }
            await voteRef.set({ userId: user.id, proposalId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
            await db.collection("proposals").doc(proposalId).update({ upvotes: admin.firestore.FieldValue.increment(1) });
            ok(res, { message: "Voted" });
            return;
        }
        // ═══════════════════════════════════════════════════════════════════
        // TOURNAMENTS
        // ═══════════════════════════════════════════════════════════════════
        if (path === "/tournaments" && method === "GET") {
            const snap = await db.collection("tournaments").get();
            ok(res, snap.docs.map(d => ({ id: d.id, ...d.data(), participants: 0 })));
            return;
        }
        // ═══════════════════════════════════════════════════════════════════
        // HEALTH
        // ═══════════════════════════════════════════════════════════════════
        if (path === "/health" || path === "/") {
            ok(res, { status: "ok", version: "1.1.0" });
            return;
        }
        fail(res, "Route not found", 404);
    }
    catch (e) {
        console.error("API Error:", e);
        const status = ((_a = e.message) === null || _a === void 0 ? void 0 : _a.includes("not found")) ? 404 : ((_b = e.message) === null || _b === void 0 ? void 0 : _b.includes("Insufficient")) ? 400 : 500;
        fail(res, e.message || "Internal server error", status);
    }
});
// v1.2.0
//# sourceMappingURL=index.js.map