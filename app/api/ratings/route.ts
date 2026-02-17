import { NextRequest, NextResponse } from "next/server";

import { UnauthorizedError, verifyFirebaseTokenFromRequest } from "@/lib/auth/verify-firebase-token";
import { listAlbumRatingsForUser, upsertAlbumRatingForUser } from "@/lib/ratings/repository";
import { ALBUM_RATING_IDS, type AlbumRatingInput } from "@/lib/ratings/types";

class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

function validateRatingPayload(payload: unknown): AlbumRatingInput {
  if (!payload || typeof payload !== "object") {
    throw new BadRequestError("Invalid request body");
  }

  const {
    albumName,
    rating,
    notes,
    recommendationId,
    spotifyAlbumId,
    spotifyAlbumImageUrl,
    spotifyArtistName,
    spotifyArtistImageUrl,
  } = payload as {
    albumName?: unknown;
    rating?: unknown;
    notes?: unknown;
    recommendationId?: unknown;
    spotifyAlbumId?: unknown;
    spotifyAlbumImageUrl?: unknown;
    spotifyArtistName?: unknown;
    spotifyArtistImageUrl?: unknown;
  };

  if (typeof albumName !== "string" || albumName.trim().length === 0 || albumName.length > 200) {
    throw new BadRequestError("albumName must be a non-empty string up to 200 characters");
  }

  if (typeof rating !== "string" || !ALBUM_RATING_IDS.includes(rating as (typeof ALBUM_RATING_IDS)[number])) {
    throw new BadRequestError(`rating must be one of: ${ALBUM_RATING_IDS.join(", ")}`);
  }

  if (notes !== undefined && typeof notes !== "string") {
    throw new BadRequestError("notes must be a string when provided");
  }

  if (typeof notes === "string" && notes.length > 2000) {
    throw new BadRequestError("notes must be 2000 characters or fewer");
  }

  if (recommendationId !== undefined && typeof recommendationId !== "string") {
    throw new BadRequestError("recommendationId must be a string when provided");
  }
  if (spotifyAlbumId !== undefined && typeof spotifyAlbumId !== "string") {
    throw new BadRequestError("spotifyAlbumId must be a string when provided");
  }
  if (spotifyAlbumImageUrl !== undefined && typeof spotifyAlbumImageUrl !== "string") {
    throw new BadRequestError("spotifyAlbumImageUrl must be a string when provided");
  }
  if (spotifyArtistName !== undefined && typeof spotifyArtistName !== "string") {
    throw new BadRequestError("spotifyArtistName must be a string when provided");
  }
  if (spotifyArtistImageUrl !== undefined && typeof spotifyArtistImageUrl !== "string") {
    throw new BadRequestError("spotifyArtistImageUrl must be a string when provided");
  }

  const normalizedRating = rating as AlbumRatingInput["rating"];

  return {
    albumName: albumName.trim(),
    rating: normalizedRating,
    notes: typeof notes === "string" ? notes.trim() : "",
    recommendationId: typeof recommendationId === "string" ? recommendationId.trim() : "",
    spotifyAlbumId: typeof spotifyAlbumId === "string" ? spotifyAlbumId.trim() : "",
    spotifyAlbumImageUrl: typeof spotifyAlbumImageUrl === "string" ? spotifyAlbumImageUrl.trim() : "",
    spotifyArtistName: typeof spotifyArtistName === "string" ? spotifyArtistName.trim() : "",
    spotifyArtistImageUrl: typeof spotifyArtistImageUrl === "string" ? spotifyArtistImageUrl.trim() : "",
  };
}

export async function GET(request: NextRequest) {
  try {
    const uid = await verifyFirebaseTokenFromRequest(request);
    const ratings = await listAlbumRatingsForUser(uid);

    return NextResponse.json({ ratings });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ error: "Failed to fetch ratings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const uid = await verifyFirebaseTokenFromRequest(request);
    const body = await request.json();
    const payload = validateRatingPayload(body);
    console.info("[api/ratings][post] payload_validated", {
      requestId,
      uid,
      albumName: payload.albumName,
      rating: payload.rating,
      recommendationId: payload.recommendationId,
      hasSpotifyAlbumId: payload.spotifyAlbumId.length > 0,
      hasSpotifyAlbumImageUrl: payload.spotifyAlbumImageUrl.length > 0,
      hasSpotifyArtistName: payload.spotifyArtistName.length > 0,
      hasSpotifyArtistImageUrl: payload.spotifyArtistImageUrl.length > 0,
      notesLength: payload.notes.length,
    });

    const rating = await upsertAlbumRatingForUser(uid, payload);
    console.info("[api/ratings][post] rating_persisted", {
      requestId,
      uid,
      ratingId: rating.id,
      recommendationId: rating.recommendationId,
    });
    return NextResponse.json({ rating }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[api/ratings][post] request_failed", {
      requestId,
      error: message,
      stack,
    });

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof BadRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to persist rating" }, { status: 500 });
  }
}
