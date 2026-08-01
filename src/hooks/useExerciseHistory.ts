"use client";

import { useEffect, useState } from "react";
import { listAllWorkoutEntries } from "@/lib/db";
import { formatShortDate } from "@/lib/date";
import { maxWeightForExercise } from "@/lib/aggregate";

export interface ExerciseHistoryPoint {
  dateKey: string;
  label: string;
  maxWeight: number;
}

export function useExerciseHistory(exerciseName: string | null) {
  const [points, setPoints] = useState<ExerciseHistoryPoint[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!exerciseName) {
        if (!cancelled) setPoints([]);
        return;
      }
      const all = await listAllWorkoutEntries();
      const matching = all
        .filter((e) => e.exerciseName === exerciseName)
        .sort((a, b) => a.timestamp - b.timestamp);
      if (!cancelled) {
        setPoints(
          matching.map((e) => ({
            dateKey: e.dateKey,
            label: formatShortDate(e.dateKey),
            maxWeight: maxWeightForExercise(e),
          }))
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exerciseName]);

  return points;
}
