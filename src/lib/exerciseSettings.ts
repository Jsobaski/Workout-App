// Per-exercise scoring/safety settings: built-in defaults live on each
// ExerciseMapping; the user's edits are stored as sparse overrides (keyed by
// canonical exercise key) and merged on top here. Pure — no DB or React.
import {
  EXERCISE_MUSCLE_MAP,
  ExerciseMapping,
  LoadBasis,
  canonicalExerciseKey,
  exerciseDisplayName,
} from "./exerciseMuscleMap";
import { DEFAULT_BODYWEIGHT_FRACTION } from "./muscleScoreConfig";

export interface ExerciseSettingOverride {
  loadMultiplier?: number;
  loadBasis?: LoadBasis;
  bodyweightFraction?: number;
  restricted?: boolean;
  restrictionNote?: string;
  needsPtConfirmation?: boolean;
}

export type ExerciseSettingsOverrides = Record<string, ExerciseSettingOverride>;

/** Shape persisted in the IndexedDB `settings` store. */
export interface ExerciseSettingsRecord {
  key: "exerciseSettings";
  overrides: ExerciseSettingsOverrides;
}

export interface ResolvedExerciseConfig {
  /** Canonical EXERCISE_MUSCLE_MAP key — all name variants of one movement share it. */
  key: string;
  displayName: string;
  mapping: ExerciseMapping;
  loadMultiplier: number;
  loadBasis: LoadBasis;
  bodyweightFraction: number;
  restricted: boolean;
  restrictionNote?: string;
  needsPtConfirmation: boolean;
}

export function resolveConfigForKey(key: string, overrides?: ExerciseSettingsOverrides): ResolvedExerciseConfig | null {
  const mapping = EXERCISE_MUSCLE_MAP[key];
  if (!mapping) return null;
  const o = overrides?.[key];
  return {
    key,
    displayName: exerciseDisplayName(key),
    mapping,
    loadMultiplier: o?.loadMultiplier ?? mapping.loadMultiplier ?? 1,
    loadBasis: o?.loadBasis ?? mapping.loadBasis ?? "total",
    bodyweightFraction: o?.bodyweightFraction ?? mapping.bodyweightFraction ?? DEFAULT_BODYWEIGHT_FRACTION,
    restricted: o?.restricted ?? mapping.restricted ?? false,
    restrictionNote: o?.restrictionNote ?? mapping.restrictionNote,
    needsPtConfirmation: o?.needsPtConfirmation ?? mapping.needsPtConfirmation ?? false,
  };
}

/** Resolved settings for a logged exercise name, or null when it isn't mapped. */
export function resolveExerciseConfig(
  exerciseName: string,
  overrides?: ExerciseSettingsOverrides
): ResolvedExerciseConfig | null {
  const key = canonicalExerciseKey(exerciseName);
  return key ? resolveConfigForKey(key, overrides) : null;
}

/**
 * Effective load for one set: the logged weight scaled by the load multiplier,
 * plus (for bodyweight-logged sets) the credited share of bodyweight. Shared by
 * the strength scoring and the workout "Total volume" so the two agree.
 */
export function effectiveLoadForSet(
  setWeight: number,
  opts: { isBodyweight?: boolean; bodyweightLb: number; bodyweightFraction: number; loadMultiplier: number }
): number {
  const added = Math.max(0, setWeight) * opts.loadMultiplier;
  return opts.isBodyweight ? opts.bodyweightLb * opts.bodyweightFraction + added : added;
}

export function isExerciseRestricted(exerciseName: string, overrides?: ExerciseSettingsOverrides): boolean {
  return resolveExerciseConfig(exerciseName, overrides)?.restricted ?? false;
}

export interface RestrictionInfo {
  name: string;
  note?: string;
}

/** Every canonical exercise currently restricted (defaults + overrides). */
export function listRestrictedExercises(overrides?: ExerciseSettingsOverrides): RestrictionInfo[] {
  const result: RestrictionInfo[] = [];
  for (const key of Object.keys(EXERCISE_MUSCLE_MAP)) {
    const cfg = resolveConfigForKey(key, overrides);
    if (cfg?.restricted) result.push({ name: cfg.displayName, note: cfg.restrictionNote });
  }
  return result;
}

/** Every canonical exercise flagged "needs PT confirmation" (and not restricted). */
export function listNeedsPtConfirmation(overrides?: ExerciseSettingsOverrides): string[] {
  const result: string[] = [];
  for (const key of Object.keys(EXERCISE_MUSCLE_MAP)) {
    const cfg = resolveConfigForKey(key, overrides);
    if (cfg && cfg.needsPtConfirmation && !cfg.restricted) result.push(cfg.displayName);
  }
  return result;
}
