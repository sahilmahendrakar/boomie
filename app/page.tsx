"use client";

import { useCallback, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

import { firebaseClientAuth } from "@/lib/firebase-client";

type RatingOption = {
  id: string;
  label: string;
  emoji: string;
  colorClass: string;
};

const ratingOptions: RatingOption[] = [
  { id: "hated", label: "Hated it", emoji: "😖", colorClass: "hover:border-rose-300 hover:bg-rose-50" },
  { id: "disliked", label: "Disliked", emoji: "🙃", colorClass: "hover:border-orange-300 hover:bg-orange-50" },
  { id: "neutral", label: "Neutral", emoji: "😐", colorClass: "hover:border-zinc-300 hover:bg-zinc-100" },
  { id: "liked", label: "Liked it", emoji: "🙂", colorClass: "hover:border-emerald-300 hover:bg-emerald-50" },
  { id: "loved", label: "Loved it", emoji: "🤩", colorClass: "hover:border-fuchsia-300 hover:bg-fuchsia-50" },
  {
    id: "did-not-listen",
    label: "Did not listen",
    emoji: "🫥",
    colorClass: "hover:border-sky-300 hover:bg-sky-50",
  },
];

type Recommendation = {
  tagline: string;
  albumDescription: string;
  whyForUser: string;
  spotifyAlbumImageUrl?: string;
  spotifyAlbumId: string;
  spotifyAlbumName: string;
  spotifyArtistName: string;
};

type UserGoalsResponse = {
  goals: {
    selectedGoals: string[];
  } | null;
  error?: string;
};

const defaultRecommendation: Recommendation = {
  tagline: "Electronic • 2001 • 14 tracks",
  albumDescription:
    "A sleek, groove-forward electronic classic that balances robot-pop hooks with dancefloor momentum.",
  whyForUser: "It matches your upbeat energy and preference for polished, melodic production.",
  spotifyAlbumImageUrl: "",
  spotifyAlbumId: "",
  spotifyAlbumName: "Discovery",
  spotifyArtistName: "Daft Punk",
};

export default function Home() {
  const router = useRouter();
  const [selectedRating, setSelectedRating] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [nextPickSteering, setNextPickSteering] = useState<string>("");
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [hasGoals, setHasGoals] = useState<boolean | null>(null);
  const [isInitialRecommendationLoading, setIsInitialRecommendationLoading] = useState<boolean>(false);
  const [isGeneratingNextRecommendation, setIsGeneratingNextRecommendation] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const selectedOption = ratingOptions.find((option) => option.id === selectedRating);
  const isRecommendationLoading = isInitialRecommendationLoading || isGeneratingNextRecommendation;
  const canGetNextPick = Boolean(user && selectedOption && !isSaving && !isRecommendationLoading);
  const displayedRecommendation = recommendation ?? defaultRecommendation;
  const spotifyAlbumUrl = displayedRecommendation.spotifyAlbumId
    ? `https://open.spotify.com/album/${displayedRecommendation.spotifyAlbumId}`
    : "https://open.spotify.com/";
  const shouldShowLoader = isAuthLoading || !user || hasGoals !== true || isRecommendationLoading;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseClientAuth, (nextUser) => {
      setUser(nextUser);
      setIsAuthLoading(false);
      if (!nextUser) {
        setHasGoals(null);
        router.replace("/landing");
        return;
      }

      setHasGoals(null);
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    async function checkGoalsForUser(): Promise<void> {
      if (!user) {
        return;
      }

      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/user/goals", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const responseBody = (await response.json()) as UserGoalsResponse;
          throw new Error(responseBody.error ?? "Failed to load goals");
        }

        const responseBody = (await response.json()) as UserGoalsResponse;
        const hasSavedGoals = Boolean(responseBody.goals?.selectedGoals?.length);
        setHasGoals(hasSavedGoals);
        if (!hasSavedGoals) {
          router.replace("/onboarding/goals");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load goals";
        setErrorMessage(message);
        setHasGoals(true);
      }
    }

    if (!isAuthLoading && user) {
      void checkGoalsForUser();
    }
  }, [isAuthLoading, router, user]);

  const generateNextRecommendation = useCallback(
    async (steeringInstruction?: string): Promise<void> => {
      if (!user) {
        throw new Error("Please sign in first.");
      }

      setIsGeneratingNextRecommendation(true);
      setErrorMessage("");
      setStatusMessage("Rating saved. Boomie is digging for your next gem...");

      try {
        const token = await user.getIdToken();
        const trimmedSteering = steeringInstruction?.trim() ?? "";
        const response = await fetch("/api/agent/recommendation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            nextPickSteering: trimmedSteering,
          }),
        });

        if (!response.ok) {
          const responseBody = (await response.json()) as { error?: string };
          throw new Error(responseBody.error ?? "Failed to fetch recommendation");
        }

        const responseBody = (await response.json()) as Recommendation;
        setRecommendation(responseBody);
        setSelectedRating("");
        setNotes("");
        setNextPickSteering("");
        setStatusMessage("Fresh pick unlocked. Give it a spin and rate it!");
      } finally {
        setIsGeneratingNextRecommendation(false);
      }
    },
    [user],
  );

  async function saveRating(): Promise<void> {
    if (!selectedOption) {
      setErrorMessage("Select a rating before getting your next pick.");
      return;
    }
    if (!user) {
      setErrorMessage("Please sign in first.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setStatusMessage("");
    let didPersistRating = false;

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/ratings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          albumName: displayedRecommendation.spotifyAlbumName,
          rating: selectedOption.id,
          notes,
        }),
      });

      if (!response.ok) {
        const responseBody = (await response.json()) as { error?: string };
        throw new Error(responseBody.error ?? "Failed to save rating");
      }

      didPersistRating = true;
      await generateNextRecommendation(nextPickSteering);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save rating";
      if (didPersistRating) {
        setErrorMessage(`Rating saved, but ${message}`);
      } else {
        setErrorMessage(message);
      }
    } finally {
      setIsSaving(false);
    }
  }

  const fetchCurrentRecommendation = useCallback(async (): Promise<void> => {
    if (!user) {
      setErrorMessage("Please sign in first.");
      return;
    }

    setIsInitialRecommendationLoading(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/agent/recommendation", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const responseBody = (await response.json()) as { error?: string };
        throw new Error(responseBody.error ?? "Failed to generate recommendation");
      }

      const responseBody = (await response.json()) as Recommendation;
      setRecommendation(responseBody);
      setStatusMessage("Your recommendation is ready.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch recommendation";
      setErrorMessage(message);
    } finally {
      setIsInitialRecommendationLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user || hasGoals !== true || recommendation || isInitialRecommendationLoading) {
      return;
    }

    void fetchCurrentRecommendation();
  }, [user, hasGoals, recommendation, isInitialRecommendationLoading, fetchCurrentRecommendation]);

  if (shouldShowLoader) {
    const loaderTitle ="Boomie is digging through record crates...";

    return (
      <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950 sm:px-10">
        <div className="mx-auto flex min-h-[80vh] w-full max-w-3xl items-center justify-center">
          <section className="relative w-full rounded-[2rem] border-2 border-black bg-white px-8 py-12 text-center shadow-[10px_10px_0px_0px_#000]">
            <div className="pointer-events-none absolute -left-3 -top-3 h-8 w-8 rounded-full border-2 border-black bg-yellow-300 motion-safe:animate-bounce motion-reduce:animate-none" />
            <div className="pointer-events-none absolute -right-2 top-10 h-6 w-6 rounded-full border-2 border-black bg-pink-300 motion-safe:animate-pulse motion-reduce:animate-none" />
            <div className="pointer-events-none absolute -bottom-3 right-8 h-10 w-10 rounded-full border-2 border-black bg-emerald-300 motion-safe:animate-ping motion-reduce:animate-none" />
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-zinc-500">Loading groove</p>
            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">{loaderTitle}</h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-zinc-700">
              Hold tight while Boomie flips through cosmic vinyl, checks your vibe history, and lines up a deliciously
              good next listen.
            </p>
            <div className="mt-7 flex items-center justify-center gap-2">
              <span className="h-3 w-3 rounded-full border border-black bg-violet-300 motion-safe:animate-bounce motion-reduce:animate-none" />
              <span className="h-3 w-3 rounded-full border border-black bg-sky-300 motion-safe:animate-bounce motion-reduce:animate-none [animation-delay:120ms]" />
              <span className="h-3 w-3 rounded-full border border-black bg-orange-300 motion-safe:animate-bounce motion-reduce:animate-none [animation-delay:240ms]" />
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950 sm:px-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 text-center">
        <header className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-zinc-500">Boomie Pick</p>
          <h1 className="text-3xl font-black leading-tight sm:text-5xl">{displayedRecommendation.tagline}</h1>
        </header>

        <section className="w-full max-w-md">
          <div className="relative overflow-hidden rounded-3xl border-2 border-black bg-white shadow-[6px_6px_0px_0px_#000]">
            {displayedRecommendation.spotifyAlbumImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Spotify image URLs are dynamic.
              <img
                src={displayedRecommendation.spotifyAlbumImageUrl}
                alt={`${displayedRecommendation.spotifyAlbumName} cover art`}
                className="aspect-square h-full w-full object-cover"
              />
            ) : (
              <div className="aspect-square bg-[radial-gradient(circle_at_25%_20%,_#c4b5fd,_#ffffff_55%)]" />
            )}
          </div>
        </section>

        <section className="space-y-1">
          <h2 className="text-3xl font-black sm:text-4xl">{displayedRecommendation.spotifyAlbumName}</h2>
          <p className="text-lg font-semibold text-zinc-700">{displayedRecommendation.spotifyArtistName}</p>
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
          <p className="mt-3 text-sm leading-6 text-zinc-700">{displayedRecommendation.albumDescription}</p>
          <h4 className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Why this for you</h4>
          <p className="mt-2 text-sm leading-6 text-zinc-700">{displayedRecommendation.whyForUser}</p>
        </section>

        <section className="w-full rounded-3xl border-2 border-black bg-white p-5 shadow-[6px_6px_0px_0px_#000] sm:p-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Rate it</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ratingOptions.map((option) => {
              const isActive = selectedRating === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedRating(option.id)}
                  className={`rounded-xl border-2 px-3 py-2 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                    isActive
                      ? "border-violet-500 bg-violet-100 text-violet-900"
                      : `border-zinc-200 bg-white text-zinc-700 ${option.colorClass}`
                  }`}
                  aria-pressed={isActive}
                >
                  <span className="mr-1.5">{option.emoji}</span>
                  {option.label}
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
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={nextPickSteering}
              onChange={(event) => setNextPickSteering(event.target.value)}
              placeholder="Steer next pick..."
              className="w-full rounded-full border-2 border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
            />
            <button
              type="button"
              onClick={saveRating}
              disabled={!canGetNextPick}
              className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 sm:shrink-0"
            >
              {isSaving ? "Saving..." : "Get your next pick"}
            </button>
          </div>
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
