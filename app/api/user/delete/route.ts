import { NextRequest, NextResponse } from "next/server";

import { UnauthorizedError, verifyFirebaseTokenFromRequest } from "@/lib/auth/verify-firebase-token";
import { firebaseAdminAuth, firebaseAdminDb } from "@/lib/firebase-admin";

const USERS_COLLECTION = "users";
const PREFERENCES_COLLECTION = "preferences";
const GOALS_DOC_ID = "goals";
const ALBUM_RATINGS_COLLECTION = "albumRatings";
const DELETE_BATCH_SIZE = 300;

async function deleteCollectionDocuments(collectionPath: string): Promise<void> {
  while (true) {
    const snapshot = await firebaseAdminDb.collection(collectionPath).limit(DELETE_BATCH_SIZE).get();
    if (snapshot.empty) {
      return;
    }

    const batch = firebaseAdminDb.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }
}

async function deleteUserFirestoreData(uid: string): Promise<void> {
  const userRef = firebaseAdminDb.collection(USERS_COLLECTION).doc(uid);

  await deleteCollectionDocuments(`${USERS_COLLECTION}/${uid}/${ALBUM_RATINGS_COLLECTION}`);
  await userRef.collection(PREFERENCES_COLLECTION).doc(GOALS_DOC_ID).delete();
  await userRef.delete();
}

export async function DELETE(request: NextRequest) {
  try {
    const uid = await verifyFirebaseTokenFromRequest(request);

    await deleteUserFirestoreData(uid);
    await firebaseAdminAuth.deleteUser(uid);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
