import { FieldValue } from "firebase-admin/firestore";

import { firebaseAdminDb } from "@/lib/firebase-admin";
import {
  type CurrentRecommendation,
  type CurrentRecommendationFirestoreDoc,
  type CurrentRecommendationInput,
  type RecommendationHistoryEntry,
  type RecommendationHistoryEntryFirestoreDoc,
  toRecommendationHistoryEntry,
  toCurrentRecommendation,
} from "@/lib/recommendations/types";

const USERS_COLLECTION = "users";
const RECOMMENDATIONS_COLLECTION = "recommendations";
const CURRENT_RECOMMENDATION_DOC_ID = "current";
const HISTORY_COLLECTION = "history";

function normalizeRecommendationInput(input: CurrentRecommendationInput): CurrentRecommendationInput {
  return {
    recommendationId: input.recommendationId ?? "",
    tagline: input.tagline ?? "",
    albumDescription: input.albumDescription ?? "",
    whyForUser: input.whyForUser ?? "",
    spotifyAlbumImageUrl: input.spotifyAlbumImageUrl ?? "",
    spotifyAlbumId: input.spotifyAlbumId ?? "",
    spotifyAlbumName: input.spotifyAlbumName ?? "",
    spotifyArtistName: input.spotifyArtistName ?? "",
    spotifyArtistImageUrl: input.spotifyArtistImageUrl ?? "",
  };
}

function getCurrentRecommendationDoc(uid: string) {
  return firebaseAdminDb
    .collection(USERS_COLLECTION)
    .doc(uid)
    .collection(RECOMMENDATIONS_COLLECTION)
    .doc(CURRENT_RECOMMENDATION_DOC_ID);
}

function getRecommendationHistoryCollection(uid: string) {
  return firebaseAdminDb
    .collection(USERS_COLLECTION)
    .doc(uid)
    .collection(RECOMMENDATIONS_COLLECTION)
    .doc(CURRENT_RECOMMENDATION_DOC_ID)
    .collection(HISTORY_COLLECTION);
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
  const normalizedInput = normalizeRecommendationInput(input);

  await firebaseAdminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef);
    const baseData = {
      ...normalizedInput,
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

export async function createRecommendationHistoryEntryForUser(
  uid: string,
  input: CurrentRecommendationInput,
): Promise<RecommendationHistoryEntry> {
  const collectionRef = getRecommendationHistoryCollection(uid);
  const docRef = collectionRef.doc();
  const normalizedInput = normalizeRecommendationInput(input);

  await docRef.set({
    ...normalizedInput,
    recommendationId: docRef.id,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const savedDoc = await docRef.get();
  if (!savedDoc.exists) {
    throw new Error("Failed to persist recommendation history entry");
  }

  return toRecommendationHistoryEntry(savedDoc.id, savedDoc.data() as RecommendationHistoryEntryFirestoreDoc);
}

export async function listRecommendationHistoryForUser(uid: string): Promise<RecommendationHistoryEntry[]> {
  const snapshot = await getRecommendationHistoryCollection(uid).orderBy("updatedAt", "desc").get();
  return snapshot.docs.map((doc) => toRecommendationHistoryEntry(doc.id, doc.data() as RecommendationHistoryEntryFirestoreDoc));
}

export async function getRecommendationHistoryEntryForUser(
  uid: string,
  recommendationId: string,
): Promise<RecommendationHistoryEntry | null> {
  const snapshot = await getRecommendationHistoryCollection(uid).doc(recommendationId).get();
  if (!snapshot.exists) {
    return null;
  }

  return toRecommendationHistoryEntry(snapshot.id, snapshot.data() as RecommendationHistoryEntryFirestoreDoc);
}
