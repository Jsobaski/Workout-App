"use client";

import { useEffect, useMemo, useState } from "react";
import { getCoachingContext, listAllFoodEntries, listAllWorkoutEntries } from "@/lib/db";
import { shiftDateKey, todayKey } from "@/lib/date";
import { useExerciseSettings } from "@/hooks/useExerciseSettings";
import { computeWins } from "@/lib/wins";
import { buildWeeklyRecap } from "@/lib/recap";
import { FoodEntry, WorkoutEntry } from "@/lib/types";

const WINS_WINDOW_DAYS = 35;

/** Recent wins and the weekly recap, derived from the full log. `refreshKey` reloads after saves. */
export function useProgressData(refreshKey: number) {
  const { settings } = useExerciseSettings();
  const [workouts, setWorkouts] = useState<WorkoutEntry[]>([]);
  const [foods, setFoods] = useState<FoodEntry[]>([]);
  const [bodyweightLb, setBodyweightLb] = useState<number | null>(null);
  const [proteinTargetG, setProteinTargetG] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [w, f, ctx] = await Promise.all([listAllWorkoutEntries(), listAllFoodEntries(), getCoachingContext()]);
        if (cancelled) return;
        setWorkouts(w);
        setFoods(f);
        setBodyweightLb(ctx.currentWeightLb);
        setProteinTargetG(ctx.proteinTargetG);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return useMemo(() => {
    const today = todayKey();
    const wins = computeWins(workouts, { bodyweightLb, settings, sinceDateKey: shiftDateKey(today, -WINS_WINDOW_DAYS) });
    const recap = buildWeeklyRecap(today, workouts, foods, wins, { bodyweightLb, settings, proteinTargetG });
    return { loaded, hasWorkouts: workouts.length > 0, wins, recap };
  }, [workouts, foods, bodyweightLb, proteinTargetG, settings, loaded]);
}
