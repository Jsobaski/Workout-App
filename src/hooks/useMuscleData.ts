"use client";

import { useEffect, useState } from "react";
import { getCoachingContext, listAllWorkoutEntries } from "@/lib/db";
import { WorkoutEntry } from "@/lib/types";

export function useMuscleData() {
  const [entries, setEntries] = useState<WorkoutEntry[]>([]);
  const [bodyweightLb, setBodyweightLb] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [workouts, coaching] = await Promise.all([
          listAllWorkoutEntries(),
          getCoachingContext(),
        ]);
        if (!cancelled) {
          setEntries(workouts);
          setBodyweightLb(coaching.currentWeightLb);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { entries, bodyweightLb, loading };
}
