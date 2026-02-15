import { Timestamp } from "firebase-admin/firestore";

export type CurrentRecommendationInput = {
  tagline: string;
  albumDescription: string;
  whyForUser: string;
  spotifyAlbumImageUrl: string;
  spotifyAlbumId: string;
  spotifyAlbumName: string;
  spotifyArtistName: string;
};

export type CurrentRecommendationFirestoreDoc = CurrentRecommendationInput & {
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type CurrentRecommendation = CurrentRecommendationInput & {
  createdAt: string;
  updatedAt: string;
};

export function toCurrentRecommendation(doc: CurrentRecommendationFirestoreDoc): CurrentRecommendation {
  return {
    tagline: doc.tagline,
    albumDescription: doc.albumDescription,
    whyForUser: doc.whyForUser,
    spotifyAlbumImageUrl: doc.spotifyAlbumImageUrl,
    spotifyAlbumId: doc.spotifyAlbumId,
    spotifyAlbumName: doc.spotifyAlbumName,
    spotifyArtistName: doc.spotifyArtistName,
    createdAt: doc.createdAt.toDate().toISOString(),
    updatedAt: doc.updatedAt.toDate().toISOString(),
  };
}
