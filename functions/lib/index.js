"use strict";
/**
 * Predich — Firebase Cloud Functions Backend
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const bcrypt = __importStar(require("bcryptjs"));
const jwt = __importStar(require("jsonwebtoken"));
admin.initializeApp();
const db = admin.firestore();
const JWT_SECRET = "predich-prod-secret-2026";
const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
};
function send(res, status, body) {
    Object.entries(CORS).forEach(([k, v]) => res.set(k, v));
    res.status(status).json(body);
}
function ok(res, data, status = 200) {
    send(res, status, { success: true, data });
}
function fail(res, msg, status = 400) {
    send(res, status, { success: false, error: msg });
}
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
// LMSR
function cost(outcomes, b) {
    let s = 0;
    for (const o of outcomes)
        s += Math.exp((o.quantity || 0) / b);
    return b * Math.log(s);
}
function buyCost(outcomes, b, oid, amt) {
    const before = cost(outcomes, b);
    const after = cost(outcomes.map((o) => o.id === oid ? { ...o, quantity: (o.quantity || 0) + amt } : o), b);
    return Math.round((after - before) * 100) / 100;
}
function prices(outcomes, b) {
    let s = 0;
    for (const o of outcomes)
        s += Math.exp((o.quantity || 0) / b);
    const p = {};
    for (const o of outcomes)
        p[o.id] = Math.round((Math.exp((o.quantity || 0) / b) / s) * 10000) / 10000;
    return p;
}
function sharesForCost(outcomes, b, oid, budget) {
    if (budget <= 0)
        return 0;
    let lo = 0, hi = budget * 10;
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
// ═══════════════════════════════════════════════════════════════════════════════
exports.api = functions.https.onRequest(async (req, res) => {
    if (req.method === "OPTIONS") {
        Object.entries(CORS).forEach(([k, v]) => res.set(k, v));
        res.status(204).send("");
        return;
    }
    const path = req.path.replace(/^\/api/, "");
    const method = req.method;
    try {
        // ── AUTH ──────────────────────────────────────────────────────────────
        if (path === "/auth/register" && method === "POST") {
            const { email, password, displayName } = req.body;
            if (!email || !password) {
                fail(res, "Email and password required");
                return;
            }
            if (password.length < 6) {
                fail(res, "Password must be at least 6 characters");
                return;
            }
            const ex = await db.collection("users").where("email", "==", email).limit(1).get();
            if (!ex.empty) {
                fail(res, "Email already in use", 409);
                return;
            }
            const hash = await bcrypt.hash(password, 10);
            const ref = db.collection("users").doc();
            await ref.set({ email, displayName: (displayName === null || displayName === void 0 ? void 0 : displayName.trim()) || null, passwordHash: hash, creditBalance: 1000, totalCreditsEarned: 0, totalCreditsSpent: 0, totalTrades: 0, winningTrades: 0, totalWinnings: 0, roi: 0, currentStreak: 0, longestStreak: 0, isPremium: false, isAdmin: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
            await db.collection("transactions").add({ userId: ref.id, amount: 1000, type: "STARTING_BONUS", description: "Welcome bonus", createdAt: admin.firestore.FieldValue.serverTimestamp() });
            const token = jwt.sign({ userId: ref.id, email }, JWT_SECRET, { expiresIn: "30d" });
            ok(res, { token, user: { id: ref.id, email, displayName: (displayName === null || displayName === void 0 ? void 0 : displayName.trim()) || null, creditBalance: 1000 } }, 201);
            return;
        }
        if (path === "/auth/login" && method === "POST") {
            const { email, password } = req.body;
            if (!email || !password) {
                fail(res, "Email and password required");
                return;
            }
            const snap = await db.collection("users").where("email", "==", email).limit(1).get();
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
            const token = jwt.sign({ userId: doc.id, email }, JWT_SECRET, { expiresIn: "30d" });
            ok(res, { token, user: { id: doc.id, email, displayName: d.displayName, creditBalance: d.creditBalance } });
            return;
        }
        // ── MARKETS ───────────────────────────────────────────────────────────
        if ((path === "/markets" || path === "/trades/markets") && method === "GET") {
            const limit = Math.min(parseInt(req.query.limit) || 20, 50);
            let q = db.collection("markets").limit(limit);
            const category = req.query.category;
            if (category)
                q = q.where("category", "==", category);
            const snap = await q.get();
            const markets = snap.docs.map(doc => {
                const d = doc.data();
                const oc = parseOutcomes(d, doc.id);
                const p = prices(oc, d.liquidityParameter || 1000);
                return { id: doc.id, title: d.title, description: d.description, category: d.category, expiresAt: d.expiresAt, totalVolume: d.totalVolume || 0, status: d.status || "ACTIVE", outcomes: oc.map((o) => ({ ...o, currentPrice: p[o.id] })), prices: p };
            });
            ok(res, markets);
            return;
        }
        if ((path.match(/^\/markets\/[^/]+$/) || path.match(/^\/trades\/markets\/[^/]+$/)) && method === "GET") {
            const parts = path.split("/");
            const marketId = parts[parts.length - 1];
            const doc = await db.collection("markets").doc(marketId).get();
            if (!doc.exists) {
                fail(res, "Market not found", 404);
                return;
            }
            const d = doc.data();
            const oc = parseOutcomes(d, doc.id);
            const p = prices(oc, d.liquidityParameter || 1000);
            ok(res, { id: doc.id, title: d.title, description: d.description, category: d.category, expiresAt: d.expiresAt, totalVolume: d.totalVolume || 0, status: d.status || "ACTIVE", outcomes: oc.map((o) => ({ ...o, currentPrice: p[o.id] })), prices: p });
            return;
        }
        // ── TRADING ───────────────────────────────────────────────────────────
        if (path === "/trades/preview-by-cost" && method === "POST") {
            const { marketId, outcomeId, credits } = req.body;
            if (!marketId || !outcomeId || !credits) {
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
        if (path === "/trades/trade" && method === "POST") {
            const user = await auth(req);
            if (!user) {
                fail(res, "Auth required", 401);
                return;
            }
            const { marketId, outcomeId, amount } = req.body;
            if (!marketId || !outcomeId || !amount || amount <= 0) {
                fail(res, "Missing fields");
                return;
            }
            const marketRef = db.collection("markets").doc(marketId);
            const userRef = db.collection("users").doc(user.id);
            const result = await db.runTransaction(async (tx) => {
                const mDoc = await tx.get(marketRef);
                const uDoc = await tx.get(userRef);
                if (!mDoc.exists)
                    throw new Error("Market not found");
                if (!uDoc.exists)
                    throw new Error("User not found");
                const mD = mDoc.data();
                const uD = uDoc.data();
                const b = mD.liquidityParameter || 1000;
                const oc = parseOutcomes(mD, mDoc.id);
                const c = Math.max(1, Math.round(buyCost(oc, b, outcomeId, amount)));
                if (uD.creditBalance < c)
                    throw new Error("Insufficient credits");
                const updated = oc.map((o) => o.id === outcomeId ? { ...o, quantity: o.quantity + amount } : o);
                tx.update(marketRef, { outcomes: updated, totalVolume: (mD.totalVolume || 0) + c });
                tx.update(userRef, { creditBalance: uD.creditBalance - c, totalCreditsSpent: (uD.totalCreditsSpent || 0) + c, totalTrades: (uD.totalTrades || 0) + 1 });
                tx.set(db.collection("trades").doc(), { userId: user.id, marketId, outcomeId, type: "BUY", quantity: amount, totalCost: c, createdAt: admin.firestore.FieldValue.serverTimestamp() });
                const hId = `${user.id}_${marketId}_${outcomeId}`;
                const hRef = db.collection("holdings").doc(hId);
                const hDoc = await tx.get(hRef);
                if (hDoc.exists) {
                    const h = hDoc.data();
                    const nq = h.quantity + amount;
                    tx.update(hRef, { quantity: nq, avgCost: (h.avgCost * h.quantity + (c / amount) * amount) / nq });
                }
                else {
                    tx.set(hRef, { userId: user.id, marketId, outcomeId, quantity: amount, avgCost: c / amount });
                }
                tx.set(db.collection("transactions").doc(), { userId: user.id, amount: -c, type: "TRADE_BUY", description: `Bought ${amount} shares`, referenceId: marketId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
                return { cost: c, newBalance: uD.creditBalance - c, prices: prices(updated, b), shares: amount };
            });
            ok(res, result);
            return;
        }
        if (path.match(/^\/trades\/portfolio\/[^/]+$/) && method === "GET") {
            const userId = path.split("/")[3];
            const snap = await db.collection("holdings").where("userId", "==", userId).get();
            const portfolio = [];
            for (const doc of snap.docs) {
                const h = doc.data();
                if ((h.quantity || 0) <= 0)
                    continue;
                const mDoc = await db.collection("markets").doc(h.marketId).get();
                if (!mDoc.exists)
                    continue;
                const mD = mDoc.data();
                const oc = parseOutcomes(mD, mDoc.id);
                const b = mD.liquidityParameter || 1000;
                const p = prices(oc, b);
                const cp = p[h.outcomeId] || 0;
                const outcome = oc.find((o) => o.id === h.outcomeId);
                portfolio.push({ id: doc.id, marketId: h.marketId, marketTitle: mD.title, marketStatus: mD.status || "ACTIVE", outcomeId: h.outcomeId, outcomeName: (outcome === null || outcome === void 0 ? void 0 : outcome.name) || "Unknown", outcomeColor: outcome === null || outcome === void 0 ? void 0 : outcome.color, quantity: h.quantity, avgCost: h.avgCost, currentPrice: cp, currentValue: Math.round(cp * h.quantity * 100) / 100, costBasis: Math.round(h.avgCost * h.quantity * 100) / 100, profitLoss: Math.round((cp * h.quantity - h.avgCost * h.quantity) * 100) / 100 });
            }
            ok(res, portfolio);
            return;
        }
        // ── USERS ─────────────────────────────────────────────────────────────
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
            ok(res, { id: doc.id, email: d.email, displayName: d.displayName, creditBalance: d.creditBalance, totalCreditsEarned: d.totalCreditsEarned || 0, totalCreditsSpent: d.totalCreditsSpent || 0, totalTrades: d.totalTrades || 0, winningTrades: d.winningTrades || 0, totalWinnings: d.totalWinnings || 0, roi: d.roi || 0, currentStreak: d.currentStreak || 0, longestStreak: d.longestStreak || 0, isPremium: d.isPremium || false, winRate: d.totalTrades > 0 ? Math.round((d.winningTrades / d.totalTrades) * 10000) / 100 : 0 });
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
            const ref = db.collection("users").doc(user.id);
            const doc = await ref.get();
            if (!doc.exists) {
                fail(res, "User not found", 404);
                return;
            }
            const d = doc.data();
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (d.lastActiveDate && d.lastActiveDate.toDate() >= today) {
                fail(res, "Already claimed");
                return;
            }
            const reward = 50 + Math.min((d.currentStreak || 0) * 10, 100);
            const streak = (d.currentStreak || 0) + 1;
            await ref.update({ creditBalance: admin.firestore.FieldValue.increment(reward), totalCreditsEarned: admin.firestore.FieldValue.increment(reward), currentStreak: streak, longestStreak: Math.max(d.longestStreak || 0, streak), lastActiveDate: admin.firestore.Timestamp.now() });
            await db.collection("transactions").add({ userId: user.id, amount: reward, type: "DAILY_REWARD", description: `Daily reward (streak: ${streak})`, createdAt: admin.firestore.FieldValue.serverTimestamp() });
            ok(res, { reward, streak, balance: d.creditBalance + reward });
            return;
        }
        if (path === "/users/search" && method === "GET") {
            const q = (req.query.q || "").trim();
            if (q.length < 2) {
                fail(res, "Query too short");
                return;
            }
            const snap = await db.collection("users").orderBy("displayName").startAt(q).endAt(q + "\uf8ff").limit(20).get();
            ok(res, snap.docs.map(doc => { const d = doc.data(); return { id: doc.id, displayName: d.displayName, creditBalance: d.creditBalance, totalTrades: d.totalTrades || 0, winRate: d.totalTrades > 0 ? Math.round((d.winningTrades / d.totalTrades) * 100) : 0 }; }));
            return;
        }
        // ── LEADERBOARD ───────────────────────────────────────────────────────
        if (path === "/leaderboard" && method === "GET") {
            const snap = await db.collection("users").orderBy("creditBalance", "desc").limit(50).get();
            const lb = snap.docs.map((doc, i) => { const d = doc.data(); return { rank: i + 1, userId: doc.id, displayName: d.displayName || "Anonymous", score: d.creditBalance, totalTrades: d.totalTrades || 0, winRate: d.totalTrades > 0 ? Math.round((d.winningTrades / d.totalTrades) * 100) : 0 }; });
            ok(res, { leaderboard: lb });
            return;
        }
        // ── HEALTH ────────────────────────────────────────────────────────────
        if (path === "/health" || path === "/") {
            ok(res, { status: "ok" });
            return;
        }
        fail(res, "Route not found", 404);
    }
    catch (e) {
        console.error("API Error:", e);
        fail(res, e.message || "Internal server error", 500);
    }
});
//# sourceMappingURL=index.js.map