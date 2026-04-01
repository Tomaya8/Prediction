import * as admin from "firebase-admin";
import { detectCategory } from "./index";

function getDb() { return admin.firestore(); }

type Res = { status: number; body: any };
function ok(data: any, status = 200): Res { return { status, body: { success: true, data } }; }
function fail(msg: string, status = 400): Res { return { status, body: { success: false, error: msg } }; }

export async function handleAdminRoute(path: string, method: string, body: any, userId: string): Promise<Res | null> {

  if (path.match(/^\/proposals\/[^/]+\/approve$/) && method === "POST") {
    const proposalId = path.split("/")[2];
    const pDoc = await getDb().collection("proposals").doc(proposalId).get();
    if (!pDoc.exists) return fail("Proposal not found", 404);
    const p = pDoc.data()!;
    if (p.status !== "PENDING") return fail("Already " + p.status);
    const outcomeNames = Array.isArray(p.outcomes) ? p.outcomes : ["Yes", "No"];
    const colors = ["#16A34A", "#DC2626", "#2563EB", "#D97706", "#7C3AED"];
    const outcomes = outcomeNames.map((name: string, i: number) => ({
      id: name.toLowerCase().replace(/\s+/g, "_"),
      name,
      color: colors[i % colors.length],
      quantity: 0,
    }));
    const category = body.category || p.category || "OTHER";
    const marketRef = await getDb().collection("markets").add({
      title: p.title, description: p.description || null, category,
      outcomes, liquidityParameter: 1000, totalVolume: 0, status: "OPEN",
      expiresAt: p.suggestedExpiry || null, createdById: p.createdById || userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(), approvedBy: userId,
    });
    await getDb().collection("proposals").doc(proposalId).update({
      status: "APPROVED", marketId: marketRef.id,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(), approvedBy: userId,
    });
    return ok({ message: "Proposal approved", marketId: marketRef.id });
  }

  if (path.match(/^\/proposals\/[^/]+\/reject$/) && method === "POST") {
    const proposalId = path.split("/")[2];
    const pDoc = await getDb().collection("proposals").doc(proposalId).get();
    if (!pDoc.exists) return fail("Proposal not found", 404);
    if (pDoc.data()!.status !== "PENDING") return fail("Already " + pDoc.data()!.status);
    await getDb().collection("proposals").doc(proposalId).update({
      status: "REJECTED", rejectionReason: body.reason || null,
      rejectedAt: admin.firestore.FieldValue.serverTimestamp(), rejectedBy: userId,
    });
    return ok({ message: "Proposal rejected" });
  }

  if (path.match(/^\/admin\/users\/[^/]+\/credits$/) && method === "POST") {
    const targetId = path.split("/")[3];
    const { amount, reason } = body;
    if (typeof amount !== "number" || amount === 0) return fail("amount must be a non-zero number");
    const userRef = getDb().collection("users").doc(targetId);
    const uDoc = await userRef.get();
    if (!uDoc.exists) return fail("User not found", 404);
    await userRef.update({ creditBalance: admin.firestore.FieldValue.increment(amount) });
    await getDb().collection("transactions").add({
      userId: targetId, type: "admin_adjustment", amount, reason: reason || "Admin adjustment",
      performedBy: userId, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return ok({ message: "Credits adjusted by " + amount, newBalance: (uDoc.data()!.creditBalance || 0) + amount });
  }

  if (path.match(/^\/admin\/users\/[^/]+\/ban$/) && method === "POST") {
    const targetId = path.split("/")[3];
    const userRef = getDb().collection("users").doc(targetId);
    const uDoc = await userRef.get();
    if (!uDoc.exists) return fail("User not found", 404);
    await userRef.update({ banned: !!body.banned, bannedAt: admin.firestore.FieldValue.serverTimestamp(), bannedBy: userId });
    return ok({ message: body.banned ? "User banned" : "User unbanned" });
  }

  if (path === "/admin/sync-markets" && method === "POST") {
    let created = 0, skipped = 0;
    let botSnap = await getDb().collection("users").where("email", "==", "bot@predich.system").limit(1).get();
    const botId = botSnap.empty ? userId : botSnap.docs[0].id;
    const existing = new Set<string>();
    (await getDb().collection("markets").select("title").get()).docs.forEach(d => existing.add((d.data().title || "").toLowerCase()));
    (await getDb().collection("proposals").select("title").get()).docs.forEach(d => existing.add((d.data().title || "").toLowerCase()));
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
          await getDb().collection("proposals").add({
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
    try {
      const r = await fetch("https://api.manifold.markets/v0/markets?limit=20&sort=score");
      if (r.ok) {
        const markets = await r.json();
        for (const m of markets) {
          const title = (m.question || "").trim();
          if (!title || existing.has(title.toLowerCase())) { skipped++; continue; }
          existing.add(title.toLowerCase());
          await getDb().collection("proposals").add({
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
    return ok({ message: "Sync complete", created, skipped });
  }

  if (path === "/admin/stats" && method === "GET") {
    const [usersSnap, marketsSnap, proposalsSnap] = await Promise.all([
      getDb().collection("users").select().get(),
      getDb().collection("markets").select("totalVolume", "status").get(),
      getDb().collection("proposals").where("status", "==", "PENDING").select().get(),
    ]);
    let totalVolume = 0, activeMarkets = 0;
    marketsSnap.docs.forEach(d => {
      totalVolume += d.data().totalVolume || 0;
      if (d.data().status === "ACTIVE" || !d.data().status) activeMarkets++;
    });
    return ok({ totalUsers: usersSnap.size, totalMarkets: marketsSnap.size, activeMarkets, pendingProposals: proposalsSnap.size, totalVolume });
  }

  return null;
}
