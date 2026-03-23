# Predich

A Polymarket-inspired virtual credit prediction market app. Trade on real-world events with virtual credits — no real money, no risk.

**Live on TestFlight** — App Store Connect ID: `6760973639`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Mobile** | React Native + Expo (SDK 52) + Expo Router |
| **Backend** | Firebase Cloud Functions (Node.js 20) |
| **Database** | Cloud Firestore |
| **Auth** | JWT (email/password) with bcrypt |
| **Admin** | Next.js 14 + Tailwind CSS |
| **Hosting** | Firebase Hosting + Cloud Functions |

**API URL:** `https://us-central1-prediction-app-2026.cloudfunctions.net/api`
**Firebase Project:** `prediction-app-2026`

## Features

### Core Trading
- **140+ Prediction Markets** across 8 categories (Politics, Sports, Crypto, Entertainment, Science, Technology, Business)
- **LMSR Automated Market Making** — buy and sell shares with instant pricing
- **Portfolio Tracking** with P&L, cost basis, and win/loss history
- **1000 Starting Credits** on sign-up

### Social & Competitive
- **Tournaments** — join daily/weekly/monthly competitions, P&L-based leaderboards, prize payouts
- **Friend Challenges** — head-to-head wagers on any market, auto-resolution on market settlement
- **Leaderboard** — global rankings by credits or ROI, follow top traders directly
- **User Search** — find and follow users by name from Friends tab
- **Referral System** — earn 200 credits per invited friend

### Market Proposals
- **Community Proposals** — users submit market ideas, community upvotes
- **Admin Approval** — proposals become live markets, proposers earn 50 credits
- **Auto-Sync** — scrapes trending markets from Polymarket and Manifold Markets

### Design
- **Light + Dark Mode** — instant toggle, reactive theme system
- **Design Tokens** — consistent spacing (Spacing), radius (Radius), typography (FontSize)
- **Custom Toast/Confirm** — branded pop-ups instead of native alerts
- **WCAG AA Accessible** — contrast ratios meet accessibility standards
- **Ionicons** throughout — no emoji decorations in UI

## Project Structure

```
Predich/
├── mobile/                    # React Native (Expo) mobile app
│   ├── src/
│   │   ├── app/              # Screens (Expo Router file-based routing)
│   │   │   ├── (tabs)/       # Tab screens (markets, portfolio, leaderboard, profile)
│   │   │   ├── market/[id]   # Market detail + trading
│   │   │   └── auth.tsx      # Sign in / sign up
│   │   └── lib/
│   │       ├── colors.ts     # Theme system (light/dark, design tokens)
│   │       ├── api-client.ts # API client with retry logic
│   │       ├── auth.ts       # JWT auth with SecureStore
│   │       └── components/   # Toast, TrendingMarkets, Comments
│   ├── app.json              # Expo config
│   └── eas.json              # EAS build + submit config
│
├── functions/                 # Firebase Cloud Functions (production backend)
│   └── src/
│       └── index.ts          # All API routes (auth, markets, trades, users, leaderboard)
│
├── backend/                   # Express.js API server (local development)
│   ├── prisma/
│   │   └── schema.prisma     # Database schema (20+ models)
│   └── src/
│       ├── routes/           # All route handlers
│       ├── middleware/auth.ts # JWT + Firebase token verification
│       ├── lib/lmsr.ts       # LMSR pricing engine
│       └── scripts/
│           ├── seed-prisma.ts # Seed 140 markets
│           └── sync-markets.ts # Scrape Polymarket + Manifold
│
├── frontend/                  # Admin dashboard (Next.js)
│   └── src/app/admin/
│       ├── page.tsx           # Dashboard with stats
│       ├── markets/           # Market management
│       ├── users/             # User management
│       └── proposals/         # Proposal approval queue
│
├── firebase.json              # Firebase config (functions + hosting + firestore)
└── .firebaserc                # Firebase project: prediction-app-2026
```

## Getting Started

### Prerequisites

- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- Expo CLI
- EAS CLI (`npm install -g eas-cli`)

### 1. Install Dependencies

```bash
cd functions && npm install
cd ../mobile && npm install
cd ../backend && npm install    # for local dev
cd ../frontend && npm install   # for admin dashboard
```

### 2. Environment Variables

#### Mobile (`mobile/.env`)
```env
EXPO_PUBLIC_API_URL=https://us-central1-prediction-app-2026.cloudfunctions.net/api
```

#### Backend — Local Dev (`backend/.env`)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/predich
JWT_SECRET=your-secret-key
```

#### Admin (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=https://us-central1-prediction-app-2026.cloudfunctions.net/api
```

### 3. Run Locally

```bash
# Backend (local Express + PostgreSQL)
cd backend && npm run dev

# Mobile (Expo)
cd mobile && npx expo start --ios

# Admin Dashboard
cd frontend && npm run dev
```

### 4. Deploy Cloud Functions

```bash
cd functions && npm run build
firebase deploy --only functions --project prediction-app-2026
```

### 5. Seed Markets (local PostgreSQL)

```bash
cd backend
npx prisma migrate dev
npx ts-node src/scripts/seed-prisma.ts
```

## API Endpoints

**Base URL:** `https://us-central1-prediction-app-2026.cloudfunctions.net/api`

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create account (email, password, displayName) |
| POST | `/auth/login` | Sign in, get JWT token |

### Markets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/markets` | List markets (filterable by category) |
| GET | `/markets/:id` | Market detail with LMSR prices |
| GET | `/trades/markets` | Alias for `/markets` (mobile compat) |
| GET | `/trades/markets/:id` | Alias for `/markets/:id` |

### Trading
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/trades/preview-by-cost` | - | Preview shares for credit amount |
| POST | `/trades/trade` | JWT | Buy shares (LMSR pricing, Firestore transaction) |
| GET | `/trades/portfolio/:userId` | - | User portfolio with P&L |

### Users
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/me` | JWT | Current user profile + stats |
| GET | `/users/me/transactions` | JWT | Transaction history |
| POST | `/users/me/daily-reward` | JWT | Claim daily reward (streak bonus) |
| GET | `/users/search?q=name` | - | Search users by display name |

### Leaderboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/leaderboard` | Top 50 users by credits |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | API health check |

## Market Auto-Sync

Scrapes trending markets from external prediction platforms and creates proposals for admin review.

```bash
# One-shot sync
cd backend && npx ts-node src/scripts/sync-markets.ts

# Loop mode (every 30 minutes)
npx ts-node src/scripts/sync-markets.ts --loop 30
```

**Sources:**
- **Polymarket** (gamma-api.polymarket.com) — top 30 by 24h volume
- **Manifold Markets** (api.manifold.markets) — top 20 trending

## LMSR Pricing

Logarithmic Market Scoring Rule for automated market making:

- **Cost:** `cost = b * ln(sum(exp(q_i / b)))`
- **Price:** `price_i = exp(q_i / b) / sum(exp(q_j / b))`
- **Liquidity parameter** `b = 1000` (default)

Prices range 0-100 cents. Higher price = market thinks outcome is more likely.

## Markets

140+ pre-seeded markets across 8 categories:

| Category | Count | Examples |
|----------|-------|---------|
| Politics | 20 | US 2026 Midterms, Ukraine ceasefire, 2028 Republican frontrunner |
| Sports | 20 | 2026 World Cup, NBA Championship, F1, Tour de France |
| Crypto | 20 | BTC $150k, ETH $10k, DeFi TVL, memecoin market cap |
| Entertainment | 20 | GTA 6 sales, Oscars, TikTok ban, Nintendo Switch 2 |
| Science | 20 | SpaceX Starship, Neuralink FDA, mRNA cancer vaccine |
| Technology | 20 | GPT-5, Apple AR glasses, robotaxis, AI regulation |
| Business | 20 | S&P 7000, Fed rates, SpaceX IPO, Nvidia stock |
| Other | varies | Auto-synced from Polymarket and Manifold |

## Build & Deploy

### iOS (TestFlight)

```bash
cd mobile

# 1. Set up credentials (first time only)
eas credentials --platform ios

# 2. Build locally
eas build --platform ios --profile production --local

# 3. Submit to TestFlight
EXPO_APPLE_ID="cappsino@gmail.com" \
EXPO_APPLE_APP_SPECIFIC_PASSWORD="wfji-zass-lfqz-ijyj" \
eas submit --platform ios --profile production --path ./build-*.ipa --non-interactive
```

### Firebase Cloud Functions

```bash
cd functions
npm run build
firebase deploy --only functions --project prediction-app-2026

# Make function public (first time only)
gcloud functions add-invoker-policy-binding api \
  --project=prediction-app-2026 \
  --region=us-central1 \
  --member=allUsers
```

## App Store Info

| Field | Value |
|-------|-------|
| **App Name** | Predich |
| **Bundle ID** | com.predich.app |
| **ASC App ID** | 6760973639 |
| **Apple Team** | W39ZC35R76 (Tomaya LTD) |
| **EAS Project** | @tomaya/predictspinz |
| **Firebase Project** | prediction-app-2026 |

## License

MIT
