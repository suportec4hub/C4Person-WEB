import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export const db = getFirestore();

export function formatDoc(doc: FirebaseFirestore.DocumentSnapshot): Record<string, unknown> {
  const data = doc.data() || {};
  const result: Record<string, unknown> = { id: doc.id };
  for (const [k, v] of Object.entries(data)) {
    result[k] = v instanceof Timestamp ? v.toDate().toISOString() : v;
  }
  return result;
}
