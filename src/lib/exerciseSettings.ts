// Per-device exercise settings. The shared exercise library (exerciseMuscleMap.ts)
// is neutral: nothing is restricted, flagged, load-adjusted or tagged as a
// priority. Everything personal lives here as local overrides stored in this
// device's IndexedDB: per-exercise overrides, movement-pattern restrictions and
// priority muscles. Pure — no DB or React.
import {
  EXERCISE_MUSCLE_MAP,
  ExerciseMapping,
  LoadBasis,
  MOVEMENT_PATTERNS,
  MovementPattern,
  canonicalExerciseKey,
  exerciseDisplayName,
} from "./exerciseMuscleMap";
import { DEFAULT_BODYWEIGHT_FRACTION } from "./muscleScoreConfig";
import { MUSCLE_GROUPS, MuscleGroupId } from "./muscleTaxonomy";

export interface ExerciseSettingOverride {
  /** logged weight x this = effective load. Unset -> 1.0. Manual only — nothing adjusts it automatically. */
  loadMultiplier?: number;
  loadBasis?: LoadBasis;
  bodyweightFraction?: number;
  /** true = restricted, false = explicitly allowed (wins over a restricted pattern), unset = follow the pattern. */
  restricted?: boolean;
  restrictionNote?: string;
  /**
   * Restricting an exercise that has a movement pattern automatically restricts that pattern
   * (every other exercise sharing it). Set this to restrict ONLY this exercise instead —
   * an optional correction, never required.
   */
  onlyThisExercise?: boolean;
  /** Per-exercise limit like "2x10": shown on suggestion chips, and suggestions never go beyond it. */
  limit?: string;
  /** Show a "confirm first" flag on suggestions of this exercise. */
  needsConfirmation?: boolean;
}

export type ExerciseSettingsOverrides = Record<string, ExerciseSettingOverride>;

/** A restricted movement pattern (presence = restricted); applies to every tagged exercise and its aliases. */
export type PatternRestrictions = Partial<Record<MovementPattern, { note?: string }>>;

/** Everything this device knows about the user's exercise preferences. */
export interface ExerciseSettingsData {
  overrides: ExerciseSettingsOverrides;
  patterns: PatternRestrictions;
  /** Muscles the user has tagged as priorities (e.g. relevant to their sport). Default: none. */
  focusMuscles: MuscleGroupId[];
}

/** Shape persisted in the IndexedDB `settings` store. */
export interface ExerciseSettingsRecord {
  key: "exerciseSettings";
  overrides?: ExerciseSettingsOverrides;
  patterns?: PatternRestrictions;
  focusMuscles?: MuscleGroupId[];
}

export function emptyExerciseSettings(): ExerciseSettingsData {
  return { overrides: {}, patterns: {}, focusMuscles: [] };
}

const MUSCLE_IDS = new Set<string>(MUSCLE_GROUPS.map((g) => g.id));
const PATTERN_IDS = new Set<string>(MOVEMENT_PATTERNS.map((p) => p.id));

/**
 * Reads whatever was stored (including older shapes) into the current shape:
 * keys are moved onto canonical exercise keys (brand/variant names -> generic
 * entries), the retired "selfRestricted"/"needsPtConfirmation"/"calibrate"
 * fields are mapped or dropped, and unknown patterns/muscles are ignored.
 */
export function normalizeExerciseSettings(raw: unknown): ExerciseSettingsData {
  const result = emptyExerciseSettings();
  if (!raw || typeof raw !== "object") return result;
  const record = raw as Record<string, unknown>;
  // Older backups stored the bare overrides map.
  const looksLegacyBare = !("overrides" in record) && !("patterns" in record) && !("focusMuscles" in record) && !("key" in record);
  const rawOverrides = (looksLegacyBare ? record : record.overrides) as Record<string, Record<string, unknown>> | undefined;

  for (const [rawKey, value] of Object.entries(rawOverrides ?? {})) {
    if (!value || typeof value !== "object") continue;
    const key = canonicalExerciseKey(rawKey) ?? rawKey.trim().toLowerCase();
    const next: ExerciseSettingOverride = { ...result.overrides[key] };
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
    if (num(value.loadMultiplier) != null) next.loadMultiplier = num(value.loadMultiplier);
    if (num(value.bodyweightFraction) != null) next.bodyweightFraction = num(value.bodyweightFraction);
    if (typeof value.loadBasis === "string") next.loadBasis = value.loadBasis as LoadBasis;
    if (typeof value.restricted === "boolean") next.restricted = value.restricted;
    if (typeof value.restrictionNote === "string" && value.restrictionNote.trim()) next.restrictionNote = value.restrictionNote.trim();
    if (value.onlyThisExercise === true) next.onlyThisExercise = true;
    if (typeof value.limit === "string" && value.limit.trim()) next.limit = value.limit.trim();
    const confirm = value.needsConfirmation ?? value.needsPtConfirmation;
    if (typeof confirm === "boolean") next.needsConfirmation = confirm;
    if (value.selfRestricted === true && next.restricted === undefined) {
      next.restricted = true;
      next.restrictionNote = next.restrictionNote ?? "Self-restricted";
    }
    if (Object.keys(next).length > 0) result.overrides[key] = next;
  }

  const rawPatterns = record.patterns as Record<string, { note?: unknown }> | undefined;
  for (const [id, value] of Object.entries(rawPatterns ?? {})) {
    if (!PATTERN_IDS.has(id) || !value) continue;
    const note = typeof value.note === "string" && value.note.trim() ? value.note.trim() : undefined;
    result.patterns[id as MovementPattern] = note ? { note } : {};
  }

  if (Array.isArray(record.focusMuscles)) {
    result.focusMuscles = record.focusMuscles.filter((m): m is MuscleGroupId => typeof m === "string" && MUSCLE_IDS.has(m));
  }
  return result;
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
  /** Where the restriction comes from: this exercise's own override, or a restricted movement pattern. */
  restrictionSource: "exercise" | "pattern" | null;
  restrictionNote?: string;
  limit?: string;
  needsConfirmation: boolean;
}

/**
 * Patterns restricted automatically because the user restricted an exercise that carries them
 * (unless that exercise is marked "only this exercise"). Keyed pattern -> the exercise that caused it.
 */
const impliedCache = new WeakMap<ExerciseSettingsData, Partial<Record<MovementPattern, string>>>();
export function impliedPatternRestrictions(settings: ExerciseSettingsData | undefined): Partial<Record<MovementPattern, string>> {
  if (!settings) return {};
  const cached = impliedCache.get(settings);
  if (cached) return cached;
  const implied: Partial<Record<MovementPattern, string>> = {};
  for (const [key, o] of Object.entries(settings.overrides)) {
    if (o.restricted !== true || o.onlyThisExercise) continue;
    for (const id of EXERCISE_MUSCLE_MAP[key]?.patterns ?? []) {
      if (!implied[id]) implied[id] = exerciseDisplayName(key);
    }
  }
  impliedCache.set(settings, implied);
  return implied;
}

/** True when this exercise's restriction also restricts its movement pattern(s) — drives the "Also skipping…" note. */
export function restrictionSpreadsToPattern(key: string, settings: ExerciseSettingsData): MovementPattern[] {
  const o = settings.overrides[key];
  if (o?.restricted !== true || o.onlyThisExercise) return [];
  return [...(EXERCISE_MUSCLE_MAP[key]?.patterns ?? [])];
}

function patternRestriction(
  mapping: ExerciseMapping,
  settings: ExerciseSettingsData | undefined
): { note: string } | null {
  const implied = impliedPatternRestrictions(settings);
  for (const id of mapping.patterns ?? []) {
    const def = MOVEMENT_PATTERNS.find((p) => p.id === id)!;
    const hit = settings?.patterns[id];
    if (hit) return { note: hit.note ?? `${def.label} restricted` };
    if (implied[id]) return { note: `${def.label} restricted (via ${implied[id]})` };
  }
  return null;
}

export function resolveConfigForKey(key: string, settings?: ExerciseSettingsData): ResolvedExerciseConfig | null {
  const mapping = EXERCISE_MUSCLE_MAP[key];
  if (!mapping) return null;
  const o = settings?.overrides[key];

  // Per-exercise overrides win over the pattern (restricted: false = "allowed anyway").
  let restricted = false;
  let restrictionSource: ResolvedExerciseConfig["restrictionSource"] = null;
  let restrictionNote: string | undefined;
  if (o?.restricted !== undefined) {
    restricted = o.restricted;
    if (restricted) {
      restrictionSource = "exercise";
      restrictionNote = o.restrictionNote;
    }
  } else {
    const hit = patternRestriction(mapping, settings);
    if (hit) {
      restricted = true;
      restrictionSource = "pattern";
      restrictionNote = o?.restrictionNote ?? hit.note;
    }
  }

  return {
    key,
    displayName: exerciseDisplayName(key),
    mapping,
    loadMultiplier: o?.loadMultiplier ?? 1,
    loadBasis: o?.loadBasis ?? mapping.loadBasis ?? "total",
    bodyweightFraction: o?.bodyweightFraction ?? mapping.bodyweightFraction ?? DEFAULT_BODYWEIGHT_FRACTION,
    restricted,
    restrictionSource,
    restrictionNote,
    limit: o?.limit,
    needsConfirmation: o?.needsConfirmation ?? false,
  };
}

/** Resolved settings for a logged exercise name, or null when it isn't mapped. */
export function resolveExerciseConfig(exerciseName: string, settings?: ExerciseSettingsData): ResolvedExerciseConfig | null {
  const key = canonicalExerciseKey(exerciseName);
  return key ? resolveConfigForKey(key, settings) : null;
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

/** True when the user has restricted anything at all (an exercise or a pattern). With none, nothing is filtered or flagged. */
export function hasAnyRestrictions(settings?: ExerciseSettingsData): boolean {
  if (!settings) return false;
  if (Object.keys(settings.patterns).length > 0) return true;
  return Object.values(settings.overrides).some((o) => o.restricted === true);
}

/** Excluded from suggestions: restricted by this exercise's override or by a restricted pattern. */
export function isExerciseRestricted(exerciseName: string, settings?: ExerciseSettingsData): boolean {
  return resolveExerciseConfig(exerciseName, settings)?.restricted ?? false;
}

export interface RestrictionInfo {
  name: string;
  note?: string;
  source: "exercise" | "pattern";
}

/** Every canonical exercise currently excluded from suggestions. Empty when the user restricted nothing. */
export function listRestrictedExercises(settings?: ExerciseSettingsData): RestrictionInfo[] {
  const result: RestrictionInfo[] = [];
  for (const key of Object.keys(EXERCISE_MUSCLE_MAP)) {
    const cfg = resolveConfigForKey(key, settings);
    if (cfg?.restricted && cfg.restrictionSource) {
      result.push({ name: cfg.displayName, note: cfg.restrictionNote, source: cfg.restrictionSource });
    }
  }
  return result;
}

export interface LimitInfo {
  name: string;
  limit: string;
}

/** Allowed exercises the user capped (e.g. "2x10"). */
export function listLimitedExercises(settings?: ExerciseSettingsData): LimitInfo[] {
  const result: LimitInfo[] = [];
  for (const key of Object.keys(EXERCISE_MUSCLE_MAP)) {
    const cfg = resolveConfigForKey(key, settings);
    if (cfg && !cfg.restricted && cfg.limit) result.push({ name: cfg.displayName, limit: cfg.limit });
  }
  return result;
}

/** Exercises the user flagged "confirm first" (and that aren't restricted). */
export function listNeedsConfirmation(settings?: ExerciseSettingsData): string[] {
  const result: string[] = [];
  for (const key of Object.keys(EXERCISE_MUSCLE_MAP)) {
    const cfg = resolveConfigForKey(key, settings);
    if (cfg && cfg.needsConfirmation && !cfg.restricted) result.push(cfg.displayName);
  }
  return result;
}

/** Non-hidden, non-restricted exercises that train `group` directly (primary credit). */
export function allowedPrimaryExercises(group: MuscleGroupId, settings?: ExerciseSettingsData): string[] {
  const result: string[] = [];
  for (const [key, mapping] of Object.entries(EXERCISE_MUSCLE_MAP)) {
    if (mapping.hidden) continue;
    const contribution = mapping.muscles.find((m) => m.group === group);
    if (!contribution || contribution.weight < 1.0) continue;
    const cfg = resolveConfigForKey(key, settings);
    if (cfg && !cfg.restricted) result.push(cfg.displayName);
  }
  return result;
}

/** A muscle's decay is "paused" only when it has no allowed exercise at all. */
export function groupHasAllowedExercise(group: MuscleGroupId, settings?: ExerciseSettingsData): boolean {
  return allowedPrimaryExercises(group, settings).length > 0;
}
