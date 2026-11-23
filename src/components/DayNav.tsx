"use client";

import { useEffect, useMemo, useState } from "react";
import { listWorkoutEntriesInRange } from "@/lib/db";
import { formatDisplayDate, shiftDateKey, todayKey } from "@/lib/date";
import { mondayOf } from "@/lib/recap";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

// Header for the Today screen: a large title, a date picker with previous/next day, and a week strip
// (a dot marks a day with a workout). Choosing a day anywhere changes the day shown below.
export default function DayNav({
  dateKey,
  onChange,
}: {
  dateKey: string;
  onChange: (dateKey: string) => void;
}) {
  const today = todayKey();
  const isToday = dateKey === today;
  const weekStart = mondayOf(dateKey);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftDateKey(weekStart, i)), [weekStart]);
  const [trained, setTrained] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const entries = await listWorkoutEntriesInRange(days);
        if (!cancelled) setTrained(new Set(entries.map((e) => e.dateKey)));
      } catch {
        // dots are decoration; the picker works without them
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days]);

  const [weekday, ...rest] = formatDisplayDate(dateKey).split(", ");

  return (
    <header className="mb-5 space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.09em] text-neutral-400">{rest.join(", ")}</p>
          <h1 className="text-4xl font-bold tracking-tight text-neutral-50">{isToday ? "Today" : weekday}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => onChange(shiftDateKey(dateKey, -1))}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-neutral-300 hover:bg-white/5"
            aria-label="Previous day"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <input
            type="date"
            value={dateKey}
            onChange={(e) => e.target.value && onChange(e.target.value)}
            aria-label="Pick a date"
            className="h-10 w-[9.5rem] min-w-0 rounded-full border border-white/10 bg-neutral-900 px-3 text-sm text-neutral-200"
          />
          <button
            onClick={() => onChange(shiftDateKey(dateKey, 1))}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-neutral-300 hover:bg-white/5"
            aria-label="Next day"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex justify-between" role="group" aria-label="This week">
        {days.map((d, i) => {
          const selected = d === dateKey;
          return (
            <button
              key={d}
              onClick={() => onChange(d)}
              aria-label={formatDisplayDate(d)}
              aria-pressed={selected}
              className={`flex w-11 flex-col items-center gap-1 rounded-2xl py-2 ${
                selected ? "bg-emerald-400 text-neutral-950" : "text-neutral-400 hover:bg-white/5"
              }`}
            >
              <span className="text-[11px] font-semibold">{DAY_LETTERS[i]}</span>
              <span className={`text-[17px] font-semibold ${selected ? "" : "text-neutral-100"}`}>{Number(d.slice(8))}</span>
              <span className={`h-1.5 w-1.5 rounded-full ${trained.has(d) ? (selected ? "bg-neutral-950" : "bg-emerald-400") : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>
    </header>
  );
}
