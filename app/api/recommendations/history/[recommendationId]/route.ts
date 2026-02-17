import { NextRequest, NextResponse } from "next/server";

import { UnauthorizedError, verifyFirebaseTokenFromRequest } from "@/lib/auth/verify-firebase-token";
import { getRecommendationHistoryEntryForUser } from "@/lib/recommendations/repository";
import { getAlbumRatingForRecommendationForUser } from "@/lib/ratings/repository";

type RouteContext = {
  params: Promise<{ recommendationId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const uid = await verifyFirebaseTokenFromRequest(request);
    const { recommendationId } = await context.params;
    const normalizedRecommendationId = recommendationId.trim();

    if (!normalizedRecommendationId) {
      return NextResponse.json({ error: "recommendationId is required" }, { status: 400 });
    }

    const [historyEntry, rating] = await Promise.all([
      getRecommendationHistoryEntryForUser(uid, normalizedRecommendationId),
      getAlbumRatingForRecommendationForUser(uid, normalizedRecommendationId),
    ]);

    if (!historyEntry) {
      return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
    }

    return NextResponse.json({
      recommendation: {
        id: historyEntry.id,
        recommendationId: historyEntry.id,
        tagline: historyEntry.tagline,
        albumDescription: historyEntry.albumDescription,
        whyForUser: historyEntry.whyForUser,
        spotifyAlbumId: historyEntry.spotifyAlbumId,
        spotifyAlbumName: historyEntry.spotifyAlbumName,
        spotifyAlbumImageUrl: historyEntry.spotifyAlbumImageUrl,
        spotifyArtistName: historyEntry.spotifyArtistName,
        spotifyArtistImageUrl: historyEntry.spotifyArtistImageUrl,
        createdAt: historyEntry.createdAt,
        updatedAt: historyEntry.updatedAt,
      },
      rating: rating
        ? {
            id: rating.id,
            rating: rating.rating,
            notes: rating.notes,
            updatedAt: rating.updatedAt,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ error: "Failed to fetch recommendation detail" }, { status: 500 });
  }
}
