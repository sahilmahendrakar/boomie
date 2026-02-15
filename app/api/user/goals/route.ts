import { NextRequest, NextResponse } from "next/server";

import { UnauthorizedError, verifyFirebaseTokenFromRequest } from "@/lib/auth/verify-firebase-token";
import { getUserGoals, upsertUserGoals } from "@/lib/user-goals/repository";
import { USER_GOAL_OPTIONS, type UserGoalId } from "@/lib/user-goals/constants";
import { type UserGoalsInput } from "@/lib/user-goals/types";

class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

const ALLOWED_GOAL_IDS = new Set<UserGoalId>(USER_GOAL_OPTIONS.map((option) => option.id));

function validateGoalsPayload(payload: unknown): UserGoalsInput {
  if (!payload || typeof payload !== "object") {
    throw new BadRequestError("Invalid request body");
  }

  const { selectedGoals, notes } = payload as {
    selectedGoals?: unknown;
    notes?: unknown;
  };

  if (!Array.isArray(selectedGoals) || selectedGoals.length === 0) {
    throw new BadRequestError("selectedGoals must be a non-empty array");
  }

  const normalizedGoals = Array.from(
    new Set(
      selectedGoals.map((goal) => {
        if (typeof goal !== "string" || !ALLOWED_GOAL_IDS.has(goal as UserGoalId)) {
          throw new BadRequestError("selectedGoals contains one or more invalid goal ids");
        }
        return goal as UserGoalId;
      }),
    ),
  );

  if (notes !== undefined && typeof notes !== "string") {
    throw new BadRequestError("notes must be a string when provided");
  }

  const normalizedNotes = typeof notes === "string" ? notes.trim() : "";
  if (normalizedNotes.length > 1000) {
    throw new BadRequestError("notes must be 1000 characters or fewer");
  }

  return {
    selectedGoals: normalizedGoals,
    notes: normalizedNotes,
  };
}

export async function GET(request: NextRequest) {
  try {
    const uid = await verifyFirebaseTokenFromRequest(request);
    const goals = await getUserGoals(uid);
    return NextResponse.json({ goals });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ error: "Failed to fetch user goals" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const uid = await verifyFirebaseTokenFromRequest(request);
    const body = await request.json();
    const payload = validateGoalsPayload(body);

    const goals = await upsertUserGoals(uid, payload);
    return NextResponse.json({ goals }, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof BadRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to persist user goals" }, { status: 500 });
  }
}
