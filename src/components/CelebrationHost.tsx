"use client";

import { useEffect, useRef, useState } from "react";
import { useAppearance } from "@/lib/appearance";
import { CELEBRATE_EVENT, CelebrationDetail } from "@/lib/celebrate";
import { resolveTheme } from "@/lib/holidays";
import { todayKey } from "@/lib/date";
import { Win } from "@/lib/wins";

const DEFAULT_EMOJIS = ["🎉", "💪", "🏆", "⭐", "🔥", "✨"];
const PARTICLES = 26;
const SHOW_MS = 3800;
const MERGE_MS = 350; // several saves in a row (e.g. a whole split) become one celebration

interface Particle {
  id: number;
  emoji: string;
  left: number;
  size: number;
  delay: number;
  duration: number;
}

interface Shown {
  wins: Win[];
  logged: boolean;
  particles: Particle[];
  greeting: string | null;
}

// Playful celebration: a falling-emoji backdrop (the active holiday's items, or a
// default party set) with a toast naming what you did. Respects the Celebrations
// setting and prefers-reduced-motion (the toast still shows, the backdrop doesn't move).
export default function CelebrationHost() {
  const { theme, celebrations } = useAppearance();
  const [shown, setShown] = useState<Shown | null>(null);
  const pending = useRef<CelebrationDetail | null>(null);
  const timers = useRef<{
    merge?: ReturnType<typeof setTimeout>;
    hide?: ReturnType<typeof setTimeout>;
  }>({});

  useEffect(() => {
    if (!celebrations) return;
    const t = timers.current;

    function flush() {
      const detail = pending.current;
      pending.current = null;
      if (!detail) return;
      const holiday = resolveTheme(todayKey(), theme);
      const emojis = holiday?.emojis ?? DEFAULT_EMOJIS;
      const particles = Array.from({ length: PARTICLES }, (_, id) => ({
        id,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        left: Math.random() * 96,
        size: 22 + Math.random() * 20,
        delay: Math.random() * 0.9,
        duration: 2.4 + Math.random() * 1.6,
      }));
      setShown({
        wins: detail.wins,
        logged: !!detail.logged,
        particles,
        greeting: holiday?.greeting ?? null,
      });
      clearTimeout(t.hide);
      t.hide = setTimeout(() => setShown(null), SHOW_MS);
    }

    function onCelebrate(event: Event) {
      const detail = (event as CustomEvent<CelebrationDetail>).detail;
      const merged = pending.current;
      pending.current = {
        wins: [...(merged?.wins ?? []), ...detail.wins],
        logged: (merged?.logged ?? false) || !!detail.logged,
      };
      clearTimeout(t.merge);
      t.merge = setTimeout(flush, MERGE_MS);
    }

    window.addEventListener(CELEBRATE_EVENT, onCelebrate);
    return () => {
      window.removeEventListener(CELEBRATE_EVENT, onCelebrate);
      clearTimeout(t.merge);
      clearTimeout(t.hide);
    };
  }, [theme, celebrations]);

  if (!celebrations || !shown) return null;
  const headline = shown.wins.length > 0 ? shown.wins.slice(0, 3) : null;
  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
      data-testid="celebration"
    >
      <div aria-hidden="true">
        {shown.particles.map((p) => (
          <span
            key={p.id}
            className="celebration-emoji"
            style={{
              left: `${p.left}%`,
              fontSize: p.size,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          >
            {p.emoji}
          </span>
        ))}
      </div>
      <div
        role="status"
        aria-live="polite"
        onClick={() => setShown(null)}
        className="pointer-events-auto mx-auto mt-4 w-[min(92vw,26rem)] rounded-2xl border border-emerald-700 bg-neutral-950/95 px-4 py-3 text-center shadow-xl"
      >
        {shown.greeting && (
          <p className="text-xs text-emerald-400">{shown.greeting}</p>
        )}
        {headline ? (
          <ul className="space-y-1">
            {headline.map((w) => (
              <li key={w.id} className="text-sm font-semibold text-neutral-100">
                <span aria-hidden="true">{w.emoji}</span> {w.title}
                <span className="block text-xs font-normal text-neutral-400">
                  {w.detail}
                </span>
              </li>
            ))}
            {shown.wins.length > 3 && (
              <li className="text-xs text-neutral-500">
                +{shown.wins.length - 3} more
              </li>
            )}
          </ul>
        ) : (
          <p className="text-sm font-semibold text-neutral-100">
            <span aria-hidden="true">💪</span> Workout logged. Nice work!
          </p>
        )}
      </div>
    </div>
  );
}
