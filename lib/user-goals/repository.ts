import { FieldValue } from "firebase-admin/firestore";

import { firebaseAdminDb } from "@/lib/firebase-admin";
import { type UserGoals, type UserGoalsFirestoreDoc, type UserGoalsInput, toUserGoals } from "@/lib/user-goals/types";

const USERS_COLLECTION = "users";
const PREFERENCES_COLLECTION = "preferences";
const GOALS_DOC_ID = "goals";

function getUserGoalsDoc(uid: string) {
  return firebaseAdminDb.collection(USERS_COLLECTION).doc(uid).collection(PREFERENCES_COLLECTION).doc(GOALS_DOC_ID);
}

export async function getUserGoals(uid: string): Promise<UserGoals | null> {
  const snapshot = await getUserGoalsDoc(uid).get();
  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() as UserGoalsFirestoreDoc;
  return toUserGoals(data);
}

export async function upsertUserGoals(uid: string, input: UserGoalsInput): Promise<UserGoals> {
  const docRef = getUserGoalsDoc(uid);

  await firebaseAdminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef);
    const baseData = {
      selectedGoals: input.selectedGoals,
      notes: input.notes,
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
    throw new Error("Failed to persist user goals");
  }

  const data = saved.data() as UserGoalsFirestoreDoc;
  return toUserGoals(data);
}
