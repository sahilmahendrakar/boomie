import { Timestamp } from "firebase-admin/firestore";

export type CurrentRecommendationInput = {
  recommendationId: string;
  tagline: string;
  albumDescription: string;
  whyForUser: string;
  spotifyAlbumImageUrl: string;
  spotifyAlbumId: string;
  spotifyAlbumName: string;
  spotifyArtistName: string;
  spotifyArtistImageUrl: string;
};

export type CurrentRecommendationFirestoreDoc = CurrentRecommendationInput & {
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type CurrentRecommendation = CurrentRecommendationInput & {
  createdAt: string;
  updatedAt: string;
};

export type RecommendationHistoryEntryFirestoreDoc = CurrentRecommendationInput & {
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type RecommendationHistoryEntry = CurrentRecommendationInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export function toCurrentRecommendation(doc: CurrentRecommendationFirestoreDoc): CurrentRecommendation {
  return {
    recommendationId: doc.recommendationId ?? "",
    tagline: doc.tagline ?? "",
    albumDescription: doc.albumDescription ?? "",
    whyForUser: doc.whyForUser ?? "",
    spotifyAlbumImageUrl: doc.spotifyAlbumImageUrl ?? "",
    spotifyAlbumId: doc.spotifyAlbumId ?? "",
    spotifyAlbumName: doc.spotifyAlbumName ?? "",
    spotifyArtistName: doc.spotifyArtistName ?? "",
    spotifyArtistImageUrl: doc.spotifyArtistImageUrl ?? "",
    createdAt: doc.createdAt.toDate().toISOString(),
    updatedAt: doc.updatedAt.toDate().toISOString(),
  };
}

export function toRecommendationHistoryEntry(
  id: string,
  doc: RecommendationHistoryEntryFirestoreDoc,
): RecommendationHistoryEntry {
  return {
    id,
    recommendationId: id,
    tagline: doc.tagline ?? "",
    albumDescription: doc.albumDescription ?? "",
    whyForUser: doc.whyForUser ?? "",
    spotifyAlbumImageUrl: doc.spotifyAlbumImageUrl ?? "",
    spotifyAlbumId: doc.spotifyAlbumId ?? "",
    spotifyAlbumName: doc.spotifyAlbumName ?? "",
    spotifyArtistName: doc.spotifyArtistName ?? "",
    spotifyArtistImageUrl: doc.spotifyArtistImageUrl ?? "",
    createdAt: doc.createdAt.toDate().toISOString(),
    updatedAt: doc.updatedAt.toDate().toISOString(),
  };
}
