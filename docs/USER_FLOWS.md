# User Flows

## 1. New User Registration

```
App Launch
│
├── Auth Screen
│   ├── Enter email, password, username
│   ├── Optional: enter friend's referral code
│   └── Tap "Sign Up"
│
├── Account Created
│   ├── +1,000 starting credits
│   └── If referral code: +500 bonus credits (referrer also gets +500)
│
└── Redirected to Markets tab
    └── Tournament banner visible at top
```

---

## 2. Placing a Trade (LMSR Market)

```
Markets Tab → Tap market card
│
├── Market Detail Screen
│   ├── Price chart (real data from price_history)
│   ├── Current prices per outcome
│   ├── Buy/Sell toggle
│   ├── Select outcome (Yes/No or multiple)
│   ├── Enter credits to spend
│   ├── Live preview: shares received, estimated cost, max payout
│   └── Tap "BUY X SHARES"
│
├── Confirmation dialog
│   └── Tap "Buy" to confirm
│
├── Trade executed (Firestore transaction)
│   ├── Credits deducted
│   ├── Shares added to holdings
│   ├── Market prices updated (LMSR)
│   ├── Price history snapshot recorded
│   └── Achievement check triggered
│
└── Success toast → updated balance shown
```

---

## 3. Tournament Flow (V2 — Numeric Prediction)

### Entering a Tournament

```
Tournaments Screen (hamburger menu) OR banner on Markets tab
│
├── See tournament cards grouped by: My Tournaments, Rapid, Weekly, Monthly
│   Each card shows: question, players, max multiplier, entry fee, time remaining
│
├── Tap tournament card → Entry Modal opens
│   ├── Question: "What will BTC price be on April 8 at 12:00 UTC?"
│   ├── Current value: $83,500
│   ├── Historical range: $75,000 — $95,000
│   ├── Numeric input for prediction
│   ├── Histogram: where other players are guessing (no exact values)
│   ├── Prize breakdown: 1st = 5x, 2nd = 3x, 3rd = 2x
│   ├── Registration deadline countdown
│   └── Tap "Submit Prediction — 100 credits"
│
├── Entry recorded (Firestore transaction)
│   ├── Credits deducted (entry fee)
│   ├── Prediction stored
│   ├── Player count + prize pool updated
│   └── Can edit prediction until registration closes
│
└── Card now shows "Entered" badge
```

### During Lock Period

```
Registration closes → status becomes LOCKED
│
├── Tap entered tournament → Tracker Modal
│   ├── Your prediction vs current live value
│   ├── Estimated rank (e.g. "#3 of 47 players")
│   ├── Distance from current value
│   ├── Progress bar (time remaining)
│   └── Updated every 15 minutes by scheduler
│
└── Push notification: "Predictions locked! 47 players competing"
```

### Resolution

```
Tournament expires → scheduler runs
│
├── Fetches actual value from API (CoinGecko, ExchangeRate, etc.)
├── Ranks all players by |prediction - actual|
├── Calculates payouts (multiplier × entry fee, capped by pool)
├── Distributes credits to top players
├── Records transactions
│
├── Push notification to all participants:
│   ├── Winners: "You placed #2! Won 300 credits"
│   └── Others: "You placed #15. Better luck next time!"
│
├── Tap tournament → Results Modal
│   ├── Actual value revealed
│   ├── Your result card (rank, prediction, payout)
│   └── Full leaderboard with distances and payouts
│
└── Next tournament auto-created from same template
```

---

## 4. Daily Reward

```
Profile Tab → Tap "Daily Reward: Claim"
│
├── Backend calculates: 25 + min(streak × 5, 50)
│   ├── Free user: max 75 credits/day
│   └── Pro user: 2x = max 150 credits/day
│
├── Streak incremented
├── Credits added
└── Alert: "+75 credits! Streak: 12 days"
```

---

## 5. Credit Store

```
Profile Tab → "Credit Store" link  OR  Hamburger → Credit Store
│
├── Balance displayed at top
│
├── Free Credits section
│   └── "Watch Ad" button (stubbed — needs AdMob app IDs)
│
├── Credit Packs section
│   ├── Starter Pack — $0.99 (RevenueCat)
│   ├── Pro Pack — $4.99
│   └── Whale Pack — $19.99
│
├── Predich Pro section
│   ├── Feature list (2x rewards, free proposals, analytics...)
│   ├── "View Plans" → opens RevenueCat native paywall
│   └── Active subscribers see "Manage Subscription" → Customer Center
│
└── "Restore Purchases" button (App Store requirement)
```

---

## 6. Versus Flow (Comparative Prediction)

### Picking a Side

```
Versus Screen (hamburger menu)
│
├── See active matchups: "BTC vs ETH", "EUR vs GBP", etc.
│   Each card shows: both assets, current odds, expiry time, market insight
│   Dark "trading terminal" card design
│
├── Tap matchup → Matchup Detail
│   ├── Asset A vs Asset B with current prices
│   ├── Dynamic odds (calculated from 7d/30d momentum, sigmoid function, 15% house edge)
│   ├── Auto-generated market insight from real price data
│   ├── Pick Asset A or Asset B
│   ├── Enter wager amount
│   └── Tap "Place Pick"
│
├── Confirmation dialog
│   └── Tap "Confirm" to place pick
│
├── Pick recorded (Firestore transaction)
│   ├── Credits deducted (entry fee)
│   ├── Pick stored in versus_picks
│   └── Card shows "Picked" badge with chosen asset
│
└── Appears in Portfolio → Versus Picks section
```

### Resolution

```
Matchup expires → scheduler runs
│
├── Fetches current prices for both assets
├── Compares % change of Asset A vs Asset B over the matchup period
├── Determines winner (higher % change wins)
│
├── Payout logic:
│   ├── Winner: entry fee × odds credited to balance
│   ├── Loser: entry fee forfeited
│   └── Tie (equal % change): full refund
│
├── Push notification sent:
│   ├── Win: "BTC beat ETH! You won X credits"
│   ├── Loss: "ETH outperformed BTC. Better luck next time"
│   └── Tie: "Dead heat! Your X credits have been refunded"
│
└── Result visible in Portfolio → Versus Picks (win/loss/tie status)
```

---

## 7. Referral System

```
Profile/Settings → Share referral code
│
├── User shares code with friend (e.g. "A1B2C3D4")
│
├── Friend signs up → enters code in registration form
│
├── processReferral Firestore trigger fires
│   ├── +500 credits to referrer
│   ├── +500 credits to new user
│   ├── Transactions recorded
│   └── Push notification to referrer: "A friend joined! +500 credits"
│
└── Referral count updated on referrer's profile
```

---

## 8. Account Deletion

```
Settings → Danger Zone → "Delete Account"
│
├── Confirmation dialog: "This will permanently delete..."
├── iOS: Alert.prompt for password
│   Android: Double-confirm dialog
│
├── Backend DELETE /users/me
│   ├── Verify password (email/password users)
│   ├── Delete: holdings, transactions, trades, follows, achievements, proposals
│   └── Delete user document
│
├── Local session cleared
└── Redirect to auth screen
```

---

## 9. Dark Mode

```
Settings → Toggle "Dark Mode"
│
├── setThemeMode('dark') called
├── Colors object mutated in-place
├── ThemeContext.themeKey incremented
├── Stack navigator remounts (key change)
├── All useStyles() hooks re-evaluate
└── Entire app re-renders with dark palette — instant, no restart
```

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register with email/password + optional referral code |
| POST | `/auth/login` | Login, returns JWT |
| POST | `/auth/firebase-token` | Exchange Firebase ID token for app JWT |

### Markets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/markets` or `/trades/markets` | List markets (filterable by category) |
| GET | `/markets/:id` or `/trades/markets/:id` | Market detail |
| GET | `/markets/meta/trending` | Top 10 by volume |
| GET | `/markets/:id/price-history` | Price chart data |
| POST | `/markets/:id/resolve` | Resolve market (admin) |
| GET/POST | `/markets/:id/comments` | Comments |
| POST | `/markets/:id/comments/:id/like` | Like comment |

### Trading
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/trades/preview` | Preview buy cost |
| POST | `/trades/preview-by-cost` | Preview shares for given credits |
| POST | `/trades/preview-sell` | Preview sell revenue |
| POST | `/trades/trade` | Execute buy |
| POST | `/trades/sell` | Execute sell |
| GET | `/trades/portfolio/:userId` | User holdings |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/me` | Current user profile |
| PUT | `/users/me` | Update profile |
| DELETE | `/users/me` | Delete account + all data |
| GET | `/users/me/transactions` | Transaction history |
| POST | `/users/me/daily-reward` | Claim daily reward |
| POST | `/users/me/ad-reward` | Claim rewarded ad credits |
| POST | `/users/me/buy-credits` | Purchase credit pack |
| POST | `/users/me/check-achievements` | Check + award achievements |
| GET | `/users/search` | Search users by name |
| GET | `/users/credit-packs` | Available credit packs |

### Tournaments V2
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tournaments-v2` | List active tournaments + user entries |
| GET | `/tournaments-v2/:id` | Detail + distribution histogram |
| POST | `/tournaments-v2/:id/enter` | Submit prediction + pay fee |
| PUT | `/tournaments-v2/:id/edit` | Edit prediction (registration only) |
| GET | `/tournaments-v2/:id/tracker` | Live rank estimate |
| GET | `/tournaments-v2/:id/results` | Final leaderboard |
| GET | `/tournaments-v2/recent` | Recently completed |

### Social
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/social/friends` | Friends list |
| POST/DELETE | `/social/follow/:userId` | Follow/unfollow |
| GET | `/social/referral` | Referral code + stats |

### Users (additions)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/users/me/change-password` | Change password (current + new, bcrypt verification) |

### Versus
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/versus` | List active matchups |
| GET | `/versus/:id` | Matchup detail with odds + insight |
| POST | `/versus/:id/pick` | Place a pick on a matchup |

### Leaderboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/leaderboard` | Global rankings |
| GET | `/leaderboard/achievements` | Achievement definitions |

### Proposals
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/proposals` | List proposals |
| POST | `/proposals` | Submit proposal (50 credit fee, free for Pro) |
| GET | `/proposals/mine` | User's proposals |
| POST | `/proposals/:id/vote` | Upvote |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/stats` | Dashboard stats |
| POST | `/admin/sync-markets` | Scrape Polymarket + Manifold |
| POST | `/admin/users/:id/credits` | Adjust user credits |
| POST | `/admin/users/:id/ban` | Ban/unban user |
| POST | `/proposals/:id/approve` | Approve proposal → create market |
| POST | `/proposals/:id/reject` | Reject proposal |
| GET | `/admin/tournament-templates` | List tournament templates |
| POST | `/admin/tournament-templates` | Create template |
| POST | `/admin/tournament-templates/:id/toggle` | Enable/disable |
| POST | `/admin/tournaments-v2` | Manually create tournament |
| POST | `/admin/tournaments-v2/:id/resolve` | Manually resolve |
| POST | `/admin/tournaments-v2/:id/cancel` | Cancel + refund |
