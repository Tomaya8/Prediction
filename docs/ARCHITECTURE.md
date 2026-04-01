# Predich — System Architecture

## Overview

Predich is a virtual credit prediction market and tournament app. Users trade on real-world event outcomes using in-app credits (LMSR-based markets) and compete in numeric prediction tournaments where the closest guess wins multiplied payouts.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Markets     │  │  Trading     │  │  Tournaments │  │  Profile     │   │
│  │  (Browse)    │  │  (Buy/Sell)  │  │  (Predict)   │  │  (Stats)     │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         └──────────────────┴─────────────────┴─────────────────┘           │
│                     React Native (Expo SDK 52)                              │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Firebase Cloud Functions (Node.js 22)                    │
│  ┌─────────┐ ┌─────────┐ ┌────────────┐ ┌──────────────┐ ┌────────────┐  │
│  │  Auth   │ │ Markets │ │  Trading   │ │ Tournaments  │ │   Admin    │  │
│  │  (JWT)  │ │ (CRUD)  │ │  (LMSR)   │ │  V2 (Numeric)│ │  (Manage)  │  │
│  └─────────┘ └─────────┘ └────────────┘ └──────────────┘ └────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │              Scheduled Functions                                      │  │
│  │  dailyMarketSync | autoResolveMarkets | tournamentScheduler          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATA LAYER                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Firestore   │  │  Firebase    │  │  CoinGecko   │  │  ExchangeRate│   │
│  │  (Primary)   │  │  Auth (Admin)│  │  (Crypto)    │  │  API (Forex) │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack (Actual)

### Mobile App
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React Native | 0.76.6 |
| Build Tool | Expo | 52.0.0 |
| Router | Expo Router | 4.0.0 |
| State Management | Zustand | 5.0.0 |
| Auth | Custom JWT + SecureStore | — |
| IAP | RevenueCat (react-native-purchases) | — |
| Notifications | expo-notifications | — |
| Language | TypeScript | 5.3.0 |

### Backend (Production)
| Layer | Technology | Version |
|-------|-----------|---------|
| Compute | Firebase Cloud Functions | Node.js 22 |
| Database | Cloud Firestore | — |
| Auth | JWT + bcrypt | jsonwebtoken 9.0.0 |
| Validation | Zod | 4.x |
| Rate Limiting | Firestore-backed (per IP) | — |

### Admin Dashboard
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 |
| Styling | Tailwind CSS |
| Hosting | Firebase Hosting (predich-admin.web.app) |

### External APIs
| Service | Purpose |
|---------|---------|
| CoinGecko | Crypto prices (BTC, ETH, SOL) — free |
| ExchangeRate API | Forex rates (EUR/USD, etc.) — free |
| Polymarket API | Market scraping for proposals |
| Manifold Markets API | Market scraping for proposals |
| Expo Push API | Push notifications — free |

---

## Firestore Collections

| Collection | Purpose |
|-----------|---------|
| `users` | Profiles, balances, stats, auth, push tokens |
| `markets` | LMSR prediction markets with outcomes |
| `holdings` | User share positions per market |
| `trades` | Trade history (buy/sell) |
| `transactions` | Full credit ledger |
| `price_history` | Market price snapshots (time-series) |
| `comments` | Market discussion threads |
| `follows` | Social follow relationships |
| `proposals` | User/bot-submitted market proposals |
| `tournament_v2` | Numeric prediction tournaments |
| `tournament_entries` | User predictions per tournament |
| `tournament_templates` | Auto-creation templates |
| `rate_limits` | Firestore-backed rate limiting |
| `user_achievements` | Earned achievement records |

---

## Cloud Functions

### API (`api`)
Single HTTP function handling all REST endpoints. Routes:
- `/auth/*` — Register, login, Firebase token exchange
- `/markets/*` — List, detail, trending, price history, comments
- `/trades/*` — Preview, execute, sell, portfolio
- `/users/*` — Profile, transactions, daily reward, ad reward, achievements, search, credit packs, account deletion
- `/leaderboard` — Global rankings
- `/social/*` — Friends, follow/unfollow, referrals, challenges
- `/proposals/*` — Submit, list, vote
- `/tournaments` — Legacy tournament list
- `/tournaments-v2/*` — Numeric prediction tournaments (list, detail, enter, edit, tracker, results)
- `/admin/*` — Tournament templates, manual resolve/cancel, user management, market sync

### Scheduled Functions
| Function | Schedule | Purpose |
|----------|----------|---------|
| `dailyMarketSync` | Daily 6 AM UTC | Scrapes Polymarket + Manifold for new market proposals |
| `autoResolveMarkets` | Every 6 hours | Flags/cancels expired LMSR markets, refunds holders |
| `tournamentScheduler` | Every 15 minutes | Auto-creates tournaments from templates, updates live prices, transitions statuses, auto-resolves expired tournaments, sends push notifications |

### Triggers
| Function | Trigger | Purpose |
|----------|---------|---------|
| `processReferral` | Firestore `users/{userId}` onCreate | Grants 500 credits to both referrer and new user |

---

## Two Market Systems

### 1. LMSR Prediction Markets (Original)
- Binary/multi-outcome markets: "Will X happen?"
- AMM pricing: `price_i = exp(q_i / b) / Σexp(q_j / b)`
- Users buy/sell shares, prices move dynamically
- Admin-resolved or auto-cancelled after expiry

### 2. Numeric Prediction Tournaments (V2)
- Users predict a specific number: "What will BTC price be on April 8?"
- Entry fee → prize pool (house takes 15-20% rake)
- Closest guess wins, ranked by `|prediction - actual|`
- Multiplied payouts: up to 10x for Rapid, 5x Weekly, 2x Monthly
- Auto-resolved via external APIs (CoinGecko, ExchangeRate)

### Tournament Lifecycle
```
REGISTRATION (open for entries)
  │ Users submit numeric predictions + pay entry fee
  │ Can edit prediction during this phase
  ▼
LOCKED (no new entries, no edits)
  │ Live tracker shows estimated rank
  │ Scheduler updates live prices every 15 min
  ▼
RESOLVED (auto or manual)
  │ Actual value fetched from API
  │ Rankings calculated by distance
  │ Prizes distributed to top players
  │ Push notifications sent
  ▼
Next tournament auto-created from same template
```

### Tournament Types
| Type | Duration | Registration | Entry Fee | Max Multiplier | Rake |
|------|----------|-------------|-----------|----------------|------|
| Monthly | 30 days | First 7 days | 50 credits | 2x | 15% |
| Weekly | 7 days | First 2 days | 75-100 credits | 5x | 15% |
| Rapid | 2 hours | First 30 min | 25 credits | 10x | 20% |

---

## Security

- **CORS**: Locked to specific origins (admin domain, app hosting, localhost)
- **Rate Limiting**: Firestore-backed, survives function instance restarts. Auth: 10/min, General: 100/min
- **Input Validation**: Zod schemas on all mutation endpoints
- **Auth**: JWT with 30-day expiry, bcrypt password hashing
- **Account Deletion**: Full data wipe across all collections (App Store compliant)
- **Firestore Rules**: Client access denied on sensitive collections (rate_limits)

---

## Monetization

| Revenue Stream | Status | Details |
|---------------|--------|---------|
| Tournament rake | Live | 15-20% of entry fees retained |
| Credit packs (IAP) | Configured | RevenueCat SDK integrated, products in dashboard |
| Premium subscription | Configured | "Predich Pro" entitlement, monthly/yearly/lifetime |
| Rewarded video ads | Stubbed | AdMob SDK removed pending app IDs |
| Daily rewards | Live | 25 + streak bonus (max 75/day, 2x for Pro) |

### Credit Economy
| Source | Credits/day (free user) |
|--------|------------------------|
| Daily reward | 25-75 |
| Referral bonus | 500 (one-time) |
| Starting bonus | 1,000 (one-time) |

| Sink | Credits |
|------|---------|
| Market trades | Variable (LMSR pricing) |
| Tournament entries | 25-100 per tournament |
| Market proposals | 50 per proposal (free for Pro) |

---

## Deployment

| Component | Hosting | URL |
|-----------|---------|-----|
| Mobile App | Expo / TestFlight | — |
| API | Firebase Cloud Functions | us-central1-prediction-app-2026.cloudfunctions.net/api |
| Admin Dashboard | Firebase Hosting | predich-admin.web.app |
| Database | Cloud Firestore | prediction-app-2026 |

---

## Mobile App Screens (13)

| Screen | Tab | Description |
|--------|-----|-------------|
| Markets | Bottom tab | Browse, search, filter by category, tournament banner |
| Portfolio | Bottom tab | Active/resolved holdings, P&L |
| Rankings | Bottom tab | Global leaderboard, follow users |
| Profile | Bottom tab | Stats, streaks, store link |
| Market Detail | Stack | Price chart, buy/sell, comments |
| Tournaments | Hamburger | V2 tournament list (Rapid/Weekly/Monthly) + entry/tracker/results modals |
| Friends | Hamburger | Friends list, challenges, referral code |
| Transactions | Hamburger | Credit history |
| Achievements | Hamburger | Badges |
| Create Market | Hamburger | Propose new markets (50 credit fee) |
| Credit Store | Hamburger | IAP packs, RevenueCat paywall, ad rewards |
| Settings | Hamburger | Dark mode (reactive), notifications, account deletion |
| Auth | Stack | Sign in / sign up with referral code |
