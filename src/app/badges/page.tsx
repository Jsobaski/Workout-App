"use client";

import { useMemo } from "react";
import { useBadgeData } from "@/hooks/useBadgeData";
import BadgeCard from "@/components/BadgeCard";
import {
  BADGE_CATEGORIES,
  bestMonthWorkoutCount,
  computeProgress,
  currentProteinStreak,
  currentWeekStreak,
  golfSessionCount,
  totalVolume,
  totalWorkoutDays,
} from "@/lib/badges";

export default function BadgesPage() {
  const { workoutEntries, foodEntries, golfActivityEntries, proteinTargetG, loading } =
    useBadgeData();

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
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-100">Badges</h1>
        <p className="text-xs text-neutral-500">
          Accomplishments so far, and what&apos;s next — computed from what
          you&apos;ve already logged.
        </p>
      </div>

      {loading && <p className="text-sm text-neutral-500">Loading…</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {progressList.map((progress) => (
          <BadgeCard key={progress.category.id} progress={progress} />
        ))}
      </div>
    </div>
  );
}
