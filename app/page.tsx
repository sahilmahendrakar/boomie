"use client";

import { useEffect, useState } from "react";
import { GoogleAuthProvider, User, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";

import { firebaseClientAuth } from "@/lib/firebase-client";

type RatingOption = {
  id: string;
  label: string;
  emoji: string;
  colorClass: string;
  score: number;
};

const ratingOptions: RatingOption[] = [
  { id: "hated", label: "Hated it", emoji: "😖", colorClass: "hover:border-rose-300 hover:bg-rose-50", score: 1 },
  { id: "disliked", label: "Disliked", emoji: "🙃", colorClass: "hover:border-orange-300 hover:bg-orange-50", score: 2 },
  { id: "neutral", label: "Neutral", emoji: "😐", colorClass: "hover:border-zinc-300 hover:bg-zinc-100", score: 3 },
  { id: "liked", label: "Liked it", emoji: "🙂", colorClass: "hover:border-emerald-300 hover:bg-emerald-50", score: 4 },
  { id: "loved", label: "Loved it", emoji: "🤩", colorClass: "hover:border-fuchsia-300 hover:bg-fuchsia-50", score: 5 },
  {
    id: "did-not-listen",
    label: "Did not listen",
    emoji: "🫥",
    colorClass: "hover:border-sky-300 hover:bg-sky-50",
    score: 0,
  },
];

type AlbumRating = {
  id: string;
  albumName: string;
  rating: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

const GOOGLE_PROVIDER = new GoogleAuthProvider();

export default function Home() {
  const [selectedRating, setSelectedRating] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [history, setHistory] = useState<AlbumRating[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const selectedOption = ratingOptions.find((option) => option.id === selectedRating);
  const canSave = Boolean(user && selectedOption && !isSaving);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseClientAuth, (nextUser) => {
      setUser(nextUser);
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  async function getAuthToken(): Promise<string> {
    if (!user) {
      throw new Error("Please sign in first.");
    }

    return user.getIdToken();
  }

  async function signInWithGoogle(): Promise<void> {
    setErrorMessage("");
    setStatusMessage("");

    try {
      await signInWithPopup(firebaseClientAuth, GOOGLE_PROVIDER);
      setStatusMessage("Signed in with Google.");
    } catch {
      setErrorMessage("Failed to sign in with Google.");
    }
  }

  async function signOutCurrentUser(): Promise<void> {
    setErrorMessage("");
    setStatusMessage("");

    try {
      await signOut(firebaseClientAuth);
      setHistory([]);
      setStatusMessage("Signed out.");
    } catch {
      setErrorMessage("Failed to sign out.");
    }
  }

  async function saveRating(): Promise<void> {
    if (!selectedOption) {
      setErrorMessage("Select a rating before saving.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const token = await getAuthToken();
      const response = await fetch("/api/ratings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          albumName: "Discovery",
          rating: selectedOption.score,
          notes,
        }),
      });

      if (!response.ok) {
        const responseBody = (await response.json()) as { error?: string };
        throw new Error(responseBody.error ?? "Failed to save rating");
      }

      setStatusMessage("Rating saved.");
      await loadHistory();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save rating";
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function loadHistory(): Promise<void> {
    setIsLoadingHistory(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const token = await getAuthToken();
      const response = await fetch("/api/ratings", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const responseBody = (await response.json()) as { error?: string };
        throw new Error(responseBody.error ?? "Failed to load history");
      }

      const responseBody = (await response.json()) as { ratings: AlbumRating[] };
      setHistory(responseBody.ratings);
      setStatusMessage("Loaded rating history.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load history";
      setErrorMessage(message);
    } finally {
      setIsLoadingHistory(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-cyan-50 px-4 py-10 text-zinc-900 sm:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-7">
        <header className="space-y-4 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/85 px-4 py-1 text-sm font-medium shadow-sm backdrop-blur">
            <span>📻😎</span>
            <span>Boomie gives one rec at a time</span>
          </p>
          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
            One album.
            <br />
            One vibe check.
          </h1>
          <p className="mx-auto max-w-xl text-sm leading-6 text-zinc-600 sm:text-base">
            Meet <span className="font-semibold text-zinc-800">Boomie</span>, your sunglass-wearing boombox DJ. Spin the
            album, rate the mood, leave a note, and keep it moving.
          </p>
        </header>

        <section className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-xl shadow-violet-100 backdrop-blur sm:p-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-3">
            <div className="text-sm text-zinc-600">
              {isAuthLoading
                ? "Checking sign-in status..."
                : user
                  ? `Signed in as ${user.email ?? user.uid}`
                  : "You are not signed in"}
            </div>
            {user ? (
              <button
                type="button"
                onClick={signOutCurrentUser}
                className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
              >
                Sign out
              </button>
            ) : (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="rounded-full border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
              >
                Sign in with Google
              </button>
            )}
          </div>

          <div className="grid gap-6 sm:grid-cols-[1.15fr_1fr]">
            <div>
              <div
                className="relative aspect-square overflow-hidden rounded-2xl border border-zinc-900/10 bg-[radial-gradient(circle_at_top_right,_#c4b5fd,_#ecfeff_45%,_#ffffff_75%)] p-6 shadow-lg"
                aria-label="Recommended album artwork"
              >
                <div className="absolute left-5 top-5 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold tracking-wide text-white">
                  BOOMIE PICK
                </div>
                <div className="absolute right-5 top-5 text-3xl">📻😎</div>
                <div className="mt-16 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600">Today&apos;s recommendation</p>
                  <h2 className="text-3xl font-black leading-tight text-zinc-900">Discovery</h2>
                  <p className="text-lg font-medium text-zinc-700">Daft Punk</p>
                </div>
                <div className="absolute bottom-5 left-5 rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-xs font-medium text-zinc-700 backdrop-blur">
                  Electronic • 2001 • 14 tracks
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-6">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Streaming</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    className="rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:-translate-y-0.5 hover:bg-emerald-100"
                    href="https://open.spotify.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Spotify
                  </a>
                  <a
                    className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:-translate-y-0.5 hover:bg-zinc-100"
                    href="#"
                  >
                    Apple Music
                  </a>
                  <a
                    className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:-translate-y-0.5 hover:bg-zinc-100"
                    href="#"
                  >
                    YouTube Music
                  </a>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">How did it land?</h3>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {ratingOptions.map((option) => {
                    const isActive = selectedRating === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedRating(option.id)}
                        className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                          isActive
                            ? "border-violet-400 bg-violet-100 text-violet-900"
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
                <p className="mt-3 min-h-5 text-sm text-zinc-500">
                  {selectedOption ? `Your vibe check: ${selectedOption.label}` : "Select a rating to log your first impression."}
                </p>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold uppercase tracking-wider text-zinc-500">Notes</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="Short note for future you..."
                  className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveRating}
                  disabled={!canSave}
                  className="rounded-full border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save rating"}
                </button>
                <button
                  type="button"
                  onClick={loadHistory}
                  disabled={!user || isLoadingHistory}
                  className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoadingHistory ? "Loading..." : "Load history"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {(statusMessage || errorMessage) && (
          <div
            className={`rounded-xl border px-4 py-2 text-sm ${
              errorMessage ? "border-rose-300 bg-rose-50 text-rose-700" : "border-emerald-300 bg-emerald-50 text-emerald-700"
            }`}
          >
            {errorMessage || statusMessage}
          </div>
        )}

        <section className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-xl shadow-violet-100 backdrop-blur sm:p-7">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Your rating history</h3>
          <div className="mt-4 space-y-3">
            {history.length === 0 ? (
              <p className="text-sm text-zinc-500">No ratings loaded yet.</p>
            ) : (
              history.map((entry) => (
                <article key={entry.id} className="rounded-xl border border-zinc-200 bg-white p-3">
                  <p className="text-sm font-semibold text-zinc-800">{entry.albumName}</p>
                  <p className="text-xs text-zinc-500">Rating: {entry.rating} / 5</p>
                  <p className="mt-1 text-sm text-zinc-700">{entry.notes || "No notes."}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Updated: {new Date(entry.updatedAt).toLocaleString()}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
