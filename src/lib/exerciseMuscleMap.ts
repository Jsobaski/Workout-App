import { LiftFamily } from "./muscleScoreConfig";
import { MuscleGroupId } from "./muscleTaxonomy";

export interface MuscleContribution {
  group: MuscleGroupId;
  weight: number; // 1.0 primary, 0.4 secondary
}

export type ScoringMethod =
  | { method: "standard"; family: LiftFamily; bodyweightFraction?: number }
  | { method: "proxy"; family: LiftFamily; factor: number }
  | { method: "volumeOnly" }; // no meaningful e1RM (planks, dead bug, anti-rotation holds)

export interface ExerciseMapping {
  muscles: MuscleContribution[];
  scoring: ScoringMethod;
  /** Legacy/generic placeholder name (e.g. "Core", "Curls" — the split used
   * these before being renamed to specific exercises). Still scores real
   * logged history under these names, but never suggested as a "new"
   * exercise to do in the Focus card. */
  hidden?: boolean;
}

function primary(...groups: MuscleGroupId[]): MuscleContribution[] {
  return groups.map((group) => ({ group, weight: 1.0 }));
}
function secondary(...groups: MuscleGroupId[]): MuscleContribution[] {
  return groups.map((group) => ({ group, weight: 0.4 }));
}

const standard = (family: LiftFamily, bodyweightFraction?: number): ScoringMethod => ({
  method: "standard",
  family,
  bodyweightFraction,
});
const proxy = (family: LiftFamily, factor: number): ScoringMethod => ({ method: "proxy", family, factor });
const volumeOnly: ScoringMethod = { method: "volumeOnly" };

// Keys are exact exercise names as logged (case-insensitive match applied at
// lookup time). Every name currently in COMMON_EXERCISES and WORKOUT_SPLITS
// is covered, including the naming drift between the two lists (e.g. "DB
// Bulgarian Split Squat" vs "...Squats") — each distinct string gets its own
// entry rather than relying on fuzzy matching to bridge it.
export const EXERCISE_MUSCLE_MAP: Record<string, ExerciseMapping> = {
  "trap bar deadlift": { muscles: [...primary("glutes", "lowerBack"), ...secondary("hamstrings", "traps", "forearms")], scoring: standard("deadlift") },
  "barbell deadlift": { muscles: [...primary("glutes", "lowerBack", "hamstrings"), ...secondary("traps", "forearms")], scoring: standard("deadlift") },
  "romanian deadlift": { muscles: [...primary("hamstrings", "glutes"), ...secondary("lowerBack")], scoring: standard("deadlift") },
  "db romanian deadlift": { muscles: [...primary("hamstrings", "glutes"), ...secondary("lowerBack", "forearms")], scoring: standard("deadlift") },

  "back squat": { muscles: [...primary("quads"), ...secondary("glutes", "lowerBack")], scoring: standard("squat") },
  "front squat": { muscles: [...primary("quads"), ...secondary("glutes", "upperBack")], scoring: standard("squat") },
  "goblet squat": { muscles: [...primary("quads"), ...secondary("glutes", "forearms")], scoring: standard("squat") },
  "db goblet squat": { muscles: [...primary("quads"), ...secondary("glutes", "forearms")], scoring: standard("squat") },
  "db reverse lunge": { muscles: [...primary("quads", "glutes"), ...secondary("hamstrings")], scoring: proxy("squat", 0.6) },
  "db bulgarian split squat": { muscles: [...primary("quads", "glutes"), ...secondary("hamstrings")], scoring: proxy("squat", 0.6) },
  "db bulgarian split squats": { muscles: [...primary("quads", "glutes"), ...secondary("hamstrings")], scoring: proxy("squat", 0.6) },
  "walking lunge": { muscles: [...primary("quads", "glutes"), ...secondary("hamstrings")], scoring: proxy("squat", 0.6) },
  "step up": { muscles: [...primary("quads", "glutes"), ...secondary("hamstrings")], scoring: proxy("squat", 0.6) },

  "hip thrust": { muscles: [...primary("glutes"), ...secondary("hamstrings")], scoring: standard("hipThrust") },
  "glute bridge": { muscles: [...primary("glutes"), ...secondary("hamstrings")], scoring: proxy("hipThrust", 0.6) },

  "bench press": { muscles: [...primary("midLowerChest", "triceps"), ...secondary("frontDelts")], scoring: standard("bench") },
  "db bench press": { muscles: [...primary("midLowerChest", "triceps"), ...secondary("frontDelts")], scoring: standard("bench") },
  "db bench press (flat)": { muscles: [...primary("midLowerChest", "triceps"), ...secondary("frontDelts")], scoring: standard("bench") },
  "incline db press": { muscles: [...primary("upperChest", "frontDelts"), ...secondary("triceps")], scoring: standard("bench") },
  "push up": { muscles: [...primary("midLowerChest", "triceps"), ...secondary("frontDelts", "abs")], scoring: standard("bench", 0.64) },
  dip: { muscles: [...primary("triceps", "midLowerChest"), ...secondary("frontDelts")], scoring: standard("bench", 1.0) },

  "overhead press": { muscles: [...primary("frontDelts"), ...secondary("triceps", "traps")], scoring: standard("ohp") },
  "db shoulder press": { muscles: [...primary("frontDelts"), ...secondary("triceps", "sideRearDelts")], scoring: standard("ohp") },
  "lateral raise": { muscles: [...primary("sideRearDelts"), ...secondary("frontDelts")], scoring: proxy("ohp", 0.1) },
  "cable face pulls w/ external rotation": { muscles: [...primary("sideRearDelts"), ...secondary("upperBack", "traps")], scoring: proxy("row", 0.15) },

  "lat pulldown": { muscles: [...primary("lats"), ...secondary("biceps", "upperBack")], scoring: standard("pullup") },
  "pull up": { muscles: [...primary("lats"), ...secondary("biceps", "upperBack", "forearms")], scoring: standard("pullup") },
  "chin up": { muscles: [...primary("lats", "biceps"), ...secondary("upperBack", "forearms")], scoring: standard("pullup") },
  "cable row": { muscles: [...primary("upperBack", "lats"), ...secondary("biceps")], scoring: standard("row") },
  "seated cable row": { muscles: [...primary("upperBack", "lats"), ...secondary("biceps")], scoring: standard("row") },
  "barbell row": { muscles: [...primary("upperBack", "lats"), ...secondary("biceps", "lowerBack")], scoring: standard("row") },

  "bicep curl": { muscles: [...primary("biceps"), ...secondary("forearms")], scoring: proxy("bench", 0.2) },
  "db bicep curl": { muscles: [...primary("biceps"), ...secondary("forearms")], scoring: proxy("bench", 0.2) },
  "hammer curl": { muscles: [...primary("biceps", "forearms")], scoring: proxy("bench", 0.2) },
  "tricep pushdown": { muscles: primary("triceps"), scoring: proxy("bench", 0.2) },
  "cable tricep pushdown": { muscles: primary("triceps"), scoring: proxy("bench", 0.2) },
  "skull crusher": { muscles: primary("triceps"), scoring: proxy("bench", 0.2) },

  "pallof press": { muscles: [...primary("obliques"), ...secondary("abs")], scoring: volumeOnly },
  "half-kneeling pallof press": { muscles: [...primary("obliques"), ...secondary("abs", "glutes")], scoring: volumeOnly },
  "cable woodchop": { muscles: [...primary("obliques"), ...secondary("abs")], scoring: volumeOnly },
  "standing cable woodchopper (high-to-low)": { muscles: [...primary("obliques"), ...secondary("abs", "lats")], scoring: volumeOnly },
  "standing cable woodchopper (low-to-high)": { muscles: [...primary("obliques"), ...secondary("abs", "traps")], scoring: volumeOnly },
  "dead bug": { muscles: [...primary("abs"), ...secondary("obliques")], scoring: volumeOnly },
  plank: { muscles: [...primary("abs"), ...secondary("obliques", "lowerBack")], scoring: volumeOnly },
  "captain's chair knee raises": { muscles: [...primary("abs"), ...secondary("obliques")], scoring: volumeOnly },

  "farmer carry": { muscles: [...primary("forearms", "traps"), ...secondary("abs", "glutes")], scoring: proxy("deadlift", 0.5) },
  "calf raise": { muscles: primary("calves"), scoring: proxy("squat", 1.3) },
  "standing calf raise": { muscles: primary("calves"), scoring: proxy("squat", 1.3) },
  "standing calf": { muscles: primary("calves"), scoring: proxy("squat", 1.3) },

  // ---- Legacy split placeholder names ----
  // The 4-day split originally used generic names before being renamed to
  // specific exercises. Renaming the split definition doesn't retroactively
  // rename already-logged history, so these still need to resolve — scored,
  // just never suggested as a "new" exercise to do (hidden: true).
  core: { muscles: [...primary("abs", "obliques")], scoring: volumeOnly, hidden: true },
  curls: { muscles: [...primary("biceps"), ...secondary("forearms")], scoring: proxy("bench", 0.2), hidden: true },
  woodchopper: { muscles: [...primary("obliques"), ...secondary("abs")], scoring: volumeOnly, hidden: true },
  "cable tricep work": { muscles: primary("triceps"), scoring: proxy("bench", 0.2), hidden: true },

  // ---- Near-miss name variants seen in real logs (plural, missing a
  // qualifier, no apostrophe) that normalization alone doesn't bridge ----
  "captain chair knee raises": { muscles: [...primary("abs"), ...secondary("obliques")], scoring: volumeOnly, hidden: true },
  "face pulls": { muscles: [...primary("sideRearDelts"), ...secondary("upperBack", "traps")], scoring: proxy("row", 0.15) },
  "cable face pulls": { muscles: [...primary("sideRearDelts"), ...secondary("upperBack", "traps")], scoring: proxy("row", 0.15) },
  "standing cable woodchoppers (high to low)": { muscles: [...primary("obliques"), ...secondary("abs", "lats")], scoring: volumeOnly, hidden: true },
  "romanian deadlift straight bar": { muscles: [...primary("hamstrings", "glutes"), ...secondary("lowerBack")], scoring: standard("deadlift"), hidden: true },

  // ---- Machine/equipment variants not in the common list or split ----
  "chest press - nautilus machine": { muscles: [...primary("midLowerChest", "triceps"), ...secondary("frontDelts")], scoring: standard("bench") },
  "nautilus leverage chest press": { muscles: [...primary("midLowerChest", "triceps"), ...secondary("frontDelts")], scoring: standard("bench") },
  "nautilus leverage incline chest press": { muscles: [...primary("upperChest", "frontDelts"), ...secondary("triceps")], scoring: standard("bench") },
  "shoulder press machine": { muscles: [...primary("frontDelts"), ...secondary("triceps")], scoring: standard("ohp") },
  "deltoid raise machine": { muscles: [...primary("sideRearDelts"), ...secondary("frontDelts")], scoring: proxy("ohp", 0.1) },
  "nautilus impact rear deltoid machine": { muscles: [...primary("sideRearDelts"), ...secondary("upperBack")], scoring: proxy("row", 0.15) },
  "nautilus impact bicep curl": { muscles: [...primary("biceps"), ...secondary("forearms")], scoring: proxy("bench", 0.2) },
  "nautilus impact tricep extension": { muscles: primary("triceps"), scoring: proxy("bench", 0.2) },
  "db overhead tricep extension": { muscles: primary("triceps"), scoring: proxy("bench", 0.2) },
  "single arm cable tricep extension": { muscles: primary("triceps"), scoring: proxy("bench", 0.2) },
  "landmine rotational press": { muscles: [...primary("obliques"), ...secondary("frontDelts", "triceps")], scoring: volumeOnly },

  // ---- Glute medius / hip stability (physical therapy) ----
  // Activation/band drills have no meaningful absolute load (band
  // resistance isn't comparable to barbell standards), so they're scored
  // the same way as core anti-rotation work: consistency-driven, not
  // load-driven. Single-leg RDL and hip abduction are genuinely loadable,
  // just at a much lighter fraction of the bilateral/squat standard.
  "side-lying hip abduction": { muscles: primary("glutes"), scoring: volumeOnly },
  "banded lateral walks": { muscles: [...primary("glutes"), ...secondary("quads")], scoring: volumeOnly },
  "clamshells with band": { muscles: primary("glutes"), scoring: volumeOnly },
  "single-leg romanian deadlift": { muscles: [...primary("glutes", "hamstrings"), ...secondary("lowerBack", "forearms")], scoring: proxy("deadlift", 0.35) },
  "side plank with leg raise": { muscles: [...primary("obliques", "glutes")], scoring: volumeOnly },
  "side plank with top-leg raise": { muscles: [...primary("obliques", "glutes")], scoring: volumeOnly },
  "step-ups": { muscles: [...primary("quads", "glutes"), ...secondary("hamstrings")], scoring: proxy("squat", 0.6) },
  "step-ups (lateral or standard)": { muscles: [...primary("quads", "glutes"), ...secondary("hamstrings")], scoring: proxy("squat", 0.6) },
  "cable hip abduction": { muscles: primary("glutes"), scoring: proxy("squat", 0.3) },
  "standing hip abduction": { muscles: primary("glutes"), scoring: proxy("squat", 0.3) },
  "cable or standing hip abduction": { muscles: primary("glutes"), scoring: proxy("squat", 0.3) },
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

export function lookupExerciseMapping(exerciseName: string): ExerciseMapping | null {
  const key = exerciseName.trim().toLowerCase();
  if (EXERCISE_MUSCLE_MAP[key]) return EXERCISE_MUSCLE_MAP[key];

  const normalized = normalizeExerciseName(exerciseName);
  for (const [mapKey, mapping] of Object.entries(EXERCISE_MUSCLE_MAP)) {
    if (normalizeExerciseName(mapKey) === normalized) return mapping;
  }
  return null;
}

// Capitalizes each alphabetic run in a lowercase map key back into a
// display-friendly name ("db bench press (flat)" -> "DB Bench Press
// (Flat)"), special-casing "DB" and the "w/" abbreviation, and leaving a
// letter right after an apostrophe alone ("captain's" stays "captain's").
function titleCaseExerciseName(key: string): string {
  return key.replace(/[a-z]+/gi, (word, offset: number, str: string) => {
    const lower = word.toLowerCase();
    if (str[offset - 1] === "'") return lower;
    if (lower === "db") return "DB";
    if (lower === "w" && str[offset + 1] === "/") return "w";
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}

/** Suggested exercises for a muscle, for the weekly focus card — primary
 * contributions first, deduped by normalized name so naming-drift variants
 * ("DB Bulgarian Split Squat" / "...Squats") don't both show up. */
export function exercisesForMuscle(group: MuscleGroupId, limit = 3): string[] {
  const seen = new Set<string>();
  const candidates = Object.entries(EXERCISE_MUSCLE_MAP)
    .filter(([, mapping]) => !mapping.hidden)
    .map(([key, mapping]) => ({ key, mapping, contribution: mapping.muscles.find((m) => m.group === group) }))
    .filter((c): c is typeof c & { contribution: MuscleContribution } => c.contribution != null)
    .sort((a, b) => b.contribution.weight - a.contribution.weight);

  const result: string[] = [];
  for (const c of candidates) {
    const normalized = normalizeExerciseName(c.key);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(titleCaseExerciseName(c.key));
    if (result.length >= limit) break;
  }
  return result;
}
