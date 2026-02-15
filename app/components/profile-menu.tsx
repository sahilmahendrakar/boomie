"use client";

import { useEffect, useRef, useState } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";

import { firebaseClientAuth } from "@/lib/firebase-client";

export default function ProfileMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseClientAuth, (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setIsMenuOpen(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (!menuRef.current) {
        return;
      }

      if (!menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  async function handleSignOut(): Promise<void> {
    try {
      await signOut(firebaseClientAuth);
    } finally {
      setIsMenuOpen(false);
      router.replace("/landing");
    }
  }

  function openProfile(): void {
    setIsMenuOpen(false);
    router.push("/profile");
  }

  if (!user) {
    return null;
  }

  const fallbackInitial = user.displayName?.trim().charAt(0).toUpperCase() || user.email?.trim().charAt(0).toUpperCase() || "U";

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
      <div ref={menuRef} className="pointer-events-auto relative">
        <button
          type="button"
          onClick={() => setIsMenuOpen((current) => !current)}
          aria-label="Open profile menu"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-black bg-white shadow-[3px_3px_0px_0px_#000] transition hover:translate-y-[1px]"
        >
          {user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element -- Auth user avatars are external URLs.
            <img
              src={user.photoURL}
              alt="Profile"
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-sm font-semibold text-zinc-700">{fallbackInitial}</span>
          )}
        </button>

        {isMenuOpen ? (
          <div
            role="menu"
            aria-label="Profile menu"
            className="absolute right-0 mt-2 w-40 rounded-xl border-2 border-black bg-white p-1.5 text-sm shadow-[4px_4px_0px_0px_#000]"
          >
            <button
              type="button"
              role="menuitem"
              onClick={openProfile}
              className="w-full rounded-lg px-3 py-2 text-left font-medium text-zinc-700 transition hover:bg-zinc-100"
            >
              Profile
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => void handleSignOut()}
              className="w-full rounded-lg px-3 py-2 text-left font-medium text-zinc-700 transition hover:bg-zinc-100"
            >
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
