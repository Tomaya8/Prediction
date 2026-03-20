import * as admin from 'firebase-admin';

let app: admin.app.App | null = null;

export function getFirebaseAdmin() {
  if (!app) {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }

  return {
    db: admin.firestore(app),
    auth: admin.auth(app),
    app,
  };
}

export const verifyIdToken = async (token: string) => {
  const { auth } = getFirebaseAdmin();
  return auth.verifyIdToken(token);
};
