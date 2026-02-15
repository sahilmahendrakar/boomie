import { NextRequest, NextResponse } from "next/server";

import { generateBoomieRecommendation } from "@/lib/agent/boomie";
import { UnauthorizedError, verifyFirebaseTokenFromRequest } from "@/lib/auth/verify-firebase-token";
import {
  getCurrentRecommendationForUser,
  upsertCurrentRecommendationForUser,
} from "@/lib/recommendations/repository";
import { type CurrentRecommendationInput } from "@/lib/recommendations/types";
import { listAlbumRatingsForUser } from "@/lib/ratings/repository";
import { findSpotifyAlbum } from "@/lib/spotify/client";

function toRecommendationResponse(recommendation: CurrentRecommendationInput) {
  return {
    tagline: recommendation.tagline,
    albumDescription: recommendation.albumDescription,
    whyForUser: recommendation.whyForUser,
    spotifyAlbumImageUrl: recommendation.spotifyAlbumImageUrl,
    spotifyAlbumId: recommendation.spotifyAlbumId,
    spotifyAlbumName: recommendation.spotifyAlbumName,
    spotifyArtistName: recommendation.spotifyArtistName,
  };
}

async function generateVerifiedRecommendation(
  uid: string,
  requestId: string,
): Promise<CurrentRecommendationInput | null> {
  const ratings = await listAlbumRatingsForUser(uid);
  console.info("[api/recommendation] ratings_loaded", { requestId, uid, ratingsCount: ratings.length });

  if (ratings.length === 0) {
    console.warn("[api/recommendation] no_ratings_found", { requestId, uid });
    return null;
  }

  console.info("[api/recommendation] generation_attempt_started", { requestId, attempt: 1 });
  const firstDraft = await generateBoomieRecommendation(ratings);
  console.info("[api/recommendation] generation_attempt_finished", {
    requestId,
    attempt: 1,
    albumName: firstDraft.recommendedAlbumName,
    artistName: firstDraft.recommendedArtistName,
  });

  console.info("[api/recommendation] spotify_lookup_started", {
    requestId,
    attempt: 1,
    albumName: firstDraft.recommendedAlbumName,
    artistName: firstDraft.recommendedArtistName,
  });
  const firstAlbum = await findSpotifyAlbum(firstDraft.recommendedAlbumName, firstDraft.recommendedArtistName);
  console.info("[api/recommendation] spotify_lookup_finished", {
    requestId,
    attempt: 1,
    matched: Boolean(firstAlbum),
    spotifyAlbumId: firstAlbum?.id,
  });

  let finalDraft = firstDraft;
  let finalAlbum = firstAlbum;

  if (!finalAlbum) {
    console.warn("[api/recommendation] retry_started", { requestId, previousAttempt: 1 });
    const retryDraft = await generateBoomieRecommendation(ratings, {
      extraInstructions: [
        `Do not recommend "${firstDraft.recommendedAlbumName}" by "${firstDraft.recommendedArtistName}".`,
        "Choose a widely released album by a well-known artist and spell artist and album exactly.",
      ],
    });
    console.info("[api/recommendation] generation_attempt_finished", {
      requestId,
      attempt: 2,
      albumName: retryDraft.recommendedAlbumName,
      artistName: retryDraft.recommendedArtistName,
    });

    console.info("[api/recommendation] spotify_lookup_started", {
      requestId,
      attempt: 2,
      albumName: retryDraft.recommendedAlbumName,
      artistName: retryDraft.recommendedArtistName,
    });
    const retryAlbum = await findSpotifyAlbum(retryDraft.recommendedAlbumName, retryDraft.recommendedArtistName);
    console.info("[api/recommendation] spotify_lookup_finished", {
      requestId,
      attempt: 2,
      matched: Boolean(retryAlbum),
      spotifyAlbumId: retryAlbum?.id,
    });
    if (retryAlbum) {
      finalDraft = retryDraft;
      finalAlbum = retryAlbum;
      console.info("[api/recommendation] retry_succeeded", { requestId, spotifyAlbumId: retryAlbum.id });
    }
  }

  if (!finalAlbum) {
    console.error("[api/recommendation] spotify_verification_failed", { requestId, uid });
    throw new Error("Could not verify a Spotify album for the recommendation. Please try again.");
  }

  return {
    tagline: finalDraft.tagline,
    albumDescription: finalDraft.albumDescription,
    whyForUser: finalDraft.whyForUser,
    spotifyAlbumImageUrl: finalAlbum.imageUrl,
    spotifyAlbumId: finalAlbum.id,
    spotifyAlbumName: finalAlbum.name,
    spotifyArtistName: finalAlbum.artistName,
  };
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  console.info("[api/recommendation][get] request_started", { requestId });

  try {
    const uid = await verifyFirebaseTokenFromRequest(request);
    console.info("[api/recommendation][get] auth_verified", { requestId, uid });

    const savedRecommendation = await getCurrentRecommendationForUser(uid);
    if (savedRecommendation) {
      console.info("[api/recommendation][get] served_saved_recommendation", {
        requestId,
        uid,
        spotifyAlbumId: savedRecommendation.spotifyAlbumId,
      });
      return NextResponse.json(toRecommendationResponse(savedRecommendation));
    }

    const generated = await generateVerifiedRecommendation(uid, requestId);
    if (!generated) {
      return NextResponse.json(
        { error: "Add at least one album rating before requesting a recommendation." },
        { status: 400 },
      );
    }

    const persisted = await upsertCurrentRecommendationForUser(uid, generated);
    console.info("[api/recommendation][get] generated_and_persisted", {
      requestId,
      uid,
      spotifyAlbumId: persisted.spotifyAlbumId,
    });
    return NextResponse.json(toRecommendationResponse(persisted));
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      console.warn("[api/recommendation][get] unauthorized", { requestId, error: error.message });
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "Failed to fetch recommendation";
    const statusCode = message.includes("Could not verify a Spotify album") ? 502 : 500;
    console.error("[api/recommendation][get] request_failed", { requestId, error: message, statusCode });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  console.info("[api/recommendation][post] request_started", { requestId });

  try {
    const uid = await verifyFirebaseTokenFromRequest(request);
    console.info("[api/recommendation][post] auth_verified", { requestId, uid });

    const generated = await generateVerifiedRecommendation(uid, requestId);
    if (!generated) {
      return NextResponse.json(
        { error: "Add at least one album rating before requesting a recommendation." },
        { status: 400 },
      );
    }

    const persisted = await upsertCurrentRecommendationForUser(uid, generated);
    console.info("[api/recommendation][post] request_succeeded", {
      requestId,
      uid,
      spotifyAlbumId: persisted.spotifyAlbumId,
      spotifyAlbumName: persisted.spotifyAlbumName,
      spotifyArtistName: persisted.spotifyArtistName,
    });
    return NextResponse.json(toRecommendationResponse(persisted));
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      console.warn("[api/recommendation][post] unauthorized", { requestId, error: error.message });
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "Failed to generate recommendation";
    const statusCode = message.includes("Could not verify a Spotify album") ? 502 : 500;
    console.error("[api/recommendation][post] request_failed", {
      requestId,
      error: message,
      statusCode,
    });
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
