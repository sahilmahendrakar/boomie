import { Timestamp } from "firebase-admin/firestore";

export const ALBUM_RATING_IDS = [
  "hated",
  "disliked",
  "neutral",
  "liked",
  "loved",
  "did-not-listen",
] as const;

export type AlbumRatingId = (typeof ALBUM_RATING_IDS)[number];

export type AlbumRatingInput = {
  albumName: string;
  rating: AlbumRatingId;
  notes: string;
};

export type AlbumRatingFirestoreDoc = {
  albumName: string;
  rating: AlbumRatingId;
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type AlbumRating = {
  id: string;
  albumName: string;
  rating: AlbumRatingId;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export function toAlbumRating(id: string, doc: AlbumRatingFirestoreDoc): AlbumRating {
  return {
    id,
    albumName: doc.albumName,
    rating: doc.rating,
    notes: doc.notes,
    createdAt: doc.createdAt.toDate().toISOString(),
    updatedAt: doc.updatedAt.toDate().toISOString(),
  };
}
