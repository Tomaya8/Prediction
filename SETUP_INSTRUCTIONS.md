# PredictSpinz Setup Instructions

## Step 1: Download Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **prediction-app-2026**
3. Click **Project Settings** (gear icon ⚙️)
4. Scroll down to **"Your apps"** section
5. Click **"Service accounts"** tab
6. Click **"Generate new private key"** button
7. Save the downloaded JSON file

## Step 2: Configure Backend Environment

1. Copy the downloaded JSON file to: `backend/service-account.json`
   OR
2. Copy the values to `backend/.env`:
   - `FIREBASE_CLIENT_EMAIL` - from JSON's `client_email` field
   - `FIREBASE_PRIVATE_KEY` - from JSON's `private_key` field (preserve the \n characters)

## Step 3: Seed Markets to Firestore

After configuring credentials:

```bash
cd backend
npm install
npx ts-node src/scripts/seed-markets.ts
```

## Step 4: Configure Mobile App

1. Download `google-services.json` from Firebase Console:
   - Go to Project Settings > Your apps > Android app
   - Click "Download google-services.json"
   - Place in: `mobile/google-services.json`

2. Or update `mobile/src/lib/firebase.ts` with your Firebase config values

## Step 5: Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

## Step 6: Start Development Servers

**Backend:**
```bash
cd backend
npm run dev
```

**Mobile:**
```bash
cd mobile
npx expo start
```

**Frontend (Admin Dashboard):**
```bash
cd frontend
npm run dev
```
