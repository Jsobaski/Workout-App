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
  /** The part of totalVolume that is weight actually lifted (logged weight x load multiplier). */
  loadedVolume: number;
  /** The part of totalVolume credited from bodyweight (bodyweight-logged sets). */
  bodyweightVolume: number;
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
export function entryVolumeParts(entry: WorkoutEntry, opts: VolumeOptions = {}): { loaded: number; bodyweight: number } {
  if (entry.timed) return { loaded: 0, bodyweight: 0 };
  const cfg = resolveExerciseConfig(entry.exerciseName, opts.settings);
  const bodyweightLb = opts.bodyweightLb && opts.bodyweightLb > 0 ? opts.bodyweightLb : BODYWEIGHT_FALLBACK_LB;
  const fraction = cfg?.bodyweightFraction ?? DEFAULT_BODYWEIGHT_FRACTION;
  const multiplier = cfg?.loadMultiplier ?? 1;
  const sides = cfg?.sides ?? 1;
  let loaded = 0;
  let bodyweight = 0;
  for (const set of entry.sets) {
    const load = effectiveLoadForSet(set.weight, { isBodyweight: entry.bodyweight, bodyweightLb, bodyweightFraction: fraction, loadMultiplier: multiplier, sides });
    const credit = entry.bodyweight ? bodyweightLb * fraction : 0;
    bodyweight += set.reps * credit;
    loaded += set.reps * (load - credit);
  }
  return { loaded, bodyweight };
}

export function entryVolume(entry: WorkoutEntry, opts: VolumeOptions = {}): number {
  const { loaded, bodyweight } = entryVolumeParts(entry, opts);
  return loaded + bodyweight;
}

export function workoutSummary(entries: WorkoutEntry[], opts: VolumeOptions = {}): DayWorkoutSummary {
  const muscleGroups = new Set<string>();
  let setCount = 0;
  let loadedVolume = 0;
  let bodyweightVolume = 0;
  for (const entry of entries) {
    entry.muscleGroups.forEach((g) => muscleGroups.add(g));
    setCount += entry.sets.length;
    const parts = entryVolumeParts(entry, opts);
    loadedVolume += parts.loaded;
    bodyweightVolume += parts.bodyweight;
  }
  return {
    exerciseCount: entries.length,
    setCount,
    muscleGroups: Array.from(muscleGroups),
    totalVolume: Math.round(loadedVolume + bodyweightVolume),
    loadedVolume: Math.round(loadedVolume),
    bodyweightVolume: Math.round(bodyweightVolume),
  };
}

export function maxWeightForExercise(entry: WorkoutEntry): number {
  return entry.sets.reduce((max, s) => Math.max(max, s.weight), 0);
}
