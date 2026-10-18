"use client";

import { useEffect, useMemo, useState } from "react";
import { listFoodEntriesInRange, listWorkoutEntriesInRange } from "@/lib/db";
import { dateKeysInRange, formatShortDate, todayKey } from "@/lib/date";
import { FoodEntry, WorkoutEntry } from "@/lib/types";
import { nutritionTotals } from "@/lib/aggregate";

export interface DailyPoint {
  dateKey: string;
  label: string;
  calories: number;
  proteinG: number;
  trained: boolean;
}

export function useTrendsData(days: number) {
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);
  const [workoutEntries, setWorkoutEntries] = useState<WorkoutEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const dateKeys = useMemo(() => dateKeysInRange(todayKey(), days), [days]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [food, workouts] = await Promise.all([
          listFoodEntriesInRange(dateKeys),
          listWorkoutEntriesInRange(dateKeys),
        ]);
        if (!cancelled) {
          setFoodEntries(food);
          setWorkoutEntries(workouts);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dateKeys]);

  const dailyPoints: DailyPoint[] = useMemo(() => {
    return dateKeys.map((dateKey) => {
      const foodForDay = foodEntries.filter((e) => e.dateKey === dateKey);
      const totals = nutritionTotals(foodForDay);
      const trained = workoutEntries.some((e) => e.dateKey === dateKey);
      return {
        dateKey,
        label: formatShortDate(dateKey),
        calories: totals.calories,
        proteinG: totals.proteinG,
        trained,
      };
    });
  }, [dateKeys, foodEntries, workoutEntries]);

  const weeklyFrequency = useMemo(() => {
    const weeks = new Map<string, Set<string>>();
    for (const dateKey of dateKeys) {
      const weekKey = isoWeekKey(dateKey);
      if (!weeks.has(weekKey)) weeks.set(weekKey, new Set());
    }
    for (const entry of workoutEntries) {
      const weekKey = isoWeekKey(entry.dateKey);
      if (!weeks.has(weekKey)) weeks.set(weekKey, new Set());
      weeks.get(weekKey)!.add(entry.dateKey);
    }
    return Array.from(weeks.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekKey, daySet]) => ({ weekKey, daysTrained: daySet.size }));
  }, [dateKeys, workoutEntries]);

  return {
    dailyPoints,
    weeklyFrequency,
    workoutEntries,
    hasFoodData: foodEntries.length > 0,
    hasWorkoutData: workoutEntries.length > 0,
    loading,
  };
}

function isoWeekKey(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  const day = date.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - diffToMonday);
  return monday.toISOString().slice(0, 10);
}
