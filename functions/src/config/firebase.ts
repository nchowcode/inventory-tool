// src/config/firebase.ts

// Import client SDK for frontend operations
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Import admin SDK for backend operations
import {
  getApp,
  initializeApp as initializeAdminApp,
  cert,
} from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import admin from "firebase-admin";
import { credential } from "firebase-admin";
import { FIREBASE_CONFIG } from "../credentials/firebaseConfig.js";
import { serviceAccount } from "../credentials/serviceAccount.js";
import type { ServiceAccount } from "firebase-admin";
import { Auth } from "googleapis";

// const app = initializeApp({
//   credential: cert(serviceAccount)
// });
const adminCredentials = serviceAccount as ServiceAccount;

// This configuration comes from your Firebase Console's web app settings

// Initialize the client app (for browser/frontend use)
const clientApp = initializeApp(FIREBASE_CONFIG);

// Initialize auth and Firestore for client usage
export const auth = getAuth(clientApp);
export const db = getFirestore(clientApp);

// Function to initialize admin SDK when needed (for backend/server use)
let adminApp: any = null;

// const getUserById = async (uid: string) => {
//   try {
//     const userRecord = await getAuth().getUser(uid);
//     console.log("User:", userRecord);
//     return userRecord;
//   } catch (error) {
//     console.error("Error fetching user:", error);
//     throw error;
//   }
// };

export function getAdminDb() {
  try {
    // Try to get existing app first
    return getAdminFirestore(getApp());
  } catch (error) {
    // If no app exists, initialize it
    const app = initializeAdminApp({
      credential: admin.credential.cert(adminCredentials),
    });
    return getAdminFirestore(app);
  }
}

// Helper function to determine if we're running in a server environment
export function isServer() {
  return typeof window === "undefined";
}

// Export a function that gets the appropriate database instance
export function getDatabase() {
  return isServer() ? getAdminDb() : db;
}
