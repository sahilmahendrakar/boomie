"use client";

import { useEffect, useMemo, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

import { firebaseClientAuth } from "@/lib/firebase-client";
import { USER_GOAL_OPTIONS, type UserGoalId } from "@/lib/user-goals/constants";

type GoalsResponse = {
  goals: {
    selectedGoals: UserGoalId[];
    notes: string;
  } | null;
  error?: string;
};

export default function GoalsOnboardingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isCheckingGoals, setIsCheckingGoals] = useState(true);
  const [selectedGoals, setSelectedGoals] = useState<UserGoalId[]>([]);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const canSubmit = selectedGoals.length > 0 && !isSaving;
  const selectedGoalSet = useMemo(() => new Set(selectedGoals), [selectedGoals]);

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

  useEffect(() => {
    async function checkExistingGoals(): Promise<void> {
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
          const body = (await response.json()) as GoalsResponse;
          throw new Error(body.error ?? "Failed to load goals");
        }

        const body = (await response.json()) as GoalsResponse;
        if (body.goals?.selectedGoals?.length) {
          router.replace("/");
          return;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load goals";
        setErrorMessage(message);
      } finally {
        setIsCheckingGoals(false);
      }
    }

    if (!isAuthLoading && user) {
      void checkExistingGoals();
    }
  }, [isAuthLoading, router, user]);

  function toggleGoal(goalId: UserGoalId): void {
    setSelectedGoals((current) => {
      if (current.includes(goalId)) {
        return current.filter((id) => id !== goalId);
      }
      return [...current, goalId];
    });
  }

  async function saveGoals(): Promise<void> {
    if (!user) {
      setErrorMessage("Please sign in first.");
      return;
    }

    if (!selectedGoals.length) {
      setErrorMessage("Select at least one goal.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/user/goals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          selectedGoals,
          notes,
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as GoalsResponse;
        throw new Error(body.error ?? "Failed to save goals");
      }

      router.replace("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save goals";
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  }

  if (isAuthLoading || isCheckingGoals) {
    return (
      <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950 sm:px-10">
        <div className="mx-auto flex min-h-[80vh] w-full max-w-3xl items-center justify-center">
          <section className="w-full rounded-[2rem] border-2 border-black bg-white px-8 py-12 text-center shadow-[10px_10px_0px_0px_#000]">
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-zinc-500">Loading setup</p>
            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">Preparing your Boomie goals...</h1>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950 sm:px-10">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-3xl flex-col items-center justify-center gap-6 text-center">
        <header className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-zinc-500">Welcome to Boomie</p>
          <h1 className="text-3xl font-black leading-tight sm:text-5xl">What are your music goals?</h1>
          <p className="mx-auto max-w-xl text-sm leading-6 text-zinc-700 sm:text-base">
            Pick a few directions and add any specific notes. Boomie will use these to personalize your recommendations.
          </p>
        </header>

        <section className="w-full rounded-3xl border-2 border-black bg-white p-5 text-left shadow-[6px_6px_0px_0px_#000] sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Select goals</h2>
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
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="Anything specific you want Boomie to optimize for?"
              className="w-full resize-none rounded-xl border-2 border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
            />
          </label>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={saveGoals}
              disabled={!canSubmit}
              className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save goals"}
            </button>
          </div>
        </section>

        {errorMessage && (
          <div className="w-full rounded-2xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {errorMessage}
          </div>
        )}
      </div>
    </main>
  );
}
