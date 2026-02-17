import { NextRequest, NextResponse } from "next/server";

import { generateBoomieRecommendation } from "@/lib/agent/boomie";
import { UnauthorizedError, verifyFirebaseTokenFromRequest } from "@/lib/auth/verify-firebase-token";
import {
  createRecommendationHistoryEntryForUser,
  getCurrentRecommendationForUser,
  upsertCurrentRecommendationForUser,
} from "@/lib/recommendations/repository";
import { type CurrentRecommendationInput } from "@/lib/recommendations/types";
import { listAlbumRatingsForUser } from "@/lib/ratings/repository";
import { getSpotifyAlbumById } from "@/lib/spotify/client";
import { getUserGoals } from "@/lib/user-goals/repository";

class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

type RecommendationPostPayload = {
  nextPickSteering: string;
};

async function parseRecommendationPostPayload(request: NextRequest): Promise<RecommendationPostPayload> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    throw new BadRequestError("Invalid request body");
  }

  if (!payload || typeof payload !== "object") {
    throw new BadRequestError("Invalid request body");
  }

  const { nextPickSteering } = payload as { nextPickSteering?: unknown };
  if (nextPickSteering !== undefined && typeof nextPickSteering !== "string") {
    throw new BadRequestError("nextPickSteering must be a string when provided");
  }

  const normalizedSteering = typeof nextPickSteering === "string" ? nextPickSteering.trim() : "";

  return {
    nextPickSteering: normalizedSteering,
  };
}

function toRecommendationResponse(recommendation: CurrentRecommendationInput) {
  return {
    recommendationId: recommendation.recommendationId,
    tagline: recommendation.tagline,
    albumDescription: recommendation.albumDescription,
    whyForUser: recommendation.whyForUser,
    spotifyAlbumImageUrl: recommendation.spotifyAlbumImageUrl,
    spotifyAlbumId: recommendation.spotifyAlbumId,
    spotifyAlbumName: recommendation.spotifyAlbumName,
    spotifyArtistName: recommendation.spotifyArtistName,
    spotifyArtistImageUrl: recommendation.spotifyArtistImageUrl,
  };
}

async function generateVerifiedRecommendation(
  uid: string,
  requestId: string,
  extraInstructions?: string[],
): Promise<CurrentRecommendationInput> {
  const ratings = await listAlbumRatingsForUser(uid);
  const userGoals = await getUserGoals(uid);
  console.info("[api/recommendation] ratings_loaded", { requestId, uid, ratingsCount: ratings.length });

  if (ratings.length === 0) {
    console.info("[api/recommendation] no_ratings_found_continuing_with_cold_start", { requestId, uid });
  }

  const generationExtraInstructions = [
    ...(extraInstructions ?? []),
    ...(ratings.length === 0
      ? [
          "The user has no prior album ratings yet. Treat this as a cold start and make a strong starter recommendation using any available user goals and notes.",
        ]
      : []),
  ];

  console.info("[api/recommendation] generation_started", { requestId });
  const draft = await generateBoomieRecommendation(ratings, {
    extraInstructions: generationExtraInstructions.length > 0 ? generationExtraInstructions : undefined,
    userGoalsContext: userGoals
      ? {
          selectedGoals: userGoals.selectedGoals,
          notes: userGoals.notes,
        }
      : undefined,
  });
  console.info("[api/recommendation] generation_finished", {
    requestId,
    spotifyAlbumId: draft.spotifyAlbumId,
  });

  console.info("[api/recommendation] spotify_hydration_started", { requestId, spotifyAlbumId: draft.spotifyAlbumId });
  const album = await getSpotifyAlbumById(draft.spotifyAlbumId);
  console.info("[api/recommendation] spotify_hydration_finished", {
    requestId,
    matched: Boolean(album),
    spotifyAlbumId: draft.spotifyAlbumId,
  });

  if (!album) {
    console.error("[api/recommendation] spotify_hydration_failed", { requestId, uid, spotifyAlbumId: draft.spotifyAlbumId });
    throw new Error("Could not verify a Spotify album for the recommendation. Please try again.");
  }

  return {
    recommendationId: "",
    tagline: draft.tagline,
    albumDescription: draft.albumDescription,
    whyForUser: draft.whyForUser,
    spotifyAlbumImageUrl: album.imageUrl,
    spotifyAlbumId: album.id,
    spotifyAlbumName: album.name,
    spotifyArtistName: album.artistName,
    spotifyArtistImageUrl: album.artistImageUrl,
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
      if (!savedRecommendation.recommendationId) {
        const historyEntry = await createRecommendationHistoryEntryForUser(uid, savedRecommendation);
        const updatedCurrent = await upsertCurrentRecommendationForUser(uid, {
          ...savedRecommendation,
          recommendationId: historyEntry.id,
        });
        return NextResponse.json(toRecommendationResponse(updatedCurrent));
      }

      console.info("[api/recommendation][get] served_saved_recommendation", {
        requestId,
        uid,
        spotifyAlbumId: savedRecommendation.spotifyAlbumId,
      });
      return NextResponse.json(toRecommendationResponse(savedRecommendation));
    }

    const generated = await generateVerifiedRecommendation(uid, requestId);
    const historyEntry = await createRecommendationHistoryEntryForUser(uid, generated);
    const persisted = await upsertCurrentRecommendationForUser(uid, {
      ...generated,
      recommendationId: historyEntry.id,
    });
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

    const payload = await parseRecommendationPostPayload(request);
    const extraInstructions =
      payload.nextPickSteering.length > 0
        ? [`Use this optional preference for the next pick only: ${payload.nextPickSteering}`]
        : undefined;
    const generated = await generateVerifiedRecommendation(uid, requestId, extraInstructions);
    const historyEntry = await createRecommendationHistoryEntryForUser(uid, generated);
    const persisted = await upsertCurrentRecommendationForUser(uid, {
      ...generated,
      recommendationId: historyEntry.id,
    });
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

    if (error instanceof BadRequestError) {
      console.warn("[api/recommendation][post] bad_request", { requestId, error: error.message });
      return NextResponse.json({ error: error.message }, { status: 400 });
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
