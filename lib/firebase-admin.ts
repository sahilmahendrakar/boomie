import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getServiceAccountCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("Missing required environment variable: FIREBASE_SERVICE_ACCOUNT_JSON");
  }

  const parsed = JSON.parse(raw) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
    [key: string]: unknown;
  };

  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON must include project_id, client_email, and private_key",
    );
  }

  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: (parsed.private_key as string).replace(/\\n/g, "\n"),
  };
}

function getFirebaseAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const credential = getServiceAccountCredential();
  return initializeApp({
    credential: cert(credential),
  });
}

const firebaseAdminApp = getFirebaseAdminApp();

export const firebaseAdminAuth = getAuth(firebaseAdminApp);
export const firebaseAdminDb = getFirestore(firebaseAdminApp);
