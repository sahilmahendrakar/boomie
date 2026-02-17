import { google } from "@ai-sdk/google";
import { generateText, Output, stepCountIs, tool } from "ai";
import { z } from "zod";

import { type AlbumRating } from "@/lib/ratings/types";
import { searchSpotifyAlbums } from "@/lib/spotify/client";
import { getUserGoalLabel, type UserGoalsInput } from "@/lib/user-goals/types";

const boomieRecommendationSchema = z.object({
  tagline: z.string().min(1),
  albumDescription: z.string().min(1),
  whyForUser: z.string().min(1),
  spotifyAlbumId: z.string().min(1),
});

export type BoomieRecommendationDraft = z.infer<typeof boomieRecommendationSchema>;

function getHistoryPrompt(history: AlbumRating[]): string {
  return history
    .map((entry, index) => {
      const trimmedNotes = entry.notes.trim();
      const notesSection = trimmedNotes.length > 0 ? `Notes: ${trimmedNotes}` : "Notes: (none)";
      return `${index + 1}. Album: ${entry.albumName}\nRating: ${entry.rating}\n${notesSection}`;
    })
    .join("\n\n");
}

type UserGoalsContext = Pick<UserGoalsInput, "selectedGoals" | "notes">;

function getBoomiePrompt(
  history: AlbumRating[],
  extraInstructions: string[] = [],
  userGoalsContext?: UserGoalsContext,
): string {
  const hasHistory = history.length > 0;
  const listenedAlbums = history.map((entry) => entry.albumName).join(", ");
  const goalLabels = userGoalsContext?.selectedGoals.map((goalId) => getUserGoalLabel(goalId)).join("; ");
  const trimmedGoalNotes = userGoalsContext?.notes.trim() ?? "";
  const historyPrompt = hasHistory ? getHistoryPrompt(history) : "(none yet)";

  return [
    "You are Boomie, an expert music recommendation agent helping users on a long-term musical journey.",
    "Pick exactly one album recommendation and verify it exists on Spotify before finalizing output.",
    "Recommendation rules:",
    "- Use `searchAlbums` only to verify specific album recommendations by album name (and artist when known).",
    "- Return exactly one recommendation and only the schema fields.",
    "- Ensure users are listening to a variety of music. You can recommend albums that are very different from what they're history is, or you can help them deepen their existing tastes.",
    "- `tagline` can be personalized, and should be 60 characters or fewer. It should end in ...",
    "- `albumDescription` must be 2-4 sentences and 2000 characters or fewer.",
    "- `whyForUser` should be 1-3 sentences and 1200 characters or fewer.",
    "- Do not include markdown, bullet points, emojis, or line breaks in any field.",
    "- Keep language concise and specific.",
    ...(hasHistory
      ? ["- Never recommend an album already in the user's history.", `- User already listened to: ${listenedAlbums}.`]
      : [
          "- The user has no prior listening history yet. Choose a broadly strong starter album and personalize with user goals and notes when available.",
        ]),
    ...(goalLabels ? [`- User goals: ${goalLabels}.`] : []),
    ...(trimmedGoalNotes ? [`- User goal notes: ${trimmedGoalNotes}`] : []),
    ...extraInstructions.map((instruction) => `- ${instruction}`),
    "",
    "User rating history:",
    historyPrompt,
  ].join("\n");
}

function getCandidateListPrompt(candidates: Array<{ id: string; name: string; artistName: string }>): string {
  return candidates.map((candidate, index) => `${index + 1}. ${candidate.name} — ${candidate.artistName} (id: ${candidate.id})`).join("\n");
}

function getVerificationPrompt(
  history: AlbumRating[],
  extraInstructions: string[] = [],
  userGoalsContext?: UserGoalsContext,
): string {
  const hasHistory = history.length > 0;

  return [
    getBoomiePrompt(history, extraInstructions, userGoalsContext),
    "",
    "Verification instructions:",
    ...(hasHistory
      ? ["- First decide a concrete album recommendation candidate based on the user's rating history."]
      : ["- First decide a concrete starter album recommendation candidate using user goals/notes and broad appeal."]),
    "- Call `searchAlbums` with an album-title query (optionally include artist), for example: `Brown Sugar D'Angelo`.",
    "- Do not call `searchAlbums` with genre, vibe, mood, or era terms.",
    "- If the search has no suitable album result, choose a different album recommendation and search again.",
    "- Stop once you have at least one valid Spotify album candidate to choose from.",
  ].join("\n");
}

function collectAlbumCandidates(steps: Array<{ toolResults?: Array<{ toolName: string; output: unknown }> }>) {
  const unique = new Map<string, { id: string; name: string; artistName: string }>();

  for (const step of steps) {
    for (const result of step.toolResults ?? []) {
      if (result.toolName !== "searchAlbums" || typeof result.output !== "object" || !result.output) {
        continue;
      }

      const albums = (result.output as { albums?: unknown }).albums;
      if (!Array.isArray(albums)) {
        continue;
      }

      for (const album of albums) {
        if (!album || typeof album !== "object") {
          continue;
        }

        const id = (album as { id?: unknown }).id;
        const name = (album as { name?: unknown }).name;
        const artistName = (album as { artistName?: unknown }).artistName;
        if (typeof id !== "string" || typeof name !== "string" || typeof artistName !== "string") {
          continue;
        }

        unique.set(id, { id, name, artistName });
      }
    }
  }

  return Array.from(unique.values());
}

function getGenerationErrorDebug(error: unknown): { message: string; rawText?: string; finishReason?: string } {
  const message = error instanceof Error ? error.message : "Unknown generation error";

  if (!error || typeof error !== "object") {
    return { message };
  }

  const rawText = "text" in error && typeof error.text === "string" ? error.text : undefined;
  const finishReason =
    "finishReason" in error && typeof error.finishReason === "string" ? error.finishReason : undefined;

  return { message, rawText, finishReason };
}

export async function generateBoomieRecommendation(
  history: AlbumRating[],
  options?: { extraInstructions?: string[]; userGoalsContext?: UserGoalsContext },
): Promise<BoomieRecommendationDraft> {
  console.info("[agent/boomie] generation_started", {
    historyCount: history.length,
    extraInstructionsCount: options?.extraInstructions?.length ?? 0,
    userGoalsCount: options?.userGoalsContext?.selectedGoals.length ?? 0,
  });

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error("[agent/boomie] missing_api_key");
    throw new Error("Missing required environment variable: GOOGLE_GENERATIVE_AI_API_KEY");
  }

  const tools = {
    searchAlbums: tool({
      description: "Verify album recommendations by searching Spotify using album-name queries.",
      inputSchema: z.object({
        query: z
          .string()
          .min(2)
          .max(200)
          .describe("Album-title search text, optionally with artist (e.g., 'Discovery Daft Punk')."),
        limit: z.number().int().min(1).max(10).optional().describe("Number of album candidates to return."),
      }),
      execute: async ({ query, limit }) => {
        const albums = await searchSpotifyAlbums(query, limit ?? 5);
        return {
          albums: albums.map((album) => ({
            id: album.id,
            name: album.name,
            artistName: album.artistName,
          })),
        };
      },
    }),
  };

  const verificationPrompt = getVerificationPrompt(history, options?.extraInstructions, options?.userGoalsContext);
  const verification = await generateText({
    model: google("gemini-3-flash-preview"),
    tools,
    stopWhen: stepCountIs(3),
    prepareStep: async ({ stepNumber }) => ({
      toolChoice: stepNumber === 0 ? "required" : "auto",
    }),
    prompt: verificationPrompt,
  });

  const candidates = collectAlbumCandidates(verification.steps).slice(0, 30);
  if (candidates.length === 0) {
    throw new Error("Could not verify a Spotify album candidate. Please try again.");
  }

  const selectionPrompt = [
    getBoomiePrompt(history, options?.extraInstructions, options?.userGoalsContext),
    "",
    "Choose one album from the candidate list below and set `spotifyAlbumId` to that exact id.",
    "Candidate albums:",
    getCandidateListPrompt(candidates),
  ].join("\n");

  let output: BoomieRecommendationDraft;
  try {
    const result = await generateText({
      model: google("gemini-3-flash-preview"),
      output: Output.object({
        schema: boomieRecommendationSchema,
      }),
      prompt: selectionPrompt,
    });
    output = result.output;
  } catch (error) {
    const debug = getGenerationErrorDebug(error);
    console.error("[agent/boomie] structured_output_failed", {
      message: debug.message,
      finishReason: debug.finishReason,
      rawText: debug.rawText,
    });
    throw error;
  }

  console.info("[agent/boomie] generation_finished", {
    spotifyAlbumId: output.spotifyAlbumId,
    promptLength: selectionPrompt.length,
  });
  return output;
}
