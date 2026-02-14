import { Timestamp } from "firebase-admin/firestore";

export type AlbumRatingInput = {
  albumName: string;
  rating: number;
  notes: string;
};

export type AlbumRatingFirestoreDoc = {
  albumName: string;
  rating: number;
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type AlbumRating = {
  id: string;
  albumName: string;
  rating: number;
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
