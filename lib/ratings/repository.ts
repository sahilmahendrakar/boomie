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

export async function upsertAlbumRatingForUser(uid: string, input: AlbumRatingInput): Promise<AlbumRating> {
  const collectionRef = getAlbumRatingsCollection(uid);
  const docId = toAlbumDocId(input.albumName);

  if (!docId) {
    throw new Error("Album name cannot be empty");
  }

  const docRef = collectionRef.doc(docId);

  await firebaseAdminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef);
    const baseData = {
      albumName: input.albumName,
      rating: input.rating,
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

  const savedDoc = await docRef.get();
  if (!savedDoc.exists) {
    throw new Error("Failed to persist album rating");
  }

  const savedData = savedDoc.data() as AlbumRatingFirestoreDoc;
  return toAlbumRating(savedDoc.id, savedData);
}

export async function listAlbumRatingsForUser(uid: string): Promise<AlbumRating[]> {
  const snapshot = await getAlbumRatingsCollection(uid).orderBy("updatedAt", "desc").get();

  return snapshot.docs.map((doc) => toAlbumRating(doc.id, doc.data() as AlbumRatingFirestoreDoc));
}
