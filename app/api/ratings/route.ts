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

  const { albumName, rating, notes } = payload as {
    albumName?: unknown;
    rating?: unknown;
    notes?: unknown;
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

  const normalizedRating = rating as AlbumRatingInput["rating"];

  return {
    albumName: albumName.trim(),
    rating: normalizedRating,
    notes: typeof notes === "string" ? notes.trim() : "",
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
  try {
    const uid = await verifyFirebaseTokenFromRequest(request);
    const body = await request.json();
    const payload = validateRatingPayload(body);

    const rating = await upsertAlbumRatingForUser(uid, payload);
    return NextResponse.json({ rating }, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof BadRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to persist rating" }, { status: 500 });
  }
}
