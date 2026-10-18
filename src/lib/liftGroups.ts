// Automatic lift grouping. Two exercises count as the SAME LIFT — sharing
// history, best e1RM and the 30-day comparison, and switching between them is
// not an "equipment change" — when they:
//   1. share the same primary muscle(s),
//   2. look alike by name or share a movement pattern, and
//   3. have the same load basis (stack, plates, free weight or bodyweight).
// A different load basis is never auto-grouped (a stack press and a dumbbell
// press are different lifts). Nothing to link or set up: it's derived from the
// shared library metadata, and the optional per-exercise load basis in Settings
// only matters if the user changes it.
import { EXERCISE_MUSCLE_MAP, ExerciseMapping } from "./exerciseMuscleMap";
import { ExerciseSettingsData, resolveConfigForKey } from "./exerciseSettings";

export type GroupingBasis = "free" | "stack" | "plates" | "combined" | "bodyweight";

// Words that describe equipment, grip, position or the muscle — not the lift itself.
const NON_DISTINGUISHING = new Set([
  "db", "dumbbell", "barbell", "bb", "ez", "bar", "machine", "cable", "seated", "standing", "lying", "one", "arm", "single",
  "wide", "close", "grip", "rope", "smith", "plate", "loaded", "kettlebell", "kb", "the", "with", "of", "and", "w", "bicep",
  "biceps", "tricep", "triceps",
]);
const SYNONYMS: Record<string, string> = { bench: "press", presses: "press", curls: "curl", raises: "raise", rows: "row" };

function singular(word: string): string {
  return word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
}

/** The distinguishing words of an exercise name ("db bench press" -> {press}, "preacher curl machine" -> {preacher, curl}). */
export function coreTokens(key: string): Set<string> {
  const tokens = key
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((t) => !NON_DISTINGUISHING.has(t))
    .map((t) => SYNONYMS[t] ?? singular(t));
  return new Set(tokens);
}

export function namesAreSimilar(a: string, b: string): boolean {
  const ta = coreTokens(a);
  const tb = coreTokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  const shared = [...ta].filter((t) => tb.has(t)).length;
  if (shared === 0) return false;
  if (shared === ta.size || shared === tb.size) return true; // one name's words are all in the other
  return shared / new Set([...ta, ...tb]).size >= 0.5;
}

function primaryMuscles(mapping: ExerciseMapping): string {
  return mapping.muscles.filter((m) => m.weight >= 1).map((m) => m.group).sort().join(",");
}

/** stack / plates / combined as labelled, bodyweight for bodyweight-first lifts, otherwise free weight. */
export function groupingBasis(key: string, settings?: ExerciseSettingsData): GroupingBasis {
  const cfg = resolveConfigForKey(key, settings);
  if (!cfg) return "free";
  if (cfg.loadBasis === "stack" || cfg.loadBasis === "plates" || cfg.loadBasis === "combined") return cfg.loadBasis;
  if ((cfg.mapping.bodyweightFraction ?? 0) > 0) return "bodyweight";
  return "free";
}

export function areSameLift(a: string, b: string, settings?: ExerciseSettingsData): boolean {
  const ma = EXERCISE_MUSCLE_MAP[a];
  const mb = EXERCISE_MUSCLE_MAP[b];
  if (!ma || !mb || a === b) return false;
  if (ma.scoring.method === "volumeOnly" || mb.scoring.method === "volumeOnly") return false; // reps/time work isn't compared by load
  const pa = primaryMuscles(ma);
  if (pa === "" || pa !== primaryMuscles(mb)) return false;
  if (groupingBasis(a, settings) !== groupingBasis(b, settings)) return false; // different load basis: never grouped
  const samePattern = (ma.patterns ?? []).some((p) => (mb.patterns ?? []).includes(p));
  return samePattern || namesAreSimilar(a, b);
}

const cache = new Map<string, Map<string, string>>();

/** canonical exercise key -> lift-group key (the alphabetically first member). Ungrouped exercises map to themselves. */
export function liftGroupMap(settings?: ExerciseSettingsData): Map<string, string> {
  const basisSignature = JSON.stringify(
    Object.entries(settings?.overrides ?? {})
      .filter(([, o]) => o.loadBasis != null)
      .map(([k, o]) => [k, o.loadBasis])
      .sort()
  );
  const cached = cache.get(basisSignature);
  if (cached) return cached;

  const keys = Object.keys(EXERCISE_MUSCLE_MAP).sort();
  const parent = new Map(keys.map((k) => [k, k]));
  const find = (k: string): string => {
    const p = parent.get(k)!;
    if (p === k) return k;
    const root = find(p);
    parent.set(k, root);
    return root;
  };
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      if (areSameLift(keys[i], keys[j], settings)) {
        const a = find(keys[i]);
        const b = find(keys[j]);
        if (a !== b) parent.set(a < b ? b : a, a < b ? a : b);
      }
    }
  }
  const result = new Map(keys.map((k) => [k, find(k)]));
  if (cache.size > 20) cache.clear();
  cache.set(basisSignature, result);
  return result;
}

export function liftGroupKey(key: string, settings?: ExerciseSettingsData): string {
  return liftGroupMap(settings).get(key) ?? key;
}

/** All canonical exercises in the same lift group as `key` (including itself). */
export function liftGroupMembers(key: string, settings?: ExerciseSettingsData): string[] {
  const map = liftGroupMap(settings);
  const group = map.get(key) ?? key;
  return [...map].filter(([, g]) => g === group).map(([k]) => k);
}
