"use client";

import { useState } from "react";

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

export default function Home() {
  const [selectedRating, setSelectedRating] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const selectedOption = ratingOptions.find((option) => option.id === selectedRating);

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
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
