# PredictSpinz - Prediction Market App

A virtual credit prediction market application built with React Native (Expo), Firebase, and PostgreSQL.

## Features

- 📊 **Prediction Markets** - Trade on real-world events (Politics, Sports, Crypto, Entertainment, Science)
- 💰 **Virtual Credits** - Start with 1000 credits, earn more by making accurate predictions
- 📈 **LMSR Pricing** - Automated market making using Logarithmic Market Scoring Rule
- 🏆 **Leaderboards** - Compete with other users and climb the ranks
- 👤 **User Profiles** - Track your trading history and achievements

## Project Structure

```
PredictSpinz/
├── mobile/              # React Native (Expo) mobile app
│   ├── src/
│   │   ├── app/       # App screens (tabs, market details)
│   │   ├── lib/      # Auth, API client, WebSocket, questions
│   │   └── ...
│   └── ...
├── backend/            # Express.js backend API
│   ├── src/
│   │   ├── routes/   # API endpoints (trades, markets, users)
│   │   ├── lib/      # LMSR pricing engine
│   │   └── scripts/  # Seed script for initial data
│   └── ...
├── frontend/          # Admin dashboard (Next.js)
│   ├── src/
│   │   ├── app/admin/  # Admin pages (dashboard, users, markets)
│   │   └── lib/        # Firebase configuration
│   └── ...
└── firestore.rules    # Firestore security rules
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase account
- Expo CLI

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project named "PredictSpinz"
3. Enable **Firestore Database** (start in test mode)
4. Enable **Authentication** (Email/Password)
5. Download your service account key (for backend)
6. Create `.env.local` files with your config (see below)

### 2. Environment Variables

#### Mobile App (`mobile/.env`)
```
EXPO_PUBLIC_API_URL=https://your-backend-url.com/api
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

#### Backend (`backend/.env`)
```
DATABASE_URL=postgresql://user:password@localhost:5432/predictspinz
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="your_private_key"
```

### 3. Install Dependencies

```bash
# Mobile app
cd mobile && npm install

# Backend
cd backend && npm install

# Admin dashboard
cd frontend && npm install
```

### 4. Seed Initial Markets

```bash
cd backend
npx ts-node src/scripts/seed-markets.ts
```

### 5. Run the App

```bash
# Mobile (Expo)
cd mobile && npx expo start

# Backend
cd backend && npm run dev

# Admin Dashboard
cd frontend && npm run dev
```

## Tech Stack

- **Mobile**: React Native + Expo
- **Backend**: Node.js + Express + Prisma
- **Database**: PostgreSQL + Firebase Firestore
- **Auth**: Firebase Auth
- **Admin**: Next.js + Tailwind CSS

## API Endpoints

### Markets
- `GET /trades/markets` - List all markets
- `GET /trades/markets/:id` - Get market details

### Trading
- `POST /trades/trade` - Execute a trade
- `GET /trades/portfolio/:userId` - Get user portfolio

### User
- `GET /users/:id` - Get user profile
- `PATCH /users/:id` - Update user

### Admin
- Firebase Firestore collections: `users`, `markets`, `trades`, `leaderboard`

## LMSR Pricing

The app uses Logarithmic Market Scoring Rule (LMSR) for automated market making:

- **Cost Formula**: `cost = b * ln(sum(exp(q_i / b)))`
- **Price Formula**: `price_i = exp(q_i / b) / sum(exp(q_j / b))`

Where `b` is the liquidity parameter (default: 1000).

## Prediction Questions

The app includes 100 pre-loaded prediction questions across 5 categories:

- **Politics** (20 questions) - Elections, policy, international relations
- **Sports** (20 questions) - Championships, tournaments, athlete outcomes
- **Crypto** (20 questions) - Price predictions, regulations, market events
- **Entertainment** (20 questions) - Movies, music, streaming, gaming
- **Science** (20 questions) - Space, AI, medical breakthroughs

## License

MIT
