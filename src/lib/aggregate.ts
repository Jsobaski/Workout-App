import { FoodEntry, WorkoutEntry } from "./types";

export interface DayNutritionTotals {
  calories: number;
  proteinG: number;
}

export function nutritionTotals(entries: FoodEntry[]): DayNutritionTotals {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      proteinG: acc.proteinG + e.proteinG,
    }),
    { calories: 0, proteinG: 0 }
  );
}

export interface DayWorkoutSummary {
  exerciseCount: number;
  setCount: number;
  muscleGroups: string[];
  totalVolume: number; // sum of reps * weight across all sets
}

export function workoutSummary(entries: WorkoutEntry[]): DayWorkoutSummary {
  const muscleGroups = new Set<string>();
  let setCount = 0;
  let totalVolume = 0;
  for (const entry of entries) {
    entry.muscleGroups.forEach((g) => muscleGroups.add(g));
    setCount += entry.sets.length;
    totalVolume += entry.sets.reduce((s, set) => s + set.reps * set.weight, 0);
  }
  return {
    exerciseCount: entries.length,
    setCount,
    muscleGroups: Array.from(muscleGroups),
    totalVolume,
  };
}

export function maxWeightForExercise(entry: WorkoutEntry): number {
  return entry.sets.reduce((max, s) => Math.max(max, s.weight), 0);
}
