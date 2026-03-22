/**
 * Market Sync Script
 * Scrapes trending markets from Polymarket and Manifold Markets,
 * then creates auto-proposals for admin review.
 *
 * Usage:
 *   npx ts-node src/scripts/sync-markets.ts              # one-shot
 *   npx ts-node src/scripts/sync-markets.ts --loop 30    # repeat every 30 minutes
 *
 * Can also be triggered via POST /api/admin/sync-markets (see admin routes).
 */

import { PrismaClient, MarketCategory } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Category Mapping ────────────────────────────────────────────────────────

const POLYMARKET_CATEGORY_MAP: Record<string, MarketCategory> = {
  'politics': 'POLITICS',
  'us-politics': 'POLITICS',
  'us-current-affairs': 'POLITICS',
  'world-politics': 'POLITICS',
  'elections': 'POLITICS',
  'sports': 'SPORTS',
  'nfl': 'SPORTS',
  'nba': 'SPORTS',
  'soccer': 'SPORTS',
  'mma': 'SPORTS',
  'baseball': 'SPORTS',
  'crypto': 'CRYPTO',
  'bitcoin': 'CRYPTO',
  'ethereum': 'CRYPTO',
  'defi': 'CRYPTO',
  'entertainment': 'ENTERTAINMENT',
  'pop-culture': 'ENTERTAINMENT',
  'music': 'ENTERTAINMENT',
  'movies': 'ENTERTAINMENT',
  'gaming': 'ENTERTAINMENT',
  'science': 'SCIENCE',
  'ai': 'TECHNOLOGY',
  'tech': 'TECHNOLOGY',
  'technology': 'TECHNOLOGY',
  'business': 'BUSINESS',
  'finance': 'BUSINESS',
  'economics': 'BUSINESS',
};

function mapCategory(raw: string | null | undefined, title?: string): MarketCategory {
  if (raw) {
    const lower = raw.toLowerCase().replace(/\s+/g, '-');
    if (POLYMARKET_CATEGORY_MAP[lower]) return POLYMARKET_CATEGORY_MAP[lower];
  }

  // Fallback: infer category from keywords in the title
  if (title) {
    const t = title.toLowerCase();
    if (/trump|biden|president|election|senate|congress|democrat|republican|vote|governor|minister|regime|ceasefire|invasion|nato|sanction/.test(t)) return 'POLITICS';
    if (/nfl|nba|mlb|fifa|world cup|premier league|champions league|super bowl|tennis|golf|ufc|boxing|mma|basketball|football|soccer|baseball|hockey|olympic|tournament|match|vs\.?|win on \d{4}/.test(t)) return 'SPORTS';
    if (/bitcoin|btc|ethereum|eth|crypto|solana|dogecoin|nft|defi|blockchain|token|stablecoin|altcoin/.test(t)) return 'CRYPTO';
    if (/movie|film|oscar|grammy|album|netflix|disney|streaming|tiktok|youtube|gaming|gta|nintendo|spotify|marvel/.test(t)) return 'ENTERTAINMENT';
    if (/spacex|nasa|ai |artificial intelligence|climate|vaccine|fda|crispr|quantum|neuralink|mars|moon/.test(t)) return 'SCIENCE';
    if (/apple|google|microsoft|nvidia|tesla|openai|gpt|robot|self-driving|ar glasses|starlink|cyber/.test(t)) return 'TECHNOLOGY';
    if (/stock|market cap|ipo|s&p|fed |interest rate|inflation|recession|gdp|tariff|trade war|revenue/.test(t)) return 'BUSINESS';
  }

  return 'OTHER';
}

// ─── Polymarket Scraper ──────────────────────────────────────────────────────

interface PolymarketMarket {
  id: string;
  question: string;
  description: string;
  outcomes: string;
  outcomePrices: string;
  volume24hr: number;
  volumeNum: number;
  category: string;
  endDate: string;
  active: boolean;
  closed: boolean;
}

async function fetchPolymarketTrending(limit = 20): Promise<PolymarketMarket[]> {
  try {
    const url = `https://gamma-api.polymarket.com/markets?limit=${limit}&active=true&closed=false&order=volume24hr&ascending=false`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Polymarket API error: ${res.status}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Polymarket fetch error:', err);
    return [];
  }
}

// ─── Manifold Markets Scraper ────────────────────────────────────────────────

interface ManifoldMarket {
  id: string;
  question: string;
  slug: string;
  url: string;
  volume: number;
  volume24Hours: number;
  closeTime: number;
  isResolved: boolean;
  outcomeType: string;
  uniqueBettorCount: number;
}

async function fetchManifoldTrending(limit = 20): Promise<ManifoldMarket[]> {
  try {
    const url = `https://api.manifold.markets/v0/markets?limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Manifold API error: ${res.status}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data.filter((m: any) => !m.isResolved) : [];
  } catch (err) {
    console.error('Manifold fetch error:', err);
    return [];
  }
}

// ─── Deduplication ───────────────────────────────────────────────────────────

async function isDuplicate(title: string): Promise<boolean> {
  // Normalize: lowercase, strip punctuation
  const normalized = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const words = normalized.split(/\s+/).filter(w => w.length > 3);
  if (words.length === 0) return true;

  // Check existing markets
  const existingMarkets = await prisma.market.findMany({
    where: { title: { mode: 'insensitive', contains: words[0] } },
    select: { title: true },
  });

  // Check existing proposals
  const existingProposals = await prisma.marketProposal.findMany({
    where: { title: { mode: 'insensitive', contains: words[0] } },
    select: { title: true },
  });

  const allTitles = [
    ...existingMarkets.map(m => m.title.toLowerCase()),
    ...existingProposals.map(p => p.title.toLowerCase()),
  ];

  // Simple similarity check: if >60% of significant words match, it's a duplicate
  for (const existing of allTitles) {
    const existingWords = existing.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
    const matchCount = words.filter(w => existingWords.includes(w)).length;
    const similarity = matchCount / Math.max(words.length, 1);
    if (similarity > 0.6) return true;
  }

  return false;
}

// ─── System User ─────────────────────────────────────────────────────────────

async function getOrCreateBotUser(): Promise<string> {
  const BOT_EMAIL = 'bot@predictspinz.system';
  let user = await prisma.user.findUnique({ where: { email: BOT_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: BOT_EMAIL,
        displayName: 'PredictSpinz Bot',
        firebaseUid: `system_bot_${Date.now()}`,
        creditBalance: 0,
        isAdmin: false,
      },
    });
    console.log('  Created system bot user');
  }
  return user.id;
}

// ─── Main Sync Function ─────────────────────────────────────────────────────

export async function syncMarkets(): Promise<{ polymarket: number; manifold: number; skipped: number }> {
  console.log('🔄 Syncing markets from external sources...');

  const botUserId = await getOrCreateBotUser();
  let created = { polymarket: 0, manifold: 0 };
  let skipped = 0;

  // ── Polymarket ──
  console.log('\n📊 Fetching from Polymarket...');
  const polymarkets = await fetchPolymarketTrending(30);
  console.log(`  Found ${polymarkets.length} trending markets`);

  for (const pm of polymarkets) {
    if (!pm.question || pm.question.length < 10) { skipped++; continue; }

    const dup = await isDuplicate(pm.question);
    if (dup) { skipped++; continue; }

    let outcomes: string[];
    try {
      outcomes = JSON.parse(pm.outcomes);
    } catch {
      outcomes = ['Yes', 'No'];
    }

    const category = mapCategory(pm.category, pm.question);
    const expiryDate = pm.endDate ? new Date(pm.endDate) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    if (expiryDate <= new Date()) { skipped++; continue; }

    await prisma.marketProposal.create({
      data: {
        title: pm.question,
        description: pm.description?.slice(0, 500) || null,
        category,
        outcomes,
        suggestedExpiry: expiryDate,
        resolutionCriteria: 'Source: Polymarket',
        sourceUrl: `https://polymarket.com/event/${pm.id}`,
        createdById: botUserId,
      },
    });
    console.log(`  ✅ [${category}] ${pm.question.slice(0, 80)}`);
    created.polymarket++;
  }

  // ── Manifold Markets ──
  console.log('\n🔮 Fetching from Manifold Markets...');
  const manifolds = await fetchManifoldTrending(20);
  console.log(`  Found ${manifolds.length} trending markets`);

  for (const mm of manifolds) {
    if (!mm.question || mm.question.length < 10) { skipped++; continue; }

    const dup = await isDuplicate(mm.question);
    if (dup) { skipped++; continue; }

    const expiryDate = mm.closeTime
      ? new Date(mm.closeTime)
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    if (expiryDate <= new Date()) { skipped++; continue; }

    const outcomes = mm.outcomeType === 'BINARY' ? ['Yes', 'No'] : ['Yes', 'No'];

    await prisma.marketProposal.create({
      data: {
        title: mm.question,
        description: null,
        category: 'OTHER',
        outcomes,
        suggestedExpiry: expiryDate,
        resolutionCriteria: 'Source: Manifold Markets',
        sourceUrl: mm.url || `https://manifold.markets/${mm.slug}`,
        createdById: botUserId,
      },
    });
    console.log(`  ✅ ${mm.question.slice(0, 80)}`);
    created.manifold++;
  }

  console.log(`\n🎉 Sync complete! Polymarket: ${created.polymarket}, Manifold: ${created.manifold}, Skipped: ${skipped}`);
  return { ...created, skipped };
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const loopIndex = args.indexOf('--loop');
  const intervalMinutes = loopIndex >= 0 ? parseInt(args[loopIndex + 1]) || 30 : 0;

  if (intervalMinutes > 0) {
    console.log(`🔁 Running in loop mode every ${intervalMinutes} minutes\n`);
    while (true) {
      await syncMarkets();
      console.log(`\n⏰ Next sync in ${intervalMinutes} minutes...\n`);
      await new Promise(r => setTimeout(r, intervalMinutes * 60 * 1000));
    }
  } else {
    await syncMarkets();
    await prisma.$disconnect();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
