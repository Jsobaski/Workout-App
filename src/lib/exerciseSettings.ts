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
import type { MuscleGroupId } from "./muscleTaxonomy";

export interface ExerciseSettingOverride {
  loadMultiplier?: number;
  loadBasis?: LoadBasis;
  bodyweightFraction?: number;
  /** PT restriction: never suggested; can pause decay when the muscle has no allowed exercise. */
  restricted?: boolean;
  restrictionNote?: string;
  needsPtConfirmation?: boolean;
  /** The user's own call: never suggested, but not a PT restriction. */
  selfRestricted?: boolean;
  /** Auto-calibrate a machine lift against its free-weight anchor (default on). */
  calibrate?: boolean;
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
  selfRestricted: boolean;
  /** Anchor canonical key, only when auto-calibration is on for this exercise. */
  calibrationAnchor?: string;
  /** The mapping defines an anchor (whether or not the user turned calibration off). */
  hasCalibrationAnchor: boolean;
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
    selfRestricted: o?.selfRestricted ?? mapping.selfRestricted ?? false,
    calibrationAnchor: (o?.calibrate ?? true) ? mapping.calibrationAnchor : undefined,
    hasCalibrationAnchor: mapping.calibrationAnchor != null,
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

/** Excluded from every suggestion surface: PT-restricted or self-restricted. */
export function isExerciseRestricted(exerciseName: string, overrides?: ExerciseSettingsOverrides): boolean {
  const cfg = resolveExerciseConfig(exerciseName, overrides);
  return cfg ? cfg.restricted || cfg.selfRestricted : false;
}

export interface RestrictionInfo {
  name: string;
  note?: string;
  kind: "pt" | "self";
}

/** Every canonical exercise currently excluded from suggestions (PT-restricted or self-restricted). */
export function listRestrictedExercises(overrides?: ExerciseSettingsOverrides): RestrictionInfo[] {
  const result: RestrictionInfo[] = [];
  for (const key of Object.keys(EXERCISE_MUSCLE_MAP)) {
    const cfg = resolveConfigForKey(key, overrides);
    if (!cfg) continue;
    if (cfg.restricted) result.push({ name: cfg.displayName, note: cfg.restrictionNote, kind: "pt" });
    else if (cfg.selfRestricted) result.push({ name: cfg.displayName, note: cfg.restrictionNote ?? "Self-restricted", kind: "self" });
  }
  return result;
}

/** Every canonical exercise flagged "needs PT confirmation" (and not restricted). */
export function listNeedsPtConfirmation(overrides?: ExerciseSettingsOverrides): string[] {
  const result: string[] = [];
  for (const key of Object.keys(EXERCISE_MUSCLE_MAP)) {
    const cfg = resolveConfigForKey(key, overrides);
    if (cfg && cfg.needsPtConfirmation && !cfg.restricted && !cfg.selfRestricted) result.push(cfg.displayName);
  }
  return result;
}

/**
 * Non-hidden, non-restricted exercises that train `group` directly (primary
 * credit). "Needs PT confirmation" exercises count as allowed.
 */
export function allowedPrimaryExercises(group: MuscleGroupId, overrides?: ExerciseSettingsOverrides): string[] {
  const result: string[] = [];
  for (const [key, mapping] of Object.entries(EXERCISE_MUSCLE_MAP)) {
    if (mapping.hidden) continue;
    const contribution = mapping.muscles.find((m) => m.group === group);
    if (!contribution || contribution.weight < 1.0) continue;
    const cfg = resolveConfigForKey(key, overrides);
    if (cfg && !cfg.restricted && !cfg.selfRestricted) result.push(cfg.displayName);
  }
  return result;
}

/** A muscle's decay is "paused" only when it has no allowed exercise at all. */
export function groupHasAllowedExercise(group: MuscleGroupId, overrides?: ExerciseSettingsOverrides): boolean {
  return allowedPrimaryExercises(group, overrides).length > 0;
}
