import { NextRequest } from "next/server";

import { firebaseAdminAuth } from "@/lib/firebase-admin";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

function getBearerToken(authorizationHeader: string | null): string {
  if (!authorizationHeader) {
    throw new UnauthorizedError("Missing authorization header");
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new UnauthorizedError("Invalid authorization header format");
  }

  return token;
}

export async function verifyFirebaseTokenFromRequest(request: NextRequest): Promise<string> {
  const token = getBearerToken(request.headers.get("authorization"));

  try {
    const decodedToken = await firebaseAdminAuth.verifyIdToken(token);
    return decodedToken.uid;
  } catch {
    throw new UnauthorizedError("Invalid Firebase ID token");
  }
}
