# Predich

A Polymarket-inspired virtual credit prediction market app. Trade on real-world events with virtual credits — no real money, no risk.

## Features

### Core Trading
- **140+ Prediction Markets** across 8 categories (Politics, Sports, Crypto, Entertainment, Science, Technology, Business)
- **LMSR Automated Market Making** — buy and sell shares with instant pricing
- **Real-time Price Updates** via WebSocket
- **Portfolio Tracking** with P&L, cost basis, and win/loss history

### Social & Competitive
- **Tournaments** — join daily/weekly/monthly competitions, P&L-based leaderboards, prize payouts
- **Friend Challenges** — head-to-head wagers on any market, auto-resolution on market settlement
- **Leaderboard** — global rankings by credits or ROI, follow top traders
- **User Search** — find and follow users by name
- **Referral System** — earn 200 credits per invited friend

### Market Proposals
- **Community Proposals** — users submit market ideas, community upvotes
- **Admin Approval** — proposals become live markets, proposers earn 50 credits
- **Auto-Sync** — scrapes trending markets from Polymarket and Manifold Markets

### Design
- **Light + Dark Mode** — instant toggle, reactive theme system
- **Design Tokens** — consistent spacing, radius, typography scale
- **Custom Toast/Confirm** — branded pop-ups instead of native alerts
- **WCAG AA Accessible** — contrast ratios meet accessibility standards

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Mobile** | React Native + Expo (SDK 52) + Expo Router |
| **Backend** | Node.js + Express + TypeScript |
| **Database** | PostgreSQL + Prisma ORM |
| **Auth** | JWT (email/password) with bcrypt |
| **Admin** | Next.js 14 + Tailwind CSS |
| **Real-time** | WebSocket (ws) + Socket.IO |

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
│   │       └── components/   # Reusable components (Toast, TrendingMarkets, Comments)
│   └── app.json              # Expo config
│
├── backend/                   # Express.js API server
│   ├── prisma/
│   │   └── schema.prisma     # Database schema (20+ models)
│   └── src/
│       ├── routes/
│       │   ├── auth.ts       # Register, login (rate-limited)
│       │   ├── markets.ts    # CRUD, resolve, cancel, comments
│       │   ├── trades.ts     # Buy, sell, portfolio, LMSR pricing
│       │   ├── users.ts      # Profile, search, daily rewards, achievements
│       │   ├── tournaments.ts # Join, resolve, leaderboard, tick
│       │   ├── social.ts     # Follow, challenges, referrals, timeouts
│       │   ├── proposals.ts  # Submit, vote, approve/reject
│       │   ├── leaderboard.ts # Rankings, achievements
│       │   └── admin.ts      # Stats, user management, market sync
│       ├── middleware/auth.ts # JWT + Firebase token verification
│       ├── lib/lmsr.ts       # LMSR pricing engine
│       └── scripts/
│           ├── seed-prisma.ts # Seed 140 markets
│           └── sync-markets.ts # Scrape Polymarket + Manifold
│
└── frontend/                  # Admin dashboard (Next.js)
    └── src/app/admin/
        ├── page.tsx           # Dashboard with stats + charts
        ├── markets/           # Market management
        ├── users/             # User management
        └── proposals/         # Proposal approval queue
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn

### 1. Install Dependencies

```bash
cd backend && npm install
cd ../mobile && npm install
cd ../frontend && npm install
```

### 2. Environment Variables

#### Backend (`backend/.env`)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/predictspinz
JWT_SECRET=your-secure-random-secret-key
FRONTEND_URL=http://localhost:3000
# Optional: Firebase (for Firebase token auth)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="your_private_key"
```

#### Mobile (`mobile/.env`)
```env
EXPO_PUBLIC_API_URL=http://localhost:3001/api
```

#### Admin (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### 3. Database Setup

```bash
cd backend
npx prisma migrate dev    # Create tables
npx ts-node src/scripts/seed-prisma.ts  # Seed 140 markets
```

### 4. Run

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Mobile
cd mobile && npx expo start --ios

# Terminal 3: Admin (optional)
cd frontend && npm run dev
```

## API Endpoints

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | - | Create account (rate-limited: 10/15min) |
| POST | `/api/auth/login` | - | Sign in, get JWT |

### Markets
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/markets` | - | List markets (filterable by category, status) |
| GET | `/api/markets/:id` | - | Market detail with outcomes, comments |
| GET | `/api/markets/meta/categories` | - | Available categories |
| GET | `/api/markets/meta/trending` | - | Top 10 by volume |
| POST | `/api/markets` | Admin | Create market |
| POST | `/api/markets/:id/resolve` | Admin | Resolve with winning outcome |
| POST | `/api/markets/:id/cancel` | Admin | Cancel and refund holders |

### Trading
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/trades/trade` | User | Buy shares (LMSR pricing) |
| POST | `/api/trades/sell` | User | Sell shares |
| POST | `/api/trades/preview` | - | Preview cost before buying |
| POST | `/api/trades/preview-by-cost` | - | Calculate shares for credit amount |
| GET | `/api/trades/portfolio/:userId` | - | User portfolio with P&L |

### Users
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users/me` | User | Current user profile |
| GET | `/api/users/search?q=name` | - | Search users by display name |
| GET | `/api/users/me/transactions` | User | Transaction history |
| GET | `/api/users/me/stats` | User | Detailed statistics |
| POST | `/api/users/me/daily-reward` | User | Claim daily reward (streak bonus) |

### Social
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/social/friends` | User | List followed users |
| POST | `/api/social/follow/:userId` | User | Follow a user |
| DELETE | `/api/social/follow/:userId` | User | Unfollow |
| GET | `/api/social/challenges` | User | List challenges |
| POST | `/api/social/challenges` | User | Create challenge (escrow credits) |
| PUT | `/api/social/challenges/:id/accept` | User | Accept with outcome pick |
| PUT | `/api/social/challenges/:id/decline` | User | Decline (refund challenger) |
| GET | `/api/social/referral` | User | Referral code + stats |

### Tournaments
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/tournaments` | - | List tournaments |
| POST | `/api/tournaments/:id/join` | User | Join (deducts entry fee) |
| GET | `/api/tournaments/:id/leaderboard` | - | Ranked participants by P&L |
| POST | `/api/tournaments/:id/resolve` | Admin | Distribute prizes |
| POST | `/api/tournaments/tick` | - | Auto-transition statuses |

### Proposals
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/proposals` | User | Submit market proposal |
| GET | `/api/proposals` | - | Browse proposals (sort by votes/newest) |
| GET | `/api/proposals/mine` | User | My proposals + status |
| POST | `/api/proposals/:id/vote` | User | Upvote a proposal |
| POST | `/api/proposals/:id/approve` | Admin | Approve → creates market + 50 credits |
| POST | `/api/proposals/:id/reject` | Admin | Reject with reason |

### Admin
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/stats` | Admin | Dashboard statistics |
| GET | `/api/admin/users` | Admin | List/search users |
| POST | `/api/admin/users/:id/credits` | Admin | Adjust credits |
| POST | `/api/admin/users/:id/ban` | Admin | Ban/unban user |
| POST | `/api/admin/sync-markets` | Admin | Scrape Polymarket + Manifold |

## Market Auto-Sync

Scrapes trending markets from external prediction platforms and creates proposals for admin review.

```bash
# One-shot sync
cd backend && npx ts-node src/scripts/sync-markets.ts

# Loop mode (every 30 minutes)
npx ts-node src/scripts/sync-markets.ts --loop 30

# Or trigger via admin API
POST /api/admin/sync-markets
```

**Sources:**
- Polymarket (gamma-api.polymarket.com) — top 30 by 24h volume
- Manifold Markets (api.manifold.markets) — top 20 trending

## LMSR Pricing

The app uses Logarithmic Market Scoring Rule for automated market making:

- **Cost**: `cost = b * ln(sum(exp(q_i / b)))`
- **Price**: `price_i = exp(q_i / b) / sum(exp(q_j / b))`
- **Liquidity parameter** `b = 1000` (default)

Prices range from 0-100 cents. Higher price = market thinks outcome is more likely.

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

## License

MIT
