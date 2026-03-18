# PredictSpinz - Virtual Credit Prediction Market

## System Architecture

### Overview
PredictSpinz is a virtual credit prediction market application that allows users to trade on the outcome of real-world events using in-app credits. The system uses an Automated Market Maker (AMM) based on the Logarithmic Market Scoring Rule (LMSR) for price discovery.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │  Dashboard  │  │ Market Page │  │  Portfolio  │  │ Leaderboard    │   │
│  │    View     │  │    View     │  │    View     │  │     View       │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └───────┬────────┘   │
└─────────┼────────────────┼────────────────┼─────────────────┼─────────────┘
          │                │                │                 │
          ▼                ▼                ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY (Express/NestJS)                       │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  REST Endpoints + WebSocket for Real-time Updates                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BUSINESS LOGIC LAYER                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │   Market    │  │    Trade    │  │   Credit    │  │   Leaderboard   │   │
│  │   Service   │  │   Service   │  │   Service   │  │    Service      │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └───────┬────────┘   │
│         │                │                │                 │             │
│         ▼                ▼                ▼                 ▼             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              LMSR Pricing Engine (AMM)                              │   │
│  │  price_i = exp(q_i / b) / Σexp(q_j / b)                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATA LAYER                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │  PostgreSQL │  │    Redis    │  │  Firebase   │  │   External      │   │
│  │  (Primary)  │  │  (Cache)    │  │  (Auth)     │  │   APIs          │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### 1. API Gateway
- Handle HTTP requests (REST)
- WebSocket connections for real-time price updates
- Rate limiting and authentication
- Request validation

#### 2. Market Service
- CRUD operations for markets
- Market categorization (politics, sports, crypto, entertainment)
- Market resolution logic
- Price calculation coordination

#### 3. Trade Service
- Execute buy/sell orders
- Validate user balance
- Update holdings
- Record transaction history

#### 4. Credit Service
- Manage user credit balances
- Process daily/weekly rewards
- Handle credit purchases (non-withdrawable)
- Track transaction history

#### 5. Leaderboard Service
- Calculate rankings by credits and ROI
- Track user achievements
- Manage streaks and badges

#### 6. LMSR Pricing Engine
- Maintain liquidity parameter (b)
- Calculate outcome prices dynamically
- Handle buy/sell cost calculations

---

## Technology Stack

### Frontend
- **Framework**: React / Next.js
- **State Management**: Zustand / React Query
- **Real-time**: WebSocket client
- **Styling**: Tailwind CSS
- **Charts**: Recharts / TradingView

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js or NestJS
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis
- **Authentication**: Firebase Auth
- **Real-time**: Socket.io

### Infrastructure
- **Hosting**: Vercel (frontend) / Railway/Render (backend)
- **Database**: Neon / Supabase (PostgreSQL)
- **Cache**: Upstash (Redis)

---

## Data Flow

### Placing a Trade
```
1. User selects outcome and enters amount
2. Frontend validates input and checks balance
3. API receives trade request
4. Trade Service validates:
   - User has sufficient credits
   - Market is active
   - Market hasn't expired
5. LMSR Engine calculates cost:
   - cost = b * ln(Σexp(q_i/b)) - b * ln(Σexp((q_i + delta)/b))
6. Deduct credits from user balance
7. Update holdings (add shares)
8. Update market quantities (q_i)
9. Record trade in history
10. Emit WebSocket event for price update
11. Return updated portfolio to user
```

### Market Resolution
```
1. Admin/oracle submits resolution
2. Validate resolution authority
3. Mark market as resolved
4. Calculate winnings:
   - winning_shares * 1 credit per share
5. Credit winnings to winning holders
6. Update user performance stats
7. Update leaderboard
8. Emit resolution event
```

---

## Security & Compliance

### Safety Measures
1. **Disclaimer Banner**: "This is not gambling. Credits have no real-world value."
2. **No Withdrawal**: Credits cannot be converted to real money
3. **Purchase Limits**: Optional daily/weekly credit purchase caps
4. **Bot Detection**: Rate limiting and CAPTCHA on sensitive endpoints
5. **Age Verification**: Minimum age requirement (13+)
6. **Session Management**: JWT tokens with short expiry

### Anti-Abuse
- Rate limiting: 100 requests/minute per IP
- Trade size limits per market
- Daily trade limits
- Suspicious activity monitoring

---

## Monetization Strategy

### Credit Packs (Primary)
- Starter Pack: 1,000 credits - $0.99
- Pro Pack: 5,000 credits - $4.99
- VIP Pack: 25,000 credits - $19.99
- Whale Pack: 100,000 credits - $49.99

### Premium Subscription
- Analytics Pro: $9.99/month
  - Advanced portfolio analytics
  - Historical performance charts
  - Early access to new markets
  - Custom alerts

### Ads (Optional)
- Banner ads on dashboard
- Interstitial ads between trades

---

## Scalability Considerations

1. **Database Indexing**: Index on user_id, market_id, created_at
2. **Caching**: Cache market prices in Redis (TTL: 5 seconds)
3. **WebSocket Rooms**: Subscribe users to specific market rooms only
4. **Batch Processing**: Aggregate price updates every 100ms
5. **Read Replicas**: Separate read/write database connections
