"use client";

import { useEffect, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";

import { firebaseClientAuth } from "@/lib/firebase-client";

const GOOGLE_PROVIDER = new GoogleAuthProvider();

export default function LandingPage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseClientAuth, (nextUser) => {
      if (nextUser) {
        router.replace("/");
        return;
      }

      setIsCheckingAuth(false);
    });

    return () => unsubscribe();
  }, [router]);

  async function handleGetStarted(): Promise<void> {
    setErrorMessage("");
    setIsSigningIn(true);

    try {
      await signInWithPopup(firebaseClientAuth, GOOGLE_PROVIDER);
      router.replace("/");
    } catch {
      setErrorMessage("Could not sign in with Google. Please try again.");
      setIsSigningIn(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950 sm:px-10">
      <section className="mx-auto flex min-h-[80vh] w-full max-w-5xl flex-col items-center justify-center gap-10 text-center">
        <div className="space-y-5">
          <h1 className="text-6xl font-black tracking-tight sm:text-8xl">
            BOOMIE
          </h1>
          <p className="mx-auto max-w-2xl text-2xl font-semibold leading-tight sm:text-4xl">
            The album companion for curious listeners.
          </p>
          <p className="mx-auto max-w-lg text-base text-zinc-700 sm:text-lg">
            One album at a time. One honest vibe check.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGetStarted}
          disabled={isCheckingAuth || isSigningIn}
          className="rounded-full bg-black px-10 py-4 text-xl font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCheckingAuth ? "Checking..." : isSigningIn ? "Signing in..." : "Get started"}
        </button>

        {errorMessage && (
          <p className="rounded-full border border-rose-300 bg-rose-50 px-5 py-2 text-sm font-medium text-rose-700">
            {errorMessage}
          </p>
        )}
      </section>
    </main>
  );
}
