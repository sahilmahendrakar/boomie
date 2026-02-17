import { NextRequest, NextResponse } from "next/server";

import { UnauthorizedError, verifyFirebaseTokenFromRequest } from "@/lib/auth/verify-firebase-token";
import { listRecommendationHistoryForUser } from "@/lib/recommendations/repository";
import { listAlbumRatingsForUser } from "@/lib/ratings/repository";

export async function GET(request: NextRequest) {
  try {
    const uid = await verifyFirebaseTokenFromRequest(request);
    const [historyEntries, ratings] = await Promise.all([
      listRecommendationHistoryForUser(uid),
      listAlbumRatingsForUser(uid),
    ]);

    const ratingsByRecommendationId = new Map(
      ratings.filter((rating) => rating.recommendationId).map((rating) => [rating.recommendationId, rating]),
    );

    const history = historyEntries.map((entry) => {
      const rating = ratingsByRecommendationId.get(entry.id) ?? null;
      return {
        id: entry.id,
        recommendationId: entry.id,
        tagline: entry.tagline,
        albumDescription: entry.albumDescription,
        whyForUser: entry.whyForUser,
        spotifyAlbumId: entry.spotifyAlbumId,
        spotifyAlbumName: entry.spotifyAlbumName,
        spotifyAlbumImageUrl: entry.spotifyAlbumImageUrl,
        spotifyArtistName: entry.spotifyArtistName,
        spotifyArtistImageUrl: entry.spotifyArtistImageUrl,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        rating: rating
          ? {
              id: rating.id,
              rating: rating.rating,
              notes: rating.notes,
              updatedAt: rating.updatedAt,
            }
          : null,
      };
    });

    return NextResponse.json({ history });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ error: "Failed to fetch recommendation history" }, { status: 500 });
  }
}
