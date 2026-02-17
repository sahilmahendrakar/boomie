"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";

import { firebaseClientAuth } from "@/lib/firebase-client";
import { ALBUM_RATING_IDS, type AlbumRatingId } from "@/lib/ratings/types";

type RecommendationDetail = {
  id: string;
  recommendationId: string;
  tagline: string;
  albumDescription: string;
  whyForUser: string;
  spotifyAlbumId: string;
  spotifyAlbumName: string;
  spotifyAlbumImageUrl: string;
  spotifyArtistName: string;
  spotifyArtistImageUrl: string;
  createdAt: string;
  updatedAt: string;
};

type RecommendationRating = {
  id: string;
  rating: AlbumRatingId;
  notes: string;
  updatedAt: string;
} | null;

type DetailResponse = {
  recommendation?: RecommendationDetail;
  rating?: RecommendationRating;
  error?: string;
};

const ratingLabels: Record<AlbumRatingId, string> = {
  hated: "Hated it",
  disliked: "Disliked",
  neutral: "Neutral",
  liked: "Liked it",
  loved: "Loved it",
  "did-not-listen": "Did not listen",
};

const ratingEmoji: Record<AlbumRatingId, string> = {
  hated: "😖",
  disliked: "🙃",
  neutral: "😐",
  liked: "🙂",
  loved: "🤩",
  "did-not-listen": "🫥",
};

export default function RecommendationDetailPage() {
  const router = useRouter();
  const params = useParams<{ recommendationId: string }>();
  const recommendationId = typeof params.recommendationId === "string" ? params.recommendationId : "";

  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingRating, setIsEditingRating] = useState(false);
  const [recommendation, setRecommendation] = useState<RecommendationDetail | null>(null);
  const [rating, setRating] = useState<RecommendationRating>(null);
  const [selectedRating, setSelectedRating] = useState<AlbumRatingId | "">("");
  const [notes, setNotes] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const spotifyAlbumUrl = useMemo(() => {
    if (!recommendation?.spotifyAlbumId) {
      return "https://open.spotify.com/";
    }
    return `https://open.spotify.com/album/${recommendation.spotifyAlbumId}`;
  }, [recommendation]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseClientAuth, (nextUser) => {
      setUser(nextUser);
      setIsAuthLoading(false);
      if (!nextUser) {
        router.replace("/landing");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const loadDetail = useCallback(async (): Promise<void> => {
    if (!user || !recommendationId) {
      return;
    }

    setIsLoading(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/recommendations/history/${recommendationId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const body = (await response.json()) as DetailResponse;
      if (!response.ok || !body.recommendation) {
        throw new Error(body.error ?? "Failed to load recommendation");
      }

      setRecommendation(body.recommendation);
      setRating(body.rating ?? null);
      setSelectedRating(body.rating?.rating ?? "");
      setNotes(body.rating?.notes ?? "");
      setIsEditingRating(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load recommendation";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [user, recommendationId]);

  useEffect(() => {
    if (!isAuthLoading && user && recommendationId) {
      void loadDetail();
    }
  }, [isAuthLoading, user, recommendationId, loadDetail]);

  async function saveRating(): Promise<void> {
    if (!user || !recommendation) {
      return;
    }
    if (!selectedRating) {
      setErrorMessage("Select a rating before saving.");
      return;
    }

    setIsSaving(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/ratings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          albumName: recommendation.spotifyAlbumName,
          rating: selectedRating,
          notes,
          recommendationId: recommendation.recommendationId,
          spotifyAlbumId: recommendation.spotifyAlbumId,
          spotifyAlbumImageUrl: recommendation.spotifyAlbumImageUrl,
          spotifyArtistName: recommendation.spotifyArtistName,
          spotifyArtistImageUrl: recommendation.spotifyArtistImageUrl,
        }),
      });

      const body = (await response.json()) as { error?: string; rating?: RecommendationRating };
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to save rating");
      }

      if (body.rating) {
        setRating(body.rating);
        setSelectedRating(body.rating.rating);
        setNotes(body.rating.notes);
      } else {
        setRating({
          id: recommendation.recommendationId,
          rating: selectedRating,
          notes,
          updatedAt: new Date().toISOString(),
        });
      }
      setIsEditingRating(false);
      setStatusMessage("Rating updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save rating";
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  }

  if (isAuthLoading || isLoading) {
    return (
      <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950 sm:px-10">
        <div className="mx-auto flex min-h-[80vh] w-full max-w-3xl items-center justify-center">
          <section className="w-full rounded-[2rem] border-2 border-black bg-white px-8 py-12 text-center shadow-[10px_10px_0px_0px_#000]">
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-zinc-500">Loading recommendation</p>
            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">Pulling your saved pick...</h1>
          </section>
        </div>
      </main>
    );
  }

  if (!recommendation) {
    return (
      <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950 sm:px-10">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <button
            type="button"
            onClick={() => router.push("/profile")}
            className="self-start rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700"
          >
            Back to profile
          </button>
          <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {errorMessage || "Recommendation not found."}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950 sm:px-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <button
          type="button"
          onClick={() => router.push("/profile")}
          className="self-start rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
        >
          Back to history
        </button>

        <header className="space-y-2 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-zinc-500">Saved recommendation</p>
          <h1 className="text-3xl font-black leading-tight sm:text-5xl">{recommendation.tagline}</h1>
        </header>

        <section className="w-full max-w-md self-center">
          <div className="relative overflow-hidden rounded-3xl border-2 border-black bg-white shadow-[6px_6px_0px_0px_#000]">
            {recommendation.spotifyAlbumImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Dynamic image URLs.
              <img
                src={recommendation.spotifyAlbumImageUrl}
                alt={`${recommendation.spotifyAlbumName} cover art`}
                className="aspect-square h-full w-full object-cover"
              />
            ) : (
              <div className="aspect-square bg-[radial-gradient(circle_at_25%_20%,_#c4b5fd,_#ffffff_55%)]" />
            )}
          </div>
        </section>

        <section className="space-y-1 text-center">
          <h2 className="text-3xl font-black sm:text-4xl">{recommendation.spotifyAlbumName}</h2>
          <p className="text-lg font-semibold text-zinc-700">{recommendation.spotifyArtistName}</p>
          <a
            href={spotifyAlbumUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open album in Spotify"
            className="mx-auto inline-flex items-center justify-center transition hover:scale-105"
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
              <circle cx="12" cy="12" r="11" fill="#1DB954" />
              <path d="M6.2 9.4c3.8-1.1 8.2-.8 11.6 1" stroke="#121212" strokeWidth="1.7" strokeLinecap="round" fill="none" />
              <path d="M6.9 12.2c3.1-.8 6.6-.6 9.5.8" stroke="#121212" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              <path d="M7.7 14.8c2.4-.6 5-.4 7.2.6" stroke="#121212" strokeWidth="1.4" strokeLinecap="round" fill="none" />
            </svg>
          </a>
        </section>

        <section className="w-full rounded-3xl border-2 border-black bg-white p-5 text-left shadow-[6px_6px_0px_0px_#000] sm:p-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">About this album</h3>
          <p className="mt-3 text-sm leading-6 text-zinc-700">{recommendation.albumDescription}</p>
          <h4 className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Why this for you</h4>
          <p className="mt-2 text-sm leading-6 text-zinc-700">{recommendation.whyForUser}</p>
        </section>

        <section className="w-full rounded-3xl border-2 border-black bg-white p-5 shadow-[6px_6px_0px_0px_#000] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Your rating</h3>
            {!isEditingRating ? (
              <button
                type="button"
                onClick={() => setIsEditingRating(true)}
                aria-label="Edit rating"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700 transition hover:bg-zinc-100"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M4 20h4l10-10a1.4 1.4 0 0 0 0-2l-2-2a1.4 1.4 0 0 0-2 0L4 16v4z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ) : null}
          </div>

          {!isEditingRating ? (
            <div className="mt-3 rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3">
              {rating ? (
                <>
                  <p className="text-base font-semibold text-zinc-900">
                    {ratingEmoji[rating.rating]} {ratingLabels[rating.rating]}
                  </p>
                  {rating.notes ? <p className="mt-2 text-sm leading-6 text-zinc-700">{rating.notes}</p> : null}
                </>
              ) : (
                <p className="text-sm font-medium text-zinc-600">No rating saved yet.</p>
              )}
            </div>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ALBUM_RATING_IDS.map((ratingId) => {
                  const isActive = selectedRating === ratingId;
                  return (
                    <button
                      key={ratingId}
                      type="button"
                      onClick={() => setSelectedRating(ratingId)}
                      className={`rounded-xl border-2 px-3 py-2 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                        isActive
                          ? "border-violet-500 bg-violet-100 text-violet-900"
                          : "border-zinc-200 bg-white text-zinc-700 hover:border-violet-300 hover:bg-violet-50"
                      }`}
                      aria-pressed={isActive}
                    >
                      <span className="mr-1.5">{ratingEmoji[ratingId]}</span>
                      {ratingLabels[ratingId]}
                    </button>
                  );
                })}
              </div>
              <label className="mt-4 block text-left">
                <span className="mb-2 block text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Notes</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  placeholder="What stood out?"
                  className="w-full resize-none rounded-xl border-2 border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
                />
              </label>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRating(rating?.rating ?? "");
                    setNotes(rating?.notes ?? "");
                    setIsEditingRating(false);
                  }}
                  className="rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveRating()}
                  disabled={isSaving}
                  className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save rating"}
                </button>
              </div>
            </>
          )}
        </section>

        {(statusMessage || errorMessage) && (
          <div
            className={`w-full rounded-2xl border px-4 py-2 text-sm ${
              errorMessage ? "border-rose-300 bg-rose-50 text-rose-700" : "border-emerald-300 bg-emerald-50 text-emerald-700"
            }`}
          >
            {errorMessage || statusMessage}
          </div>
        )}
      </div>
    </main>
  );
}
