"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteFoodEntry,
  deleteGolfActivityEntry,
  deleteWorkoutEntry,
  listFoodEntriesForDate,
  listGolfActivityEntriesForDate,
  listWorkoutEntriesForDate,
  saveFoodEntry,
  saveGolfActivityEntry,
  saveWorkoutEntry,
} from "@/lib/db";
import { FoodEntry, GolfActivityEntry, WorkoutEntry } from "@/lib/types";

export function useDayData(dateKey: string) {
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);
  const [workoutEntries, setWorkoutEntries] = useState<WorkoutEntry[]>([]);
  const [golfActivityEntries, setGolfActivityEntries] = useState<GolfActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [food, workouts, golfActivities] = await Promise.all([
        listFoodEntriesForDate(dateKey),
        listWorkoutEntriesForDate(dateKey),
        listGolfActivityEntriesForDate(dateKey),
      ]);
      setFoodEntries(food);
      setWorkoutEntries(workouts);
      setGolfActivityEntries(golfActivities);
    } finally {
      setLoading(false);
    }
  }, [dateKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [food, workouts, golfActivities] = await Promise.all([
          listFoodEntriesForDate(dateKey),
          listWorkoutEntriesForDate(dateKey),
          listGolfActivityEntriesForDate(dateKey),
        ]);
        if (!cancelled) {
          setFoodEntries(food);
          setWorkoutEntries(workouts);
          setGolfActivityEntries(golfActivities);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dateKey]);

  const addFoodEntry = useCallback(
    async (entry: Omit<FoodEntry, "id" | "dateKey">) => {
      await saveFoodEntry({ ...entry, dateKey });
      await refresh();
    },
    [dateKey, refresh]
  );

  const updateFoodEntry = useCallback(
    async (entry: FoodEntry) => {
      await saveFoodEntry(entry);
      await refresh();
    },
    [refresh]
  );

  const removeFoodEntry = useCallback(
    async (id: string) => {
      await deleteFoodEntry(id);
      await refresh();
    },
    [refresh]
  );

  const addWorkoutEntry = useCallback(
    async (entry: Omit<WorkoutEntry, "id" | "dateKey">) => {
      await saveWorkoutEntry({ ...entry, dateKey });
      await refresh();
    },
    [dateKey, refresh]
  );

  const updateWorkoutEntry = useCallback(
    async (entry: WorkoutEntry) => {
      await saveWorkoutEntry(entry);
      await refresh();
    },
    [refresh]
  );

  const removeWorkoutEntry = useCallback(
    async (id: string) => {
      await deleteWorkoutEntry(id);
      await refresh();
    },
    [refresh]
  );

  const addGolfActivityEntry = useCallback(
    async (entry: Omit<GolfActivityEntry, "id" | "dateKey">) => {
      await saveGolfActivityEntry({ ...entry, dateKey });
      await refresh();
    },
    [dateKey, refresh]
  );

  const removeGolfActivityEntry = useCallback(
    async (id: string) => {
      await deleteGolfActivityEntry(id);
      await refresh();
    },
    [refresh]
  );

  return {
    foodEntries,
    workoutEntries,
    golfActivityEntries,
    loading,
    refresh,
    addFoodEntry,
    updateFoodEntry,
    removeFoodEntry,
    addWorkoutEntry,
    updateWorkoutEntry,
    removeWorkoutEntry,
    addGolfActivityEntry,
    removeGolfActivityEntry,
  };
}
