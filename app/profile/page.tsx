"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

import { firebaseClientAuth } from "@/lib/firebase-client";
import { type AlbumRating, type AlbumRatingId } from "@/lib/ratings/types";
import { USER_GOAL_OPTIONS, type UserGoalId } from "@/lib/user-goals/constants";

type GoalsResponse = {
  goals: {
    selectedGoals: UserGoalId[];
    notes: string;
  } | null;
  error?: string;
};

type RecommendationHistoryItem = {
  id: string;
  recommendationId: string;
  spotifyAlbumName: string;
  spotifyAlbumImageUrl: string;
  spotifyArtistName: string;
  spotifyArtistImageUrl: string;
  updatedAt: string;
  rating: Pick<AlbumRating, "id" | "rating" | "notes" | "updatedAt"> | null;
};

type HistoryResponse = {
  history: RecommendationHistoryItem[];
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

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [savedGoals, setSavedGoals] = useState<UserGoalId[]>([]);
  const [savedNotes, setSavedNotes] = useState("");
  const [editableGoals, setEditableGoals] = useState<UserGoalId[]>([]);
  const [editableNotes, setEditableNotes] = useState("");
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<RecommendationHistoryItem[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isSavingGoals, setIsSavingGoals] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedGoalSet = useMemo(() => new Set(editableGoals), [editableGoals]);

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

  const loadProfileData = useCallback(async (): Promise<void> => {
    if (!user) {
      return;
    }

    setIsDataLoading(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const token = await user.getIdToken();
      const commonHeaders = {
        Authorization: `Bearer ${token}`,
      };

      const [goalsResponse, historyResponse] = await Promise.all([
        fetch("/api/user/goals", {
          method: "GET",
          headers: commonHeaders,
        }),
        fetch("/api/recommendations/history", {
          method: "GET",
          headers: commonHeaders,
        }),
      ]);

      if (!goalsResponse.ok) {
        const body = (await goalsResponse.json()) as GoalsResponse;
        throw new Error(body.error ?? "Failed to load goals");
      }

      if (!historyResponse.ok) {
        const body = (await historyResponse.json()) as HistoryResponse;
        throw new Error(body.error ?? "Failed to load history");
      }

      const goalsBody = (await goalsResponse.json()) as GoalsResponse;
      const historyBody = (await historyResponse.json()) as HistoryResponse;

      const nextGoals = goalsBody.goals?.selectedGoals ?? [];
      const nextNotes = goalsBody.goals?.notes ?? "";

      setSavedGoals(nextGoals);
      setSavedNotes(nextNotes);
      setEditableGoals(nextGoals);
      setEditableNotes(nextNotes);
      setIsEditingGoals(false);
      setHistoryEntries(historyBody.history);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load profile";
      setErrorMessage(message);
    } finally {
      setIsDataLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isAuthLoading && user) {
      void loadProfileData();
    }
  }, [isAuthLoading, user, loadProfileData]);

  async function handleSignOut(): Promise<void> {
    setIsSigningOut(true);
    try {
      await signOut(firebaseClientAuth);
      router.replace("/landing");
    } finally {
      setIsSigningOut(false);
    }
  }

  async function handleDeleteAccount(): Promise<void> {
    if (!user) {
      return;
    }

    const confirmed = window.confirm("Delete your account and all data permanently? This cannot be undone.");
    if (!confirmed) {
      return;
    }

    setIsDeletingAccount(true);
    setErrorMessage("");

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/user/delete", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to delete account");
      }

      await signOut(firebaseClientAuth);
      router.replace("/landing");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete account";
      setErrorMessage(message);
      setIsDeletingAccount(false);
    }
  }

  function toggleGoal(goalId: UserGoalId): void {
    setEditableGoals((current) => {
      if (current.includes(goalId)) {
        return current.filter((id) => id !== goalId);
      }

      return [...current, goalId];
    });
  }

  async function handleSaveGoals(): Promise<void> {
    if (!user) {
      return;
    }

    if (!editableGoals.length) {
      setErrorMessage("Select at least one goal.");
      return;
    }

    setIsSavingGoals(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/user/goals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          selectedGoals: editableGoals,
          notes: editableNotes,
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as GoalsResponse;
        throw new Error(body.error ?? "Failed to save goals");
      }

      const body = (await response.json()) as GoalsResponse;
      const nextGoals = body.goals?.selectedGoals ?? [];
      const nextNotes = body.goals?.notes ?? "";
      setSavedGoals(nextGoals);
      setSavedNotes(nextNotes);
      setEditableGoals(nextGoals);
      setEditableNotes(nextNotes);
      setIsEditingGoals(false);
      setStatusMessage("Goals updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save goals";
      setErrorMessage(message);
    } finally {
      setIsSavingGoals(false);
    }
  }

  if (isAuthLoading || isDataLoading) {
    return (
      <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950 sm:px-10">
        <div className="mx-auto flex min-h-[80vh] w-full max-w-3xl items-center justify-center">
          <section className="w-full rounded-[2rem] border-2 border-black bg-white px-8 py-12 text-center shadow-[10px_10px_0px_0px_#000]">
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-zinc-500">Loading profile</p>
            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">Gathering your Boomie profile...</h1>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950 sm:px-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <button
            type="button"
            onClick={() => router.push("/")}
            aria-label="Back to main page"
            className="inline-flex h-9 w-9 items-center justify-center text-zinc-700 transition hover:text-zinc-900"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
              <path
                d="M15.5 5.5L9 12l6.5 6.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <header className="space-y-2 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-zinc-500">Your profile</p>
          <h1 className="text-3xl font-black leading-tight sm:text-5xl">Account & listening history</h1>
        </header>

        <section className="w-full rounded-3xl border-2 border-black bg-white p-5 shadow-[6px_6px_0px_0px_#000] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Goals</h2>
            {!isEditingGoals ? (
              <button
                type="button"
                onClick={() => setIsEditingGoals(true)}
                aria-label="Edit goals"
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

          {isEditingGoals ? (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {USER_GOAL_OPTIONS.map((goal) => {
                  const isActive = selectedGoalSet.has(goal.id);
                  return (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => toggleGoal(goal.id)}
                      className={`rounded-xl border-2 px-3 py-2 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                        isActive
                          ? "border-violet-500 bg-violet-100 text-violet-900"
                          : "border-zinc-200 bg-white text-zinc-700 hover:border-violet-300 hover:bg-violet-50"
                      }`}
                      aria-pressed={isActive}
                    >
                      <span className="mr-1.5" aria-hidden="true">
                        {goal.emoji}
                      </span>
                      {goal.label}
                    </button>
                  );
                })}
              </div>
              <label className="mt-4 block text-left">
                <span className="mb-2 block text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Notes</span>
                <textarea
                  value={editableNotes}
                  onChange={(event) => setEditableNotes(event.target.value)}
                  rows={4}
                  placeholder="Anything specific you want Boomie to optimize for?"
                  className="w-full resize-none rounded-xl border-2 border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
                />
              </label>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditableGoals(savedGoals);
                    setEditableNotes(savedNotes);
                    setIsEditingGoals(false);
                  }}
                  className="rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveGoals()}
                  disabled={isSavingGoals}
                  className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingGoals ? "Saving..." : "Save goals"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                {savedGoals.length ? (
                  USER_GOAL_OPTIONS.filter((goal) => savedGoals.includes(goal.id)).map((goal) => (
                    <span
                      key={goal.id}
                      className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-700"
                    >
                      <span className="mr-1.5" aria-hidden="true">
                        {goal.emoji}
                      </span>
                      {goal.label}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-zinc-600">No goals selected yet.</p>
                )}
              </div>
              <div className="mt-4 rounded-xl border-2 border-zinc-200 bg-zinc-50 px-3 py-2">
                <p className="mb-1 text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Notes</p>
                <p className="text-sm text-zinc-700">{savedNotes || "No notes added."}</p>
              </div>
            </>
          )}
        </section>

        <section className="w-full rounded-3xl border-2 border-black bg-white p-5 shadow-[6px_6px_0px_0px_#000] sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">History</h2>
          {historyEntries.length ? (
            <ul className="mt-3 space-y-3">
              {historyEntries.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/recommendation/${entry.recommendationId}`)}
                    className="w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-left transition hover:border-violet-300 hover:bg-violet-50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-white">
                        {entry.spotifyAlbumImageUrl || entry.spotifyArtistImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- Dynamic image URLs.
                          <img
                            src={entry.spotifyAlbumImageUrl || entry.spotifyArtistImageUrl}
                            alt={`${entry.spotifyAlbumName} artwork`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full bg-zinc-200" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="truncate text-base font-semibold text-zinc-900">{entry.spotifyAlbumName}</p>
                            <p className="truncate text-sm text-zinc-700">{entry.spotifyArtistName || "Unknown Artist"}</p>
                          </div>
                          {entry.rating ? (
                            <span className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-700">
                              {ratingLabels[entry.rating.rating]}
                            </span>
                          ) : (
                            <span className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                              Not rated
                            </span>
                          )}
                        </div>
                        {entry.rating?.notes ? <p className="mt-2 text-sm leading-6 text-zinc-700">{entry.rating.notes}</p> : null}
                        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Updated {formatDate(entry.rating?.updatedAt ?? entry.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-zinc-600">No listening history yet.</p>
          )}
        </section>

        {statusMessage ? (
          <div className="w-full rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            {statusMessage}
          </div>
        ) : null}

        {errorMessage ? <div className="w-full rounded-2xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm text-rose-700">{errorMessage}</div> : null}

        <section className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={isSigningOut || isDeletingAccount}
            className="rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
          <button
            type="button"
            onClick={() => void handleDeleteAccount()}
            disabled={isDeletingAccount || isSigningOut}
            className="rounded-full border border-rose-300 bg-rose-50 px-5 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeletingAccount ? "Deleting account..." : "Delete account"}
          </button>
        </section>
      </div>
    </main>
  );
}
