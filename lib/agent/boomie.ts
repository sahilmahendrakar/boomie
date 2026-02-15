import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";

import { type AlbumRating } from "@/lib/ratings/types";

const boomieRecommendationSchema = z.object({
  recommendedAlbumName: z.string().min(1).max(200),
  recommendedArtistName: z.string().min(1).max(200),
  tagline: z.string().min(1).max(120),
  albumDescription: z.string().min(1).max(1200),
  whyForUser: z.string().min(1).max(500),
});

export type BoomieRecommendationDraft = z.infer<typeof boomieRecommendationSchema>;

function getHistoryPrompt(history: AlbumRating[]): string {
  return history
    .map((entry, index) => {
      const trimmedNotes = entry.notes.trim();
      const notesSection = trimmedNotes.length > 0 ? `Notes: ${trimmedNotes}` : "Notes: (none)";
      return `${index + 1}. Album: ${entry.albumName}\nRating: ${entry.rating}/5\n${notesSection}`;
    })
    .join("\n\n");
}

function getBoomiePrompt(history: AlbumRating[], extraInstructions: string[] = []): string {
  return [
    "You are Boomie, an expert music recommendation agent.",
    "Pick one album recommendation based on the user's album rating history.",
    "Recommendation rules:",
    "- Recommend only one album.",
    "- Do not recommend an album that already appears in the user's history.",
    "- Return mainstream and searchable album/artist names so a Spotify search can find them reliably.",
    "- Write `albumDescription` as 2-3 sentences.",
    "- Write `whyForUser` as exactly 1 sentence.",
    "- Keep language concise and specific.",
    ...extraInstructions.map((instruction) => `- ${instruction}`),
    "",
    "User rating history:",
    getHistoryPrompt(history),
  ].join("\n");
}

export async function generateBoomieRecommendation(
  history: AlbumRating[],
  options?: { extraInstructions?: string[] },
): Promise<BoomieRecommendationDraft> {
  console.info("[agent/boomie] generation_started", {
    historyCount: history.length,
    extraInstructionsCount: options?.extraInstructions?.length ?? 0,
  });

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error("[agent/boomie] missing_api_key");
    throw new Error("Missing required environment variable: GOOGLE_GENERATIVE_AI_API_KEY");
  }

  const prompt = getBoomiePrompt(history, options?.extraInstructions);
  const { output } = await generateText({
    model: google("gemini-2.5-flash"),
    output: Output.object({
      schema: boomieRecommendationSchema,
    }),
    prompt,
  });

  console.info("[agent/boomie] generation_finished", {
    recommendedAlbumName: output.recommendedAlbumName,
    recommendedArtistName: output.recommendedArtistName,
    promptLength: prompt.length,
  });
  return output;
}
