"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useBadgeData } from "@/hooks/useBadgeData";
import {
  BADGE_CATEGORIES,
  bestMonthWorkoutCount,
  computeProgress,
  currentProteinStreak,
  currentWeekStreak,
  golfSessionCount,
  nextGoalHint,
  totalVolume,
  totalWorkoutDays,
} from "@/lib/badges";

// Compact badges list for the bottom of Trends: one line per category with
// what's unlocked and the next reachable goal (also when a category is at zero).
export default function BadgesSection() {
  const { workoutEntries, foodEntries, golfActivityEntries, proteinTargetG, loading } = useBadgeData();

  const progressList = useMemo(() => {
    const values: Record<string, { value: number; available: boolean }> = {
      workouts: { value: totalWorkoutDays(workoutEntries), available: true },
      volume: { value: totalVolume(workoutEntries), available: true },
      streak: { value: currentWeekStreak(workoutEntries), available: true },
      consistency: { value: bestMonthWorkoutCount(workoutEntries), available: true },
      golf: { value: golfSessionCount(golfActivityEntries), available: true },
      protein: {
        value: currentProteinStreak(foodEntries, proteinTargetG),
        available: proteinTargetG != null && proteinTargetG > 0,
      },
    };
    return BADGE_CATEGORIES.map((category) => {
      const { value, available } = values[category.id];
      return computeProgress(category, value, available);
    });
  }, [workoutEntries, foodEntries, golfActivityEntries, proteinTargetG]);

  return (
    <section aria-labelledby="badges-heading" className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <h2 id="badges-heading" className="mb-2 text-sm font-semibold text-neutral-300">
        Badges
      </h2>
      {loading && <p className="text-sm text-neutral-500">Loading…</p>}
      <ul className="space-y-2.5">
        {progressList.map((progress) => {
          const { category, currentTier, nextTier, progressToNext, unlockedTiers, available, value } = progress;
          const hint = nextGoalHint(progress);
          return (
            <li key={category.id} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-sm text-neutral-200">
                  <span aria-hidden="true">{category.icon}</span> {category.title}
                </span>
                <span className="shrink-0 text-[11px] text-neutral-500">
                  {available ? `${unlockedTiers.length}/${category.tiers.length} unlocked` : ""}
                </span>
              </div>
              {!available ? (
                <p className="text-[11px] text-neutral-500">
                  <Link href="/settings" className="text-emerald-400 hover:underline">
                    Set a protein target in Settings
                  </Link>{" "}
                  to track this.
                </p>
              ) : (
                <>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.round((nextTier == null ? 1 : currentTier == null && value === 0 ? 0 : progressToNext) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    {hint ?? "All badges unlocked 🎉"}
                    {hint && currentTier != null && <span className="text-neutral-600"> · now {category.describe(value)}</span>}
                  </p>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
