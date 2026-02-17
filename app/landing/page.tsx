"use client";

import { useEffect, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from "firebase/auth";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { firebaseClientAuth } from "@/lib/firebase-client";

const GOOGLE_PROVIDER = new GoogleAuthProvider();
const LINKEDIN_IN_APP_BROWSER_PATTERN = /LinkedInApp/i;

export default function LandingPage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [isHeaderImageLoaded, setIsHeaderImageLoaded] = useState<boolean>(false);
  const [isLinkedInInAppBrowser, setIsLinkedInInAppBrowser] = useState<boolean>(false);
  const [showLinkedInWarning, setShowLinkedInWarning] = useState<boolean>(false);
  const [hasAcknowledgedLinkedInWarning, setHasAcknowledgedLinkedInWarning] = useState<boolean>(false);
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

  useEffect(() => {
    setIsLinkedInInAppBrowser(LINKEDIN_IN_APP_BROWSER_PATTERN.test(window.navigator.userAgent));
  }, []);

  useEffect(() => {
    const headerImage = new window.Image();
    headerImage.src = "/Boomie Title.png";

    if (headerImage.complete) {
      setIsHeaderImageLoaded(true);
      return;
    }

    headerImage.onload = () => setIsHeaderImageLoaded(true);
    headerImage.onerror = () => setIsHeaderImageLoaded(true);

    return () => {
      headerImage.onload = null;
      headerImage.onerror = null;
    };
  }, []);

  async function startGoogleSignIn(): Promise<void> {
    setErrorMessage("");
    setIsSigningIn(true);

    try {
      await signInWithPopup(firebaseClientAuth, GOOGLE_PROVIDER);
      router.replace("/");
    } catch {
      setErrorMessage(
        isLinkedInInAppBrowser
          ? "Google sign-in can be blocked in the LinkedIn app. Open Boomie in Safari or Chrome and try again."
          : "Could not sign in with Google. Please try again.",
      );
      setIsSigningIn(false);
    }
  }

  async function handleGetStarted(): Promise<void> {
    if (isLinkedInInAppBrowser && !hasAcknowledgedLinkedInWarning) {
      setShowLinkedInWarning(true);
      return;
    }

    await startGoogleSignIn();
  }

  function handleOpenInBrowser(): void {
    window.open(window.location.href, "_blank", "noopener,noreferrer");
  }

  async function handleContinueInLinkedIn(): Promise<void> {
    setHasAcknowledgedLinkedInWarning(true);
    setShowLinkedInWarning(false);
    await startGoogleSignIn();
  }

  if (!isHeaderImageLoaded) {
    return <main className="min-h-screen bg-zinc-100" aria-hidden="true" />;
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950 sm:px-10">
      <section className="mx-auto flex min-h-[80vh] w-full max-w-5xl flex-col items-center justify-center gap-10 text-center">
        <div className="space-y-5">
          <h1 className="sr-only">Boomie</h1>
          <Image
            src="/Boomie Title.png"
            alt="Boomie"
            width={1536}
            height={652}
            priority
            className="mx-auto h-auto w-full max-w-3xl"
          />
          <p className="mx-auto max-w-2xl text-2xl font-semibold leading-tight sm:text-4xl">
            The album companion for curious listeners.
          </p>
          <p className="mx-auto max-w-lg text-base text-zinc-700 sm:text-lg">
            One album at a time, personalized for you.
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

        {showLinkedInWarning && (
          <section className="w-full max-w-xl rounded-3xl border-2 border-black bg-amber-50 p-5 text-left text-zinc-900 shadow-[6px_6px_0px_0px_#000] sm:p-6">
            <h2 className="text-lg font-black sm:text-xl">Open Boomie in your browser</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-700">
              Google sign-in is often blocked inside the LinkedIn app&apos;s in-app browser. For the smoothest login,
              open this page in Safari or Chrome.
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-700">
              Tip: in LinkedIn, use the menu and choose to open this page in your default browser.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleOpenInBrowser}
                className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Open in browser
              </button>
              <button
                type="button"
                onClick={handleContinueInLinkedIn}
                disabled={isSigningIn}
                className="rounded-full border-2 border-zinc-300 bg-white px-5 py-2 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Continue here anyway
              </button>
            </div>
          </section>
        )}

        {errorMessage && (
          <p className="rounded-full border border-rose-300 bg-rose-50 px-5 py-2 text-sm font-medium text-rose-700">
            {errorMessage}
          </p>
        )}
      </section>
    </main>
  );
}
