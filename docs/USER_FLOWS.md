# User Flows & UI Wireframes

## Table of Contents
1. [Example User Flows](#example-user-flows)
2. [UI Wireframe Descriptions](#ui-wireframe-descriptions)
3. [API Design Summary](#api-design-summary)

---

## Example User Flows

### Flow 1: New User Registration & First Trade

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NEW USER JOURNEY                                     │
└─────────────────────────────────────────────────────────────────────────────┘

1. APP LAUNCH
   │
   ├─── Show Safety Disclaimer Modal
   │   └─── "⚠️ Credits have no real-world value. Not gambling."
   │   └─── User clicks "I Understand"
   │
   ├─── Sign In / Sign Up Screen
   │   ├─── Option 1: Continue with Google
   │   ├─── Option 2: Continue with Apple
   │   └─── Option 3: Continue with Email
   │
   ├─── Create Account (if email)
   │   ├─── Enter email
   │   ├─── Create username
   │   └─── Accept Terms & Conditions
   │
   └─── Account Created Successfully!
       └─── Award: 1,000 STARTING CREDITS 🎉
       └─── Award: "First Steps" Achievement 🎖️
```

```
2. DASHBOARD (First View)
   ┌─────────────────────────────────────────────┐
   │  PredictSpinz                    👤 1,000 🔶 │
   ├─────────────────────────────────────────────┤
   │                                                 │
   │  📈 Trending Markets                          │
   │  ┌─────────────────────────────────────────┐  │
   │  │ Will Bitcoin exceed $100k by Dec 2024? │  │
   │  │ Yes 65%    No 35%           2.5K vol   │  │
   │  └─────────────────────────────────────────┘  │
   │  ┌─────────────────────────────────────────┐  │
   │  │ Will Trump win 2024 election?          │  │
   │  │ Yes 52%    No 48%           5.2K vol   │  │
   │  └─────────────────────────────────────────┘  │
   │                                                 │
   │  📊 Your Portfolio                    See All  │
   │  You haven't made any trades yet               │
   │                                                 │
   │  🏆 Leaderboard                      See All   │
   │  #1: CryptoKing    #2: PoliticalPundit       │
   │                                                 │
   └─────────────────────────────────────────────┘

   Tab Bar: 🏠 Markets  📊 Portfolio  🏆 Leaderboard  👤 Profile
```

```
3. PLACING A TRADE

   User taps on "Will Bitcoin exceed $100k..." market

   ┌─────────────────────────────────────────────┐
   │  ← Will Bitcoin exceed $100k by Dec 2024?  │
   │                                             │
   │  📊 Probability: 65% Yes / 35% No          │
   │  ⏱️ Expires: Dec 31, 2024                  │
   │  💰 Volume: 2,500 credits                  │
   │                                             │
   ├─────────────────────────────────────────────┤
   │  💳 Your Balance: 1,000 credits            │
   │                                             │
   │  Select Outcome:                            │
   │  ┌─────────────┐  ┌─────────────┐          │
   │  │   ✅ YES    │  │   ❌ NO     │          │
   │  │    65%      │  │    35%      │          │
   │  └─────────────┘  └─────────────┘          │
   │                                             │
   │  Quantity:                                  │
   │  ┌─────────────────────────────┐            │
   │  │         100                 │            │
   │  └─────────────────────────────┘            │
   │  Quick: 10 | 50 | 100 | 500                │
   │                                             │
   │  Cost: 65.00 credits                       │
   │  After trade: 935.00 credits               │
   │                                             │
   │  ┌─────────────────────────────────────┐    │
   │  │         BUY 100 SHARES              │    │
   │  └─────────────────────────────────────┘    │
   │                                             │
   │  ⚠️ Credits have no real-world value       │
   └─────────────────────────────────────────────┘

   User taps "BUY 100 SHARES"

   ┌─────────────────────────────────────────────┐
   │           ✅ Trade Successful!               │
   │                                             │
   │  You bought 100 shares of YES               │
   │  Cost: 65.00 credits                        │
   │  New Balance: 935.00 credits               │
   │                                             │
   │  Current Position:                          │
   │  100 shares @ 65% probability              │
   │  Value: 65.00 credits                      │
   │                                             │
   │         [ View Portfolio ]                  │
   └─────────────────────────────────────────────┘
```

---

### Flow 2: Daily Reward & Streak

```
DAILY LOGIN REWARD

1. User opens app
   │
   ├─── Check if lastActiveDate < today
   │
   ├─── IF new day:
   │   ├─── Increment streak
   │   ├─── Calculate reward: 50 + (streak * 10)
   │   ├─── Max bonus: 100 credits
   │   ├─── Add credits to balance
   │   └─── Show reward popup
   │
   └─── IF same day:
       └─── No reward (show "Come back tomorrow")

┌─────────────────────────────────────────────┐
│        🎁 Daily Reward Earned!               │
│                                             │
│         🔥 5 Day Streak!                     │
│                                             │
│       +100 credits                           │
│                                             │
│  Base: 50 + Streak Bonus: 50                │
│                                             │
│       [ Claim Reward ]                       │
└─────────────────────────────────────────────┘
```

---

### Flow 3: Market Resolution

```
MARKET RESOLUTION (Admin Flow)

1. Market reaches expiry date
   │
   ├─── Admin reviews market
   ├─── Admin determines outcome (from real-world event)
   │
   └─── Admin calls: POST /api/markets/:id/resolve
       └─── { outcomeId: "yes_outcome_id" }

2. Backend Processing:
   │
   ├─── Mark market as RESOLVED
   ├─── Mark winning outcome as winner
   ├─── For each holding with winning outcome:
   │   └─── credits += quantity (1 credit per share)
   ├─── For each holding with losing outcome:
   │   └─── value = 0
   └─── Update user stats (winningTrades, etc.)

3. User Notification (WebSocket):
   │
   └─── { type: "MARKET_RESOLVED", marketId: "...", winner: "Yes" }

4. User Views Portfolio:
   │
   └─── Market shows: "Resolved: YES" ✅
   └─── Winning position: "Winnings: +50 credits"
   └─── Losing position: "Lost: -35 credits" ❌
```

---

## UI Wireframe Descriptions

### Screen 1: Markets List (Home)

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo]  PredictSpinz           [🔔]  [👤]                 │
├─────────────────────────────────────────────────────────────┤
│  [🔍 Search markets...]                                     │
├─────────────────────────────────────────────────────────────┤
│  Categories: [All] [Politics] [Sports] [Crypto] [Ent.]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 🟢 Politics                          📅 Dec 31       │ │
│  │                                                       │ │
│  │  Will Trump win the 2024 Presidential Election?     │ │
│  │                                                       │ │
│  │  ┌────────────────┐      ┌────────────────┐         │ │
│  │  │      YES       │      |      NO       |         │ │
│  │  │      52%       │      |      48%      |         │ │
│  │  │    ████████    │      |    ████████   |         │ │
│  │  └────────────────┘      └────────────────┘         │ │
│  │                                                       │ │
│  │  💬 125 comments    📊 5.2K volume                  │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 🔵 Crypto                              📅 Nov 30     │ │
│  │                                                       │ │
│  │  Will Bitcoin reach $100k in 2024?                  │ │
│  │                                                       │ │
│  │  ┌────────────────┐      ┌────────────────┐         │ │
│  │  │      YES       │      |      NO       |         │ │
│  │  │      65%       │      |      35%      |         │ │
│  │  └────────────────┘      └────────────────┘         │ │
│  │                                                       │ │
│  │  💬 89 comments     📊 2.5K volume                   │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [🏠]    [📊]    [🏆]    [👤]                                │
│ Markets Portfolio Leaderboard Profile                      │
└─────────────────────────────────────────────────────────────┘
```

### Screen 2: Market Detail & Trading

```
┌─────────────────────────────────────────────────────────────┐
│  ←  Will Bitcoin reach $100k in 2024?                      │
├─────────────────────────────────────────────────────────────┤
│  📊 Current Probability                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  YES ██████████████████████████████████ 65%        │   │
│  │  NO  ████████████████████ 35%                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  📈 Price History (Last 7 Days)                            │
│  [Line chart showing YES price from 55% to 65%]            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  💳 Balance: 1,000 credits                                 │
│                                                             │
│  [ BUY ]  [ SELL ]                                         │
│                                                             │
│  Select Outcome:                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ⚪ YES                                    65%        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Quantity:                                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 100                                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Quick: 10 | 50 | 100 | 250 | Max                         │
│                                                             │
│  Cost: 65.00 credits                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              BUY 100 SHARES                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ⚠️ Credits have no real-world value. Not gambling.      │
├─────────────────────────────────────────────────────────────┤
│  💬 Comments (12)                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ @CryptoKing: "Bitcoin to the moon! 🚀"            │   │
│  │ @TraderJoe: "I think it's happening"              │   │
│  │ [View all comments...]                             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Screen 3: Portfolio

```
┌─────────────────────────────────────────────────────────────┐
│  📊 Your Portfolio                                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Total Value          Total Cost      P&L           │   │
│  │  165.00 credits      100.00         +65.00 (65%)  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Active Positions (2)                                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🟢 Will BTC reach $100k?                            │   │
│  │     YES - 100 shares @ 65%                         │   │
│  │     Value: 65.00    Cost: 50.00    P&L: +15.00    │   │
│  │     [SELL]                                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🟢 Will Trump win 2024?                             │   │
│  │     YES - 100 shares @ 52%                         │   │
│  │     Value: 52.00    Cost: 50.00    P&L: +2.00     │   │
│  │     [SELL]                                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Resolved Markets (1)                                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ⚫ Olympics 2024 Gold                              │   │
│  │     USA Wins - 50 shares @ 80%                    │   │
│  │     ✅ Won: +40.00 credits                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [🏠]    [📊]    [🏆]    [👤]                                │
└─────────────────────────────────────────────────────────────┘
```

### Screen 4: Leaderboard

```
┌─────────────────────────────────────────────────────────────┐
│  🏆 Leaderboard                                             │
├─────────────────────────────────────────────────────────────┤
│  [Credits] [ROI] [Daily] [Weekly] [All Time]              │
├─────────────────────────────────────────────────────────────┤
│  Top 3                                                     │
│  ┌─────┐  ┌─────┐  ┌─────┐                                │
│  │ 🥇 │  │ 🥈 │  │ 🥉 │                                │
│  │ 👤 │  │ 👤 │  │ 👤 │                                │
│  │ 52K│  │ 48K│  │ 45K│                                │
│  └─────┘  └─────┘  └─────┘                                │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  #4   👤  PoliticalPundit       42,500 credits      │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  #5   👤  SportsBettor         38,200 credits       │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  #6   👤  Entertainer          35,000 credits       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ─── Your Rank ───                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  #47  👤  You                 1,000 credits        │   │
│  │       🔼 Up 3 from yesterday                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [🏠]    [📊]    [🏆]    [👤]                                │
└─────────────────────────────────────────────────────────────┘
```

### Screen 5: Profile & Settings

```
┌─────────────────────────────────────────────────────────────┐
│  👤 Profile                                    [⚙️]        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│         [Avatar]                                            │
│     Display Name                                            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  💰 Credits: 1,000                         [ + Buy ]       │
├─────────────────────────────────────────────────────────────┤
│  📊 Statistics                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Total Trades         15                            │   │
│  │  Win Rate             73%                            │   │
│  │  Best Trade           +500 credits                  │   │
│  │  Current Streak       🔥 5 days                     │   │
│  │  Longest Streak       🔥 12 days                     │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  🎖️ Achievements (8/15)                   [View All]       │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                      │
│  │ 🎖️│ │ 🎖️│ │ 🎖️│ │ 🎖️│ │ 🔒│                      │
│  │First│ │10 trades│ │Streak5│ │Win3  │ │    │                      │
│  └────┘ └────┘ └────┘ └────┘ └────┘                      │
├─────────────────────────────────────────────────────────────┤
│  📜 Transaction History                     [View All]      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ +1,000  Starting Bonus              Today         │   │
│  │ -65     Buy BTC YES                 Yesterday      │   │
│  │ +100    Daily Reward (Day 5)        Yesterday      │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  ⚙️ Settings                                               │
│  ├── Notifications                                         │
│  ├── Privacy                                               │
│  ├── Help & Support                                        │
│  └── Sign Out                                              │
├─────────────────────────────────────────────────────────────┤
│  ⚠️ Credits have no real-world value. Not gambling.       │
└─────────────────────────────────────────────────────────────┘
```

---

## API Design Summary

### REST Endpoints

#### Markets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/markets` | List markets with filters |
| GET | `/api/markets/:id` | Get market details |
| POST | `/api/markets` | Create market (admin) |
| POST | `/api/markets/:id/resolve` | Resolve market (admin) |
| GET | `/api/markets/meta/trending` | Get trending markets |
| GET | `/api/markets/meta/categories` | Get categories |

#### Trading
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/trades` | Execute trade (buy/sell) |
| GET | `/api/trades` | Get trade history |
| GET | `/api/trades/portfolio` | Get user holdings |

#### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me` | Get current user |
| PUT | `/api/users/me` | Update profile |
| GET | `/api/users/me/transactions` | Get transaction history |
| GET | `/api/users/me/stats` | Get user statistics |
| POST | `/api/users/me/daily-reward` | Claim daily reward |
| POST | `/api/users/me/buy-credits` | Purchase credits |
| GET | `/api/users/credit-packs` | Get credit pack options |

#### Leaderboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leaderboard` | Get global leaderboard |
| GET | `/api/leaderboard/me` | Get user rank |
| GET | `/api/leaderboard/achievements` | Get all achievements |
| GET | `/api/leaderboard/achievements/me` | Get user achievements |

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `priceUpdate` | Server → Client | Market price changed |
| `tradeExecuted` | Server → Client | New trade on market |
| `marketResolved` | Server → Client | Market resolved |
| `achievementUnlocked` | Server → Client | User earned achievement |
| `dailyRewardReady` | Server → Client | Daily reward available |

---

## Database Schema Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE SCHEMA                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Users ─────────┬──> Transactions                               │
│     │           │     │                                          │
│     │           │     └── (credit history)                     │
│     │           │                                                │
│     ├──> Holdings ──> Markets                                   │
│     │     │         (user's shares in outcomes)                │
│     │     │                                                    │
│     │     └──> Outcomes                                         │
│     │                                                        │
│     ├──> Trades ──> Markets                                     │
│     │                                                        │
│     ├──> Achievements <── UserAchievements                      │
│     │                                                        │
│     └──> Follows                                               │
│              (social)                                          │
│                                                                 │
│  Markets ──────> Outcomes ──> Trades                            │
│     │                                                        │
│     └──> Comments                                              │
│                                                                 │
│  CreditPacks (monetization)                                     │
│                                                                 │
│  LeaderboardSnapshots (cached rankings)                         │
│                                                                 │
│  AuditLogs (admin actions)                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
