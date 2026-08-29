"use client";

import { useEffect, useState } from "react";
import {
  getCoachingContext,
  listAllFoodEntries,
  listAllGolfActivityEntries,
  listAllWorkoutEntries,
} from "@/lib/db";
import { FoodEntry, GolfActivityEntry, WorkoutEntry } from "@/lib/types";

export function useBadgeData() {
  const [workoutEntries, setWorkoutEntries] = useState<WorkoutEntry[]>([]);
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);
  const [golfActivityEntries, setGolfActivityEntries] = useState<GolfActivityEntry[]>([]);
  const [proteinTargetG, setProteinTargetG] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [workouts, foods, golf, coaching] = await Promise.all([
          listAllWorkoutEntries(),
          listAllFoodEntries(),
          listAllGolfActivityEntries(),
          getCoachingContext(),
        ]);
        if (!cancelled) {
          setWorkoutEntries(workouts);
          setFoodEntries(foods);
          setGolfActivityEntries(golf);
          setProteinTargetG(coaching.proteinTargetG);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { workoutEntries, foodEntries, golfActivityEntries, proteinTargetG, loading };
}
