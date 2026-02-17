import { FieldValue } from "firebase-admin/firestore";

import { firebaseAdminDb } from "@/lib/firebase-admin";
import { type AlbumRating, type AlbumRatingFirestoreDoc, type AlbumRatingInput, toAlbumRating } from "@/lib/ratings/types";

const USERS_COLLECTION = "users";
const ALBUM_RATINGS_COLLECTION = "albumRatings";

function getAlbumRatingsCollection(uid: string) {
  return firebaseAdminDb.collection(USERS_COLLECTION).doc(uid).collection(ALBUM_RATINGS_COLLECTION);
}

function toAlbumDocId(albumName: string): string {
  return albumName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toRatingDocId(input: AlbumRatingInput): string {
  if (input.recommendationId.trim().length > 0) {
    return input.recommendationId.trim();
  }

  return toAlbumDocId(input.albumName);
}

export async function upsertAlbumRatingForUser(uid: string, input: AlbumRatingInput): Promise<AlbumRating> {
  const collectionRef = getAlbumRatingsCollection(uid);
  const docId = toRatingDocId(input);

  if (!docId) {
    throw new Error("Album name cannot be empty");
  }

  const docRef = collectionRef.doc(docId);
  console.info("[ratings/repository] upsert_started", {
    uid,
    docId,
    albumName: input.albumName,
    recommendationId: input.recommendationId,
    rating: input.rating,
    hasSpotifyAlbumId: input.spotifyAlbumId.length > 0,
    hasSpotifyAlbumImageUrl: input.spotifyAlbumImageUrl.length > 0,
    hasSpotifyArtistName: input.spotifyArtistName.length > 0,
    hasSpotifyArtistImageUrl: input.spotifyArtistImageUrl.length > 0,
  });

  try {
    await firebaseAdminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);
      const baseData = {
        albumName: input.albumName,
        rating: input.rating,
        notes: input.notes,
        recommendationId: input.recommendationId,
        spotifyAlbumId: input.spotifyAlbumId,
        spotifyAlbumImageUrl: input.spotifyAlbumImageUrl,
        spotifyArtistName: input.spotifyArtistName,
        spotifyArtistImageUrl: input.spotifyArtistImageUrl,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (snapshot.exists) {
        console.info("[ratings/repository] upsert_updating_existing_doc", {
          uid,
          docId,
        });
        transaction.update(docRef, baseData);
      } else {
        console.info("[ratings/repository] upsert_creating_new_doc", {
          uid,
          docId,
        });
        transaction.set(docRef, {
          ...baseData,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    });

    const savedDoc = await docRef.get();
    if (!savedDoc.exists) {
      throw new Error("Failed to persist album rating");
    }

    const savedData = savedDoc.data() as AlbumRatingFirestoreDoc;
    console.info("[ratings/repository] upsert_saved_doc_loaded", {
      uid,
      docId,
      hasCreatedAt: Boolean((savedData as { createdAt?: unknown }).createdAt),
      hasUpdatedAt: Boolean((savedData as { updatedAt?: unknown }).updatedAt),
      persistedRecommendationId: savedData.recommendationId ?? "",
    });
    return toAlbumRating(savedDoc.id, savedData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[ratings/repository] upsert_failed", {
      uid,
      docId,
      error: message,
      stack,
      inputSummary: {
        albumName: input.albumName,
        rating: input.rating,
        recommendationId: input.recommendationId,
        hasSpotifyAlbumId: input.spotifyAlbumId.length > 0,
        hasSpotifyAlbumImageUrl: input.spotifyAlbumImageUrl.length > 0,
        hasSpotifyArtistName: input.spotifyArtistName.length > 0,
        hasSpotifyArtistImageUrl: input.spotifyArtistImageUrl.length > 0,
      },
    });
    throw error;
  }
}

export async function listAlbumRatingsForUser(uid: string): Promise<AlbumRating[]> {
  const snapshot = await getAlbumRatingsCollection(uid).orderBy("updatedAt", "desc").get();

  return snapshot.docs.map((doc) => toAlbumRating(doc.id, doc.data() as AlbumRatingFirestoreDoc));
}

export async function getAlbumRatingForRecommendationForUser(
  uid: string,
  recommendationId: string,
): Promise<AlbumRating | null> {
  const docSnapshot = await getAlbumRatingsCollection(uid).doc(recommendationId).get();
  if (docSnapshot.exists) {
    return toAlbumRating(docSnapshot.id, docSnapshot.data() as AlbumRatingFirestoreDoc);
  }

  const fallbackSnapshot = await getAlbumRatingsCollection(uid)
    .where("recommendationId", "==", recommendationId)
    .limit(1)
    .get();
  if (fallbackSnapshot.empty) {
    return null;
  }

  const doc = fallbackSnapshot.docs[0];
  return toAlbumRating(doc.id, doc.data() as AlbumRatingFirestoreDoc);
}
