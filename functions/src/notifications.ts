/**
 * Push notification utility — uses Expo Push API.
 */

import * as admin from "firebase-admin";

function getDb() { return admin.firestore(); }

/**
 * Send push notification to a single user.
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  try {
    const userDoc = await getDb().collection("users").doc(userId).get();
    if (!userDoc.exists) return;
    const pushToken = userDoc.data()!.pushToken;
    if (!pushToken || !pushToken.startsWith("ExponentPushToken[")) return;

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: pushToken,
        title,
        body,
        data: data || {},
        sound: "default",
      }),
    });
  } catch (e: any) {
    console.error("Push notification failed:", e.message);
  }
}

/**
 * Send push notification to all participants of a tournament.
 */
export async function notifyTournamentParticipants(
  tournamentId: string,
  title: string,
  body: string
): Promise<void> {
  const entries = await getDb().collection("tournament_entries")
    .where("tournamentId", "==", tournamentId)
    .get();
  const userIds = [...new Set(entries.docs.map(d => d.data().userId))];
  await Promise.all(userIds.map(uid => sendPushNotification(uid, title, body, { tournamentId })));
}

/**
 * Send push notification to all holders of a market.
 */
export async function notifyMarketHolders(
  marketId: string,
  title: string,
  body: string
): Promise<void> {
  const holdings = await getDb().collection("holdings").where("marketId", "==", marketId).get();
  const userIds = [...new Set(holdings.docs.map(d => d.data().userId))];
  await Promise.all(userIds.map(uid => sendPushNotification(uid, title, body, { marketId })));
}
