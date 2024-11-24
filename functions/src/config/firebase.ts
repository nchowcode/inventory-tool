// src/config/firebase.ts (Replace the old firebaseConfig.ts)
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as path from "path";
import { logger } from "../utils/logger";

let firestoreInstance: any = null;

export function initFirebase() {
  try {
    if (getApps().length === 0) {
      const serviceAccountPath = path.join(
        process.cwd(),
        "src",
        "credentials",
        "serviceAccount.json"
      );

      initializeApp({
        credential: cert(serviceAccountPath),
      });

      logger.info("Firebase initialized successfully");
    }

    if (!firestoreInstance) {
      firestoreInstance = getFirestore();
    }

    return firestoreInstance;
  } catch (error) {
    logger.error("Failed to initialize Firebase:", error);
    throw error;
  }
}
