import { LiftFamily, MINOR_MUSCLE_WEIGHT, SECONDARY_MUSCLE_WEIGHT } from "./muscleScoreConfig";
import { MuscleGroupId } from "./muscleTaxonomy";
import type { ExerciseSettingsOverrides } from "./exerciseSettings";

export interface MuscleContribution {
  group: MuscleGroupId;
  weight: number; // 1.0 primary, 0.4 secondary, 0.15 minor/incidental
}

export type ScoringMethod =
  | { method: "standard"; family: LiftFamily }
  | { method: "proxy"; family: LiftFamily; factor: number }
  | { method: "volumeOnly" }; // no meaningful e1RM (planks, dead bug, anti-rotation holds)

/** What the logged weight actually represents (informational note shown next to the multiplier). */
export type LoadBasis = "total" | "plates" | "combined" | "stack";

export const LOAD_BASIS_LABELS: Record<LoadBasis, string> = {
  total: "True load",
  plates: "Plates only",
  combined: "Both sides combined",
  stack: "Cable / machine stack",
};

export interface ExerciseMapping {
  muscles: MuscleContribution[];
  scoring: ScoringMethod;
  /** Legacy/generic placeholder name (e.g. "Core", "Curls" — the split used
   * these before being renamed to specific exercises). Still scores real
   * logged history under these names, but never suggested as a "new"
   * exercise to do in the Focus card. */
  hidden?: boolean;
  /** Fraction of bodyweight credited as load when a set is logged as bodyweight.
   * Unset -> DEFAULT_BODYWEIGHT_FRACTION. 0 = no load credit (consistency/reps-time only). */
  bodyweightFraction?: number;
  /** logged weight x this = effective load used for scoring and volume. Unset -> 1. */
  loadMultiplier?: number;
  loadBasis?: LoadBasis;
  /** PT-restricted: never suggested, and decay/staleness pauses for the muscles it last fed. */
  restricted?: boolean;
  restrictionNote?: string;
  needsPtConfirmation?: boolean;
}

function primary(...groups: MuscleGroupId[]): MuscleContribution[] {
  return groups.map((group) => ({ group, weight: 1.0 }));
}
function secondary(...groups: MuscleGroupId[]): MuscleContribution[] {
  return groups.map((group) => ({ group, weight: SECONDARY_MUSCLE_WEIGHT }));
}
function minor(...groups: MuscleGroupId[]): MuscleContribution[] {
  return groups.map((group) => ({ group, weight: MINOR_MUSCLE_WEIGHT }));
}

const standard = (family: LiftFamily): ScoringMethod => ({ method: "standard", family });
const proxy = (family: LiftFamily, factor: number): ScoringMethod => ({ method: "proxy", family, factor });
const volumeOnly: ScoringMethod = { method: "volumeOnly" };

// Seeded PT restrictions (editable in Settings > Exercise settings).
const PT_NO_HINGE = { restricted: true, restrictionNote: "PT: no hip hinge" } as const;
const PT_RESTRICTED = { restricted: true, restrictionNote: "PT restricted" } as const;
const PT_CONFIRM = { needsPtConfirmation: true } as const;

// Keys are exact exercise names as logged (case-insensitive match applied at
// lookup time). Same-movement name variants are NOT duplicated here: they live
// in EXERCISE_ALIASES below and resolve to one canonical entry, so history and
// e1RM combine and suggestion chips show a single name.
export const EXERCISE_MUSCLE_MAP: Record<string, ExerciseMapping> = {
  "trap bar deadlift": { muscles: [...primary("glutes", "lowerBack"), ...secondary("hamstrings", "traps", "forearms")], scoring: standard("deadlift"), ...PT_NO_HINGE },
  "barbell deadlift": { muscles: [...primary("glutes", "lowerBack", "hamstrings"), ...secondary("traps", "forearms")], scoring: standard("deadlift") },
  "romanian deadlift": { muscles: [...primary("hamstrings", "glutes"), ...secondary("lowerBack")], scoring: standard("deadlift") },
  "db romanian deadlift": { muscles: [...primary("hamstrings", "glutes"), ...secondary("lowerBack", "forearms")], scoring: standard("deadlift"), ...PT_NO_HINGE },

  "back squat": { muscles: [...primary("quads"), ...secondary("glutes", "lowerBack")], scoring: standard("squat") },
  "front squat": { muscles: [...primary("quads"), ...secondary("glutes", "upperBack")], scoring: standard("squat") },
  "goblet squat": { muscles: [...primary("quads"), ...secondary("glutes", "forearms")], scoring: standard("squat"), ...PT_CONFIRM },
  "db reverse lunge": { muscles: [...primary("quads", "glutes"), ...secondary("hamstrings")], scoring: proxy("squat", 0.6) },
  "db bulgarian split squat": { muscles: [...primary("quads", "glutes"), ...secondary("hamstrings")], scoring: proxy("squat", 0.6), ...PT_RESTRICTED },
  "walking lunge": { muscles: [...primary("quads", "glutes"), ...secondary("hamstrings")], scoring: proxy("squat", 0.6) },

  "hip thrust": { muscles: [...primary("glutes"), ...secondary("hamstrings")], scoring: standard("hipThrust") },
  "glute bridge": { muscles: [...primary("glutes"), ...secondary("hamstrings")], scoring: proxy("hipThrust", 0.6), bodyweightFraction: 0.5 },

  "bench press": { muscles: [...primary("midLowerChest", "triceps"), ...secondary("frontDelts")], scoring: standard("bench") },
  "db bench press": { muscles: [...primary("midLowerChest", "triceps"), ...secondary("frontDelts")], scoring: standard("bench") },
  "incline db press": { muscles: [...primary("upperChest", "frontDelts"), ...secondary("triceps")], scoring: standard("bench") },
  "push up": { muscles: [...primary("midLowerChest", "triceps"), ...secondary("frontDelts", "abs")], scoring: standard("bench"), bodyweightFraction: 0.64 },
  dip: { muscles: [...primary("triceps", "midLowerChest"), ...secondary("frontDelts")], scoring: standard("bench"), bodyweightFraction: 1.0 },

  "overhead press": { muscles: [...primary("frontDelts"), ...secondary("triceps", "traps")], scoring: standard("ohp") },
  "db shoulder press": { muscles: [...primary("frontDelts"), ...secondary("triceps", "sideRearDelts")], scoring: standard("ohp") },
  "lateral raise": { muscles: [...primary("sideRearDelts"), ...secondary("frontDelts")], scoring: proxy("ohp", 0.1) },
  "cable face pulls": { muscles: [...primary("sideRearDelts"), ...secondary("upperBack", "traps")], scoring: proxy("row", 0.15), loadBasis: "stack", loadMultiplier: 0.5 },

  "lat pulldown": { muscles: [...primary("lats"), ...secondary("biceps", "upperBack")], scoring: standard("pullup"), loadBasis: "stack", loadMultiplier: 0.75 },
  "pull up": { muscles: [...primary("lats"), ...secondary("biceps", "upperBack"), ...minor("forearms")], scoring: standard("pullup"), bodyweightFraction: 1.0 },
  "chin up": { muscles: [...primary("lats", "biceps"), ...secondary("upperBack"), ...minor("forearms")], scoring: standard("pullup"), bodyweightFraction: 1.0 },
  "cable row": { muscles: [...primary("upperBack", "lats"), ...secondary("biceps")], scoring: standard("row"), loadBasis: "stack", loadMultiplier: 0.5 },
  "barbell row": { muscles: [...primary("upperBack", "lats"), ...secondary("biceps", "lowerBack")], scoring: standard("row") },

  // Curls only get a small (minor) forearm credit — forearms have their own sources below.
  "bicep curl": { muscles: [...primary("biceps"), ...minor("forearms")], scoring: proxy("bench", 0.2) },
  "db bicep curl": { muscles: [...primary("biceps"), ...minor("forearms")], scoring: proxy("bench", 0.2) },
  "hammer curl": { muscles: [...primary("biceps"), ...minor("forearms")], scoring: proxy("bench", 0.2) },
  "tricep pushdown": { muscles: primary("triceps"), scoring: proxy("bench", 0.2), loadBasis: "stack" },
  "skull crusher": { muscles: primary("triceps"), scoring: proxy("bench", 0.2) },

  // Forearm / grip sources (credited as primary so they drive the forearm score and clock).
  "wrist curl": { muscles: primary("forearms"), scoring: proxy("deadlift", 0.2) },
  "reverse wrist curl": { muscles: primary("forearms"), scoring: proxy("deadlift", 0.15) },
  "reverse curl": { muscles: [...primary("forearms"), ...secondary("biceps")], scoring: proxy("deadlift", 0.2) },
  "dead hang": { muscles: [...primary("forearms"), ...secondary("lats")], scoring: volumeOnly, bodyweightFraction: 0 },
  "plate pinch": { muscles: primary("forearms"), scoring: volumeOnly, bodyweightFraction: 0 },

  // Abs and obliques have separate exercise sets (no cross-credit) so their
  // scores and deltas move independently.
  "pallof press": { muscles: primary("obliques"), scoring: volumeOnly, bodyweightFraction: 0, ...PT_CONFIRM },
  "half-kneeling pallof press": { muscles: [...primary("obliques"), ...secondary("glutes")], scoring: volumeOnly, bodyweightFraction: 0, ...PT_CONFIRM },
  "cable woodchop": { muscles: primary("obliques"), scoring: volumeOnly, bodyweightFraction: 0 },
  "standing cable woodchopper (high-to-low)": { muscles: [...primary("obliques"), ...secondary("lats")], scoring: volumeOnly, bodyweightFraction: 0, ...PT_RESTRICTED },
  "standing cable woodchopper (low-to-high)": { muscles: [...primary("obliques"), ...secondary("traps")], scoring: volumeOnly, bodyweightFraction: 0, ...PT_RESTRICTED },
  "dead bug": { muscles: primary("abs"), scoring: volumeOnly, bodyweightFraction: 0 },
  plank: { muscles: [...primary("abs"), ...secondary("lowerBack")], scoring: volumeOnly, bodyweightFraction: 0 },
  "captain's chair knee raises": { muscles: primary("abs"), scoring: volumeOnly, bodyweightFraction: 0 },

  "farmer carry": { muscles: [...primary("forearms", "traps"), ...secondary("abs", "glutes")], scoring: proxy("deadlift", 0.5) },
  "calf raise": { muscles: primary("calves"), scoring: proxy("squat", 1.3) },

  // ---- Legacy split placeholder names ----
  // The 4-day split originally used generic names before being renamed to
  // specific exercises. Renaming the split definition doesn't retroactively
  // rename already-logged history, so these still need to resolve — scored,
  // just never suggested as a "new" exercise to do (hidden: true).
  core: { muscles: [...primary("abs")], scoring: volumeOnly, bodyweightFraction: 0, hidden: true },
  curls: { muscles: [...primary("biceps"), ...minor("forearms")], scoring: proxy("bench", 0.2), hidden: true },
  woodchopper: { muscles: primary("obliques"), scoring: volumeOnly, bodyweightFraction: 0, hidden: true },
  "cable tricep work": { muscles: primary("triceps"), scoring: proxy("bench", 0.2), hidden: true },

  // ---- Machine/equipment variants not in the common list or split ----
  // Load multipliers below are estimates (see LOAD_BASIS_LABELS) — editable in
  // Settings > Exercise settings.
  "chest press - nautilus machine": { muscles: [...primary("midLowerChest", "triceps"), ...secondary("frontDelts")], scoring: standard("bench") },
  "nautilus leverage chest press": { muscles: [...primary("midLowerChest", "triceps"), ...secondary("frontDelts")], scoring: standard("bench"), loadBasis: "plates", loadMultiplier: 1.5 },
  "nautilus leverage incline chest press": { muscles: [...primary("upperChest", "frontDelts"), ...secondary("triceps")], scoring: standard("bench"), loadBasis: "plates", loadMultiplier: 1.5 },
  "shoulder press machine": { muscles: [...primary("frontDelts"), ...secondary("triceps")], scoring: standard("ohp") },
  "deltoid raise machine": { muscles: [...primary("sideRearDelts"), ...secondary("frontDelts")], scoring: proxy("ohp", 0.1) },
  "nautilus impact rear deltoid machine": { muscles: [...primary("sideRearDelts"), ...secondary("upperBack")], scoring: proxy("row", 0.15) },
  "nautilus impact bicep curl": { muscles: [...primary("biceps"), ...minor("forearms")], scoring: proxy("bench", 0.2), loadBasis: "stack", loadMultiplier: 0.8 },
  "hoist preacher curl machine": { muscles: [...primary("biceps"), ...minor("forearms")], scoring: proxy("bench", 0.2), loadBasis: "stack", loadMultiplier: 0.8 },
  "nautilus impact tricep extension": { muscles: primary("triceps"), scoring: proxy("bench", 0.2), loadBasis: "stack", loadMultiplier: 0.8 },
  "db overhead tricep extension": { muscles: primary("triceps"), scoring: proxy("bench", 0.2) },
  "single arm cable tricep extension": { muscles: primary("triceps"), scoring: proxy("bench", 0.2), loadBasis: "stack" },
  "landmine rotational press": { muscles: [...primary("obliques"), ...secondary("frontDelts", "triceps")], scoring: volumeOnly, bodyweightFraction: 0, ...PT_RESTRICTED },

  // ---- Glute medius / hip stability (physical therapy) ----
  // Activation/band drills have no meaningful absolute load (band
  // resistance isn't comparable to barbell standards), so they're scored
  // the same way as core anti-rotation work: consistency-driven, not
  // load-driven, with zero bodyweight credit. Single-leg RDL and hip
  // abduction are genuinely loadable, just at a much lighter fraction of the
  // bilateral/squat standard.
  "side-lying hip abduction": { muscles: primary("glutes"), scoring: volumeOnly, bodyweightFraction: 0 },
  "banded lateral walks": { muscles: [...primary("glutes"), ...secondary("quads")], scoring: volumeOnly, bodyweightFraction: 0 },
  "clamshells with band": { muscles: primary("glutes"), scoring: volumeOnly, bodyweightFraction: 0 },
  "reverse clamshells": { muscles: primary("glutes"), scoring: volumeOnly, bodyweightFraction: 0 },
  "single-leg romanian deadlift": { muscles: [...primary("glutes", "hamstrings"), ...secondary("lowerBack", "forearms")], scoring: proxy("deadlift", 0.35) },
  "single leg bridge": { muscles: [...primary("glutes"), ...secondary("hamstrings")], scoring: proxy("hipThrust", 0.6), bodyweightFraction: 0.5 },
  "side plank with leg raise": { muscles: [...primary("obliques", "glutes")], scoring: volumeOnly, bodyweightFraction: 0 },
  "step-ups": { muscles: [...primary("quads", "glutes"), ...secondary("hamstrings")], scoring: proxy("squat", 0.6) },
  "cable hip abduction": { muscles: primary("glutes"), scoring: proxy("squat", 0.3), bodyweightFraction: 0, loadBasis: "stack" },

  "back extension": { muscles: [...primary("lowerBack"), ...secondary("glutes", "hamstrings")], scoring: standard("deadlift"), bodyweightFraction: 0.5, ...PT_CONFIRM },
};

// Same-movement name variants -> canonical key in EXERCISE_MUSCLE_MAP (both
// lowercase). History for every variant combines under the canonical entry.
export const EXERCISE_ALIASES: Record<string, string> = {
  "standing calf raise": "calf raise",
  "standing calf": "calf raise",
  "db goblet squat": "goblet squat",
  "seated cable row": "cable row",
  "seated cable rows": "cable row",
  "cable rows": "cable row",
  "cable tricep pushdown": "tricep pushdown",
  "face pulls": "cable face pulls",
  "cable face pulls w/ external rotation": "cable face pulls",
  "leg bridge": "glute bridge",
  "leg bridges": "glute bridge",
  "single leg bridges": "single leg bridge",
  "back extensions": "back extension",
  "captain chair knee raises": "captain's chair knee raises",
  "standing cable woodchoppers (high to low)": "standing cable woodchopper (high-to-low)",
  "step up": "step-ups",
  "step-ups (lateral or standard)": "step-ups",
  "side plank with top-leg raise": "side plank with leg raise",
  "cable or standing hip abduction": "cable hip abduction",
  "standing hip abduction": "cable hip abduction",
  "romanian deadlift straight bar": "romanian deadlift",
  "db bench press (flat)": "db bench press",
  "db bulgarian split squats": "db bulgarian split squat",
  "farmers carry": "farmer carry",
  "farmer's carry": "farmer carry",
};

// Strip equipment/stance prefixes and trailing parentheticals, fold common
// pluralization, so near-miss names (logged slightly differently than the
// table above) still resolve instead of landing in "needs mapping" — e.g.
// "DB Bulgarian Split Squatz" or an unlisted stance variant typed by hand.
function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\bsquats\b/g, "squat")
    .replace(/\s+/g, " ")
    .trim();
}

/** Canonical EXERCISE_MUSCLE_MAP key for a logged name (aliases resolved), or null when unmapped. */
export function canonicalExerciseKey(exerciseName: string): string | null {
  const exact = exerciseName.trim().toLowerCase();
  if (EXERCISE_ALIASES[exact]) return EXERCISE_ALIASES[exact];
  if (EXERCISE_MUSCLE_MAP[exact]) return exact;

  const normalized = normalizeExerciseName(exerciseName);
  for (const mapKey of Object.keys(EXERCISE_MUSCLE_MAP)) {
    if (normalizeExerciseName(mapKey) === normalized) return mapKey;
  }
  for (const [alias, target] of Object.entries(EXERCISE_ALIASES)) {
    if (normalizeExerciseName(alias) === normalized) return target;
  }
  return null;
}

export function lookupExerciseMapping(exerciseName: string): ExerciseMapping | null {
  const key = canonicalExerciseKey(exerciseName);
  return key ? EXERCISE_MUSCLE_MAP[key] : null;
}

// Capitalizes each alphabetic run in a lowercase map key back into a
// display-friendly name ("db bench press (flat)" -> "DB Bench Press
// (Flat)"), special-casing "DB" and the "w/" abbreviation, and leaving a
// letter right after an apostrophe alone ("captain's" stays "captain's").
export function exerciseDisplayName(key: string): string {
  return titleCaseKey(key).replace(/-To-/g, "-to-");
}

function titleCaseKey(key: string): string {
  return key.replace(/[a-z]+/gi, (word, offset: number, str: string) => {
    const lower = word.toLowerCase();
    if (str[offset - 1] === "'") return lower;
    if (lower === "db") return "DB";
    if (lower === "w" && str[offset + 1] === "/") return "w";
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}

export interface MuscleExerciseSuggestions {
  suggestions: string[];
  /** Exercises that would have been suggested but are PT-restricted. */
  skippedRestricted: { name: string; note?: string }[];
}

/** Suggested exercises for a muscle, for the weekly focus card — primary
 * contributions first, deduped by canonical key so naming-drift variants
 * ("Calf Raise" / "Standing Calf Raise") show up once. Restricted exercises
 * (per defaults + `overrides`) are never suggested; they're reported in
 * `skippedRestricted` instead. */
export function suggestExercisesForMuscle(
  group: MuscleGroupId,
  limit = 3,
  overrides?: ExerciseSettingsOverrides
): MuscleExerciseSuggestions {
  const candidates = Object.entries(EXERCISE_MUSCLE_MAP)
    .filter(([, mapping]) => !mapping.hidden)
    .map(([key, mapping]) => ({ key, mapping, contribution: mapping.muscles.find((m) => m.group === group) }))
    .filter((c): c is typeof c & { contribution: MuscleContribution } => c.contribution != null && c.contribution.weight >= SECONDARY_MUSCLE_WEIGHT)
    .sort((a, b) => b.contribution.weight - a.contribution.weight);

  const suggestions: string[] = [];
  const skippedRestricted: { name: string; note?: string }[] = [];
  for (const c of candidates) {
    const override = overrides?.[c.key];
    const restricted = override?.restricted ?? c.mapping.restricted ?? false;
    if (restricted) {
      skippedRestricted.push({ name: exerciseDisplayName(c.key), note: override?.restrictionNote ?? c.mapping.restrictionNote });
      continue;
    }
    if (suggestions.length < limit) suggestions.push(exerciseDisplayName(c.key));
  }
  return { suggestions, skippedRestricted };
}

export function exercisesForMuscle(group: MuscleGroupId, limit = 3, overrides?: ExerciseSettingsOverrides): string[] {
  return suggestExercisesForMuscle(group, limit, overrides).suggestions;
}
