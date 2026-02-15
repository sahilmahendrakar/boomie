import { FieldValue } from "firebase-admin/firestore";

import { firebaseAdminDb } from "@/lib/firebase-admin";
import {
  type CurrentRecommendation,
  type CurrentRecommendationFirestoreDoc,
  type CurrentRecommendationInput,
  toCurrentRecommendation,
} from "@/lib/recommendations/types";

const USERS_COLLECTION = "users";
const RECOMMENDATIONS_COLLECTION = "recommendations";
const CURRENT_RECOMMENDATION_DOC_ID = "current";

function getCurrentRecommendationDoc(uid: string) {
  return firebaseAdminDb
    .collection(USERS_COLLECTION)
    .doc(uid)
    .collection(RECOMMENDATIONS_COLLECTION)
    .doc(CURRENT_RECOMMENDATION_DOC_ID);
}

export async function getCurrentRecommendationForUser(uid: string): Promise<CurrentRecommendation | null> {
  const snapshot = await getCurrentRecommendationDoc(uid).get();
  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() as CurrentRecommendationFirestoreDoc;
  return toCurrentRecommendation(data);
}

export async function upsertCurrentRecommendationForUser(
  uid: string,
  input: CurrentRecommendationInput,
): Promise<CurrentRecommendation> {
  const docRef = getCurrentRecommendationDoc(uid);

  await firebaseAdminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef);
    const baseData = {
      ...input,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (snapshot.exists) {
      transaction.update(docRef, baseData);
    } else {
      transaction.set(docRef, {
        ...baseData,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  });

  const saved = await docRef.get();
  if (!saved.exists) {
    throw new Error("Failed to persist recommendation");
  }

  const data = saved.data() as CurrentRecommendationFirestoreDoc;
  return toCurrentRecommendation(data);
}
