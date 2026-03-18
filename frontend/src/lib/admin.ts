// PredictSpinz Admin - Firebase Admin SDK Configuration (Server-side)
// This file should only be used in server-side contexts (API routes, getServerSideProps, etc.)

import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

const serviceAccount = {
  type: 'service_account',
  project_id: process.env.FIREBASE_ADMIN_PROJECT_ID,
  private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
};

// Initialize Firebase Admin (only if not already initialized)
let app: App;
let db: Firestore;
let auth: Auth;

if (getApps().length === 0) {
  app = initializeApp({
    credential: cert(serviceAccount),
  });
  db = getFirestore(app);
  auth = getAuth(app);
} else {
  app = getApps()[0];
  db = getFirestore(app);
  auth = getAuth(app);
}

export { app, db, auth };
