"use client";

import { formatDisplayDate, shiftDateKey, todayKey } from "@/lib/date";

export default function DayNav({
  dateKey,
  onChange,
}: {
  dateKey: string;
  onChange: (dateKey: string) => void;
}) {
  const isToday = dateKey === todayKey();

  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <button
        onClick={() => onChange(shiftDateKey(dateKey, -1))}
        className="rounded-lg border border-neutral-800 px-3 py-2 text-neutral-300 hover:bg-neutral-800"
        aria-label="Previous day"
      >
        ←
      </button>

      <div className="flex flex-1 flex-col items-center">
        <input
          type="date"
          value={dateKey}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm text-neutral-200"
        />
        <span className="mt-1 text-xs text-neutral-500">
          {formatDisplayDate(dateKey)}
          {isToday ? " · Today" : ""}
        </span>
      </div>

      <button
        onClick={() => onChange(shiftDateKey(dateKey, 1))}
        className="rounded-lg border border-neutral-800 px-3 py-2 text-neutral-300 hover:bg-neutral-800"
        aria-label="Next day"
      >
        →
      </button>
    </div>
  );
}
