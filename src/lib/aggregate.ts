import { FoodEntry, WorkoutEntry } from "./types";
import { ExerciseSettingsData, effectiveLoadForSet, resolveExerciseConfig } from "./exerciseSettings";
import { BODYWEIGHT_FALLBACK_LB, DEFAULT_BODYWEIGHT_FRACTION } from "./muscleScoreConfig";

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
  totalVolume: number; // sum of reps * effective load across all sets (same load basis as the muscle scoring)
}

export interface VolumeOptions {
  bodyweightLb?: number | null;
  settings?: ExerciseSettingsData;
}

/**
 * Volume for one entry using the same effective-load logic as the strength
 * scoring: bodyweight-logged sets are credited their per-exercise share of
 * bodyweight (0 for planks, clamshells, ...), and logged weights are scaled by
 * the exercise's load multiplier. Timed holds carry no rep volume.
 */
export function entryVolume(entry: WorkoutEntry, opts: VolumeOptions = {}): number {
  if (entry.timed) return 0;
  const cfg = resolveExerciseConfig(entry.exerciseName, opts.settings);
  const bodyweightLb = opts.bodyweightLb && opts.bodyweightLb > 0 ? opts.bodyweightLb : BODYWEIGHT_FALLBACK_LB;
  return entry.sets.reduce(
    (sum, set) =>
      sum +
      set.reps *
        effectiveLoadForSet(set.weight, {
          isBodyweight: entry.bodyweight,
          bodyweightLb,
          bodyweightFraction: cfg?.bodyweightFraction ?? DEFAULT_BODYWEIGHT_FRACTION,
          loadMultiplier: cfg?.loadMultiplier ?? 1,
        }),
    0
  );
}

export function workoutSummary(entries: WorkoutEntry[], opts: VolumeOptions = {}): DayWorkoutSummary {
  const muscleGroups = new Set<string>();
  let setCount = 0;
  let totalVolume = 0;
  for (const entry of entries) {
    entry.muscleGroups.forEach((g) => muscleGroups.add(g));
    setCount += entry.sets.length;
    totalVolume += entryVolume(entry, opts);
  }
  return {
    exerciseCount: entries.length,
    setCount,
    muscleGroups: Array.from(muscleGroups),
    totalVolume: Math.round(totalVolume),
  };
}

export function maxWeightForExercise(entry: WorkoutEntry): number {
  return entry.sets.reduce((max, s) => Math.max(max, s.weight), 0);
}
