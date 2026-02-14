import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

function requirePublicEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required Firebase client env var: ${name}`);
  }
  return value;
}

const firebaseConfig = {
  apiKey: requirePublicEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY, "NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: requirePublicEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: requirePublicEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, "NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  appId: requirePublicEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID, "NEXT_PUBLIC_FIREBASE_APP_ID"),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const firebaseClientAuth = getAuth(firebaseApp);
