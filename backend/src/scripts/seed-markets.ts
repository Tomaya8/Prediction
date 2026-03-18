// Seed Script - Run this to populate initial markets in Firestore
// Usage: npx ts-node src/scripts/seed-markets.ts

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// You'll need to download service account from Firebase Console
const serviceAccount = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID || 'prediction-app-2026',
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
};

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount as any),
  });
}

const db: Firestore = getFirestore();

// Sample markets data (from prediction questions)
const MARKETS_DATA = [
  // Politics
  { id: 'pol-1', title: 'Will Trump win the 2028 Presidential Election?', description: 'Donald Trump wins the 2028 US Presidential Election', category: 'POLITICS', expiresAt: '2028-11-05', outcomes: [{ id: 'yes', name: 'Yes', quantity: 1000 }, { id: 'no', name: 'No', quantity: 1000 }], liquidityParameter: 1000, status: 'OPEN', totalVolume: 5000 },
  { id: 'pol-2', title: 'Will the US enter a recession in 2025?', description: 'US economy officially enters a recession as defined by NBER', category: 'POLITICS', expiresAt: '2025-12-31', outcomes: [{ id: 'yes', name: 'Yes', quantity: 1000 }, { id: 'no', name: 'No', quantity: 1000 }], liquidityParameter: 1000, status: 'OPEN', totalVolume: 8000 },
  { id: 'pol-3', title: 'Will China invade Taiwan?', description: 'Military invasion of Taiwan by China', category: 'POLITICS', expiresAt: '2027-12-31', outcomes: [{ id: 'yes', name: 'Yes', quantity: 1000 }, { id: 'no', name: 'No', quantity: 1000 }], liquidityParameter: 1000, status: 'OPEN', totalVolume: 12000 },
  
  // Sports
  { id: 'spo-1', title: 'Will Chiefs win Super Bowl 2025?', description: 'Kansas City Chiefs win Super Bowl LX', category: 'SPORTS', expiresAt: '2026-02-09', outcomes: [{ id: 'yes', name: 'Yes', quantity: 1000 }, { id: 'no', name: 'No', quantity: 1000 }], liquidityParameter: 1000, status: 'OPEN', totalVolume: 15000 },
  { id: 'spo-2', title: 'Will Messi win World Cup 2026?', description: 'Argentina wins 2026 FIFA World Cup', category: 'SPORTS', expiresAt: '2026-07-19', outcomes: [{ id: 'yes', name: 'Yes', quantity: 1000 }, { id: 'no', name: 'No', quantity: 1000 }], liquidityParameter: 1000, status: 'OPEN', totalVolume: 25000 },
  { id: 'spo-3', title: 'Will Real Madrid win Champions League?', description: 'Real Madrid wins 2024-25 UEFA Champions League', category: 'SPORTS', expiresAt: '2025-05-31', outcomes: [{ id: 'yes', name: 'Yes', quantity: 1000 }, { id: 'no', name: 'No', quantity: 1000 }], liquidityParameter: 1000, status: 'OPEN', totalVolume: 10000 },
  
  // Crypto
  { id: 'cry-1', title: 'Will Bitcoin hit $150k by end of 2025?', description: 'Bitcoin reaches $150,000 USD on major exchange', category: 'CRYPTO', expiresAt: '2025-12-31', outcomes: [{ id: 'yes', name: 'Yes', quantity: 1000 }, { id: 'no', name: 'No', quantity: 1000 }], liquidityParameter: 1000, status: 'OPEN', totalVolume: 30000 },
  { id: 'cry-2', title: 'Will Ethereum reach $10k?', description: 'ETH reaches $10,000 USD', category: 'CRYPTO', expiresAt: '2026-12-31', outcomes: [{ id: 'yes', name: 'Yes', quantity: 1000 }, { id: 'no', name: 'No', quantity: 1000 }], liquidityParameter: 1000, status: 'OPEN', totalVolume: 18000 },
  { id: 'cry-3', title: 'Will Solana flip Ethereum?', description: 'Solana market cap exceeds Ethereum', category: 'CRYPTO', expiresAt: '2027-12-31', outcomes: [{ id: 'yes', name: 'Yes', quantity: 1000 }, { id: 'no', name: 'No', quantity: 1000 }], liquidityParameter: 1000, status: 'OPEN', totalVolume: 8000 },
  
  // Entertainment
  { id: 'ent-1', title: 'Will Taylor Swift retire?', description: 'Taylor Swift announces retirement from music', category: 'ENTERTAINMENT', expiresAt: '2026-12-31', outcomes: [{ id: 'yes', name: 'Yes', quantity: 1000 }, { id: 'no', name: 'No', quantity: 1000 }], liquidityParameter: 1000, status: 'OPEN', totalVolume: 12000 },
  { id: 'ent-2', title: 'Will GTA 6 release in 2025?', description: 'Grand Theft Auto VI officially launches', category: 'ENTERTAINMENT', expiresAt: '2025-12-31', outcomes: [{ id: 'yes', name: 'Yes', quantity: 1000 }, { id: 'no', name: 'No', quantity: 1000 }], liquidityParameter: 1000, status: 'OPEN', totalVolume: 20000 },
  { id: 'ent-3', title: 'Will TikTok be banned in US?', description: 'TikTok banned in United States', category: 'ENTERTAINMENT', expiresAt: '2025-04-30', outcomes: [{ id: 'yes', name: 'Yes', quantity: 1000 }, { id: 'no', name: 'No', quantity: 1000 }], liquidityParameter: 1000, status: 'OPEN', totalVolume: 15000 },
  
  // Science
  { id: 'sci-1', title: 'Will SpaceX land on Mars?', description: 'SpaceX successfully lands on Mars surface', category: 'SCIENCE', expiresAt: '2030-12-31', outcomes: [{ id: 'yes', name: 'Yes', quantity: 1000 }, { id: 'no', name: 'No', quantity: 1000 }], liquidityParameter: 1000, status: 'OPEN', totalVolume: 5000 },
  { id: 'sci-2', title: 'Will AI pass Turing test?', description: 'AI passes official Turing test', category: 'SCIENCE', expiresAt: '2027-12-31', outcomes: [{ id: 'yes', name: 'Yes', quantity: 1000 }, { id: 'no', name: 'No', quantity: 1000 }], liquidityParameter: 1000, status: 'OPEN', totalVolume: 10000 },
  { id: 'sci-3', title: 'Will fusion be commercially viable?', description: 'Fusion power plant goes online', category: 'SCIENCE', expiresAt: '2035-12-31', outcomes: [{ id: 'yes', name: 'Yes', quantity: 1000 }, { id: 'no', name: 'No', quantity: 1000 }], liquidityParameter: 1000, status: 'OPEN', totalVolume: 3000 },
];

async function seedMarkets() {
  console.log('🌱 Starting to seed markets...');
  
  const marketsRef = db.collection('markets');
  
  for (const market of MARKETS_DATA) {
    try {
      await marketsRef.doc(market.id).set({
        ...market,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      console.log(`✅ Created market: ${market.title}`);
    } catch (error) {
      console.error(`❌ Failed to create market ${market.id}:`, error);
    }
  }
  
  console.log('🎉 Market seeding complete!');
}

seedMarkets().catch(console.error);
