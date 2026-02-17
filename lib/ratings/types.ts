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
  recommendationId: string;
  spotifyAlbumId: string;
  spotifyAlbumImageUrl: string;
  spotifyArtistName: string;
  spotifyArtistImageUrl: string;
};

export type AlbumRatingFirestoreDoc = {
  albumName: string;
  rating: AlbumRatingId;
  notes: string;
  recommendationId: string;
  spotifyAlbumId: string;
  spotifyAlbumImageUrl: string;
  spotifyArtistName: string;
  spotifyArtistImageUrl: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type AlbumRating = {
  id: string;
  albumName: string;
  rating: AlbumRatingId;
  notes: string;
  recommendationId: string;
  spotifyAlbumId: string;
  spotifyAlbumImageUrl: string;
  spotifyArtistName: string;
  spotifyArtistImageUrl: string;
  createdAt: string;
  updatedAt: string;
};

function toIsoOrNow(value: unknown): string {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  return new Date().toISOString();
}

export function toAlbumRating(id: string, doc: AlbumRatingFirestoreDoc): AlbumRating {
  return {
    id,
    albumName: doc.albumName ?? "",
    rating: doc.rating,
    notes: doc.notes ?? "",
    recommendationId: doc.recommendationId ?? "",
    spotifyAlbumId: doc.spotifyAlbumId ?? "",
    spotifyAlbumImageUrl: doc.spotifyAlbumImageUrl ?? "",
    spotifyArtistName: doc.spotifyArtistName ?? "",
    spotifyArtistImageUrl: doc.spotifyArtistImageUrl ?? "",
    createdAt: toIsoOrNow(doc.createdAt),
    updatedAt: toIsoOrNow(doc.updatedAt),
  };
}
