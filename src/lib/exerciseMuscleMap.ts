import { LiftFamily, MINOR_MUSCLE_WEIGHT, SECONDARY_MUSCLE_WEIGHT } from "./muscleScoreConfig";
import { MuscleGroupId } from "./muscleTaxonomy";

export interface MuscleContribution {
  group: MuscleGroupId;
  weight: number; // 1.0 primary, 0.4 secondary, 0.15 minor/incidental
}

export type ScoringMethod =
  | { method: "standard"; family: LiftFamily }
  | { method: "proxy"; family: LiftFamily; factor: number }
  | { method: "volumeOnly" }; // no meaningful e1RM (planks, dead bug, anti-rotation holds)

/** What the logged weight actually represents — an informational label only; it never changes a score. */
export type LoadBasis = "total" | "plates" | "combined" | "stack";

export const LOAD_BASIS_LABELS: Record<LoadBasis, string> = {
  total: "True load",
  plates: "Plates only",
  combined: "Both sides combined",
  stack: "Cable / machine stack",
};

/**
 * Shared movement-pattern tags. A user can restrict a whole pattern in
 * Settings; it applies to every exercise carrying the tag (and its aliases).
 * The tags are metadata only — nothing is restricted unless the user says so.
 */
export type MovementPattern = "hip_hinge" | "rotation" | "split_stance" | "squat";

export const MOVEMENT_PATTERNS: { id: MovementPattern; label: string; hint: string }[] = [
  { id: "hip_hinge", label: "Hip hinge", hint: "Deadlifts, Romanian deadlifts, back extensions" },
  { id: "rotation", label: "Rotation", hint: "Woodchops, rotational presses" },
  { id: "split_stance", label: "Split stance", hint: "Lunges, split squats" },
  { id: "squat", label: "Squat", hint: "Squats, split squats" },
];

export interface ExerciseMapping {
  muscles: MuscleContribution[];
  scoring: ScoringMethod;
  /** Generic placeholder name (e.g. "Core", "Curls") that older logs may use.
   * Still scores real logged history under these names, but is never
   * suggested as a "new" exercise to do in the Focus card. */
  hidden?: boolean;
  /** Fraction of bodyweight credited as load when a set is logged as bodyweight.
   * Unset -> DEFAULT_BODYWEIGHT_FRACTION. 0 = no load credit (consistency/reps-time only). */
  bodyweightFraction?: number;
  /** What the logged weight represents. Never changes a score, but it is what keeps machines and free weights from being auto-grouped as one lift (see liftGroups.ts). */
  loadBasis?: LoadBasis;
  /** Movement-pattern tags (shared metadata; used only when the user restricts a pattern). */
  patterns?: MovementPattern[];
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

const HINGE: Pick<ExerciseMapping, "patterns"> = { patterns: ["hip_hinge"] };
const ROTATION: Pick<ExerciseMapping, "patterns"> = { patterns: ["rotation"] };
const SPLIT: Pick<ExerciseMapping, "patterns"> = { patterns: ["split_stance"] };
const SQUAT: Pick<ExerciseMapping, "patterns"> = { patterns: ["squat"] };

// Keys are exact exercise names as logged (case-insensitive match applied at
// lookup time). Same-movement name variants are NOT duplicated here: they live
// in EXERCISE_ALIASES below and resolve to one canonical entry, so history and
// e1RM combine and suggestion chips show a single name. Defaults are neutral:
// no exercise is restricted, flagged or load-adjusted — all of that is local to
// each device (see exerciseSettings.ts).
export const EXERCISE_MUSCLE_MAP: Record<string, ExerciseMapping> = {
  "trap bar deadlift": { muscles: [...primary("glutes", "lowerBack"), ...secondary("hamstrings", "traps", "forearms")], scoring: standard("deadlift"), ...HINGE },
  "barbell deadlift": { muscles: [...primary("glutes", "lowerBack", "hamstrings"), ...secondary("traps", "forearms")], scoring: standard("deadlift"), ...HINGE },
  "romanian deadlift": { muscles: [...primary("hamstrings", "glutes"), ...secondary("lowerBack")], scoring: standard("deadlift"), ...HINGE },
  "db romanian deadlift": { muscles: [...primary("hamstrings", "glutes"), ...secondary("lowerBack", "forearms")], scoring: standard("deadlift"), ...HINGE },

  "back squat": { muscles: [...primary("quads"), ...secondary("glutes", "lowerBack")], scoring: standard("squat"), ...SQUAT },
  "leg press": { muscles: [...primary("quads"), ...secondary("glutes")], scoring: standard("legPress"), loadBasis: "plates" },
  "leg extension": { muscles: primary("quads"), scoring: standard("legExtension"), loadBasis: "stack" },
  "lying leg curl": { muscles: [...primary("hamstrings"), ...minor("calves")], scoring: standard("legCurl"), loadBasis: "stack" },
  "front squat": { muscles: [...primary("quads"), ...secondary("glutes", "upperBack")], scoring: standard("squat"), ...SQUAT },
  "goblet squat": { muscles: [...primary("quads"), ...secondary("glutes", "forearms")], scoring: standard("squat"), ...SQUAT },
  "db reverse lunge": { muscles: [...primary("quads", "glutes"), ...secondary("hamstrings")], scoring: proxy("squat", 0.6), ...SPLIT },
  "db bulgarian split squat": { muscles: [...primary("quads", "glutes"), ...secondary("hamstrings")], scoring: proxy("squat", 0.6), patterns: ["split_stance", "squat"] },
  "walking lunge": { muscles: [...primary("quads", "glutes"), ...secondary("hamstrings")], scoring: proxy("squat", 0.6), ...SPLIT },

  "hip thrust": { muscles: [...primary("glutes"), ...secondary("hamstrings")], scoring: standard("hipThrust") },
  "glute bridge": { muscles: [...primary("glutes"), ...secondary("hamstrings")], scoring: proxy("hipThrust", 0.6), bodyweightFraction: 0.5 },

  "bench press": { muscles: [...primary("midLowerChest"), ...secondary("triceps", "frontDelts")], scoring: standard("bench") },
  "db bench press": { muscles: [...primary("midLowerChest"), ...secondary("triceps", "frontDelts")], scoring: standard("bench") },
  "incline db press": { muscles: [...primary("upperChest", "frontDelts"), ...secondary("triceps")], scoring: standard("bench") },
  "push up": { muscles: [...primary("midLowerChest"), ...secondary("triceps", "frontDelts", "abs")], scoring: standard("bench"), bodyweightFraction: 0.64 },
  dip: { muscles: [...primary("triceps", "midLowerChest"), ...secondary("frontDelts")], scoring: standard("bench"), bodyweightFraction: 1.0 },

  "overhead press": { muscles: [...primary("frontDelts"), ...secondary("triceps", "traps")], scoring: standard("ohp") },
  "db shoulder press": { muscles: [...primary("frontDelts"), ...secondary("triceps", "sideRearDelts")], scoring: standard("ohp") },
  "lateral raise": { muscles: [...primary("sideRearDelts"), ...secondary("frontDelts")], scoring: standard("lateralRaise") },
  "cable face pulls": { muscles: [...primary("sideRearDelts"), ...secondary("upperBack", "traps")], scoring: standard("facePull"), loadBasis: "stack" },

  // Lat pulldown is THE primary lat lift; pull-ups/rows credit lats as secondary only.
  "lat pulldown": { muscles: [...primary("lats"), ...secondary("biceps", "upperBack")], scoring: standard("pulldown"), loadBasis: "stack" },
  "pull up": { muscles: [...secondary("lats", "biceps", "upperBack"), ...minor("forearms")], scoring: standard("pullup"), bodyweightFraction: 1.0 },
  "chin up": { muscles: [...primary("biceps"), ...secondary("lats", "upperBack"), ...minor("forearms")], scoring: standard("pullup"), bodyweightFraction: 1.0 },
  // Stack weight is taken at face value (no pulley-ratio assumption) — set a load multiplier in Settings if yours differs.
  "cable row": { muscles: [...primary("upperBack"), ...secondary("lats", "biceps")], scoring: standard("row"), loadBasis: "stack" },
  "barbell row": { muscles: [...primary("upperBack"), ...secondary("lats", "biceps", "lowerBack")], scoring: standard("row") },

  // Curls only get a small (minor) forearm credit — forearms have their own sources below.
  "bicep curl": { muscles: [...primary("biceps"), ...minor("forearms")], scoring: proxy("curl", 0.55) },
  "db bicep curl": { muscles: [...primary("biceps"), ...minor("forearms")], scoring: proxy("curl", 0.55) },
  "hammer curl": { muscles: [...primary("biceps"), ...minor("forearms")], scoring: proxy("curl", 0.55) },
  "tricep pushdown": { muscles: primary("triceps"), scoring: standard("tricepExt"), loadBasis: "stack" },
  "skull crusher": { muscles: primary("triceps"), scoring: proxy("tricepExt", 0.7) },

  // Forearm / grip sources (credited as primary so they drive the forearm score and clock).
  "wrist curl": { muscles: primary("forearms"), scoring: proxy("deadlift", 0.2) },
  "reverse wrist curl": { muscles: primary("forearms"), scoring: proxy("deadlift", 0.15) },
  "reverse curl": { muscles: [...primary("forearms"), ...secondary("biceps")], scoring: proxy("deadlift", 0.3) },
  "dead hang": { muscles: [...primary("forearms"), ...secondary("lats")], scoring: volumeOnly, bodyweightFraction: 0 },
  "plate pinch": { muscles: primary("forearms"), scoring: volumeOnly, bodyweightFraction: 0 },

  // Abs and obliques have separate exercise sets (no cross-credit) so their
  // scores and deltas move independently.
  "pallof press": { muscles: primary("obliques"), scoring: volumeOnly, bodyweightFraction: 0 },
  "cable woodchop": { muscles: primary("obliques"), scoring: volumeOnly, bodyweightFraction: 0, ...ROTATION },
  "standing cable woodchopper (high-to-low)": { muscles: [...primary("obliques"), ...secondary("lats")], scoring: volumeOnly, bodyweightFraction: 0, ...ROTATION },
  "standing cable woodchopper (low-to-high)": { muscles: [...primary("obliques"), ...secondary("traps")], scoring: volumeOnly, bodyweightFraction: 0, ...ROTATION },
  "dead bug": { muscles: primary("abs"), scoring: volumeOnly, bodyweightFraction: 0 },
  plank: { muscles: [...primary("abs"), ...secondary("lowerBack")], scoring: volumeOnly, bodyweightFraction: 0 },
  "captain's chair knee raises": { muscles: primary("abs"), scoring: volumeOnly, bodyweightFraction: 0 },

  "farmer carry": { muscles: [...primary("forearms", "traps"), ...secondary("abs", "glutes")], scoring: proxy("deadlift", 0.5) },
  "calf raise": { muscles: primary("calves"), scoring: proxy("squat", 1.3) },

  // ---- Generic placeholder names ----
  // Older logs (and quick typing) use generic names like "Core" or "Curls".
  // They still score real history — just never suggested as a "new" exercise
  // to do (hidden: true).
  core: { muscles: [...primary("abs")], scoring: volumeOnly, bodyweightFraction: 0, hidden: true },
  curls: { muscles: [...primary("biceps"), ...minor("forearms")], scoring: proxy("curl", 0.55), hidden: true },
  woodchopper: { muscles: primary("obliques"), scoring: volumeOnly, bodyweightFraction: 0, hidden: true, ...ROTATION },
  "cable tricep work": { muscles: primary("triceps"), scoring: standard("tricepExt"), hidden: true },

  // ---- Machine variants (generic). Branded machine names resolve to these via EXERCISE_ALIASES. ----
  "chest press machine": { muscles: [...primary("midLowerChest"), ...secondary("triceps", "frontDelts")], scoring: standard("bench"), loadBasis: "plates" },
  "incline chest press machine": { muscles: [...primary("upperChest", "frontDelts"), ...secondary("triceps")], scoring: standard("bench"), loadBasis: "plates" },
  "shoulder press machine": { muscles: [...primary("frontDelts"), ...secondary("triceps")], scoring: standard("ohp"), loadBasis: "stack" },
  // Machine stack numbers run about double a per-hand dumbbell raise, hence the 2x factor.
  "lateral raise machine": { muscles: [...primary("sideRearDelts"), ...secondary("frontDelts")], scoring: proxy("lateralRaise", 2), loadBasis: "stack" },
  "rear delt machine": { muscles: [...primary("sideRearDelts"), ...secondary("upperBack")], scoring: standard("facePull"), loadBasis: "stack" },
  "bicep curl machine": { muscles: [...primary("biceps"), ...minor("forearms")], scoring: standard("curl"), loadBasis: "stack" },
  "preacher curl machine": { muscles: [...primary("biceps"), ...minor("forearms")], scoring: standard("curl"), loadBasis: "stack" },
  "tricep extension machine": { muscles: primary("triceps"), scoring: standard("tricepExt"), loadBasis: "stack" },
  "db overhead tricep extension": { muscles: primary("triceps"), scoring: proxy("tricepExt", 0.6) },
  "single arm cable tricep extension": { muscles: primary("triceps"), scoring: proxy("tricepExt", 0.5), loadBasis: "stack" },
  "landmine rotational press": { muscles: [...primary("obliques"), ...secondary("frontDelts", "triceps")], scoring: volumeOnly, bodyweightFraction: 0, ...ROTATION },

  // ---- Hip stability / activation ----
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
  "single-leg romanian deadlift": { muscles: [...primary("glutes", "hamstrings"), ...secondary("lowerBack", "forearms")], scoring: proxy("deadlift", 0.35), ...HINGE },
  "single leg bridge": { muscles: [...primary("glutes"), ...secondary("hamstrings")], scoring: proxy("hipThrust", 0.6), bodyweightFraction: 0.5 },
  "side plank with leg raise": { muscles: [...primary("obliques", "glutes")], scoring: volumeOnly, bodyweightFraction: 0 },
  "step-ups": { muscles: [...primary("quads", "glutes"), ...secondary("hamstrings")], scoring: proxy("squat", 0.6) },
  "cable hip abduction": { muscles: primary("glutes"), scoring: proxy("squat", 0.3), bodyweightFraction: 0, loadBasis: "stack" },

  // ---- Added from the user's picks: legs, glutes, calves ----
  "seated leg curl": { muscles: [...primary("hamstrings"), ...minor("calves")], scoring: standard("legCurl"), loadBasis: "stack" },
  // Single-leg machine: logged weight is per leg, hence the 0.5 factor.
  "standing leg curl": { muscles: [...primary("hamstrings"), ...minor("calves")], scoring: proxy("legCurl", 0.5), loadBasis: "stack" },
  "hack squat": { muscles: [...primary("quads"), ...secondary("glutes")], scoring: proxy("legPress", 0.6), ...SQUAT, loadBasis: "plates" },
  "good morning": { muscles: [...primary("hamstrings", "lowerBack"), ...secondary("glutes")], scoring: proxy("deadlift", 0.55), ...HINGE },
  "forward lunge": { muscles: [...primary("quads", "glutes"), ...secondary("hamstrings")], scoring: proxy("squat", 0.6), ...SPLIT },
  "hip abduction machine": { muscles: primary("glutes"), scoring: proxy("squat", 0.6), bodyweightFraction: 0, loadBasis: "stack" },
  // Adductors aren't a tracked muscle, so this only earns incidental credit.
  "hip adduction machine": { muscles: [...secondary("quads", "glutes")], scoring: proxy("squat", 0.6), bodyweightFraction: 0, loadBasis: "stack" },
  "cable glute kickback": { muscles: primary("glutes"), scoring: proxy("squat", 0.3), bodyweightFraction: 0, loadBasis: "stack" },
  "frog pump": { muscles: primary("glutes"), scoring: volumeOnly, bodyweightFraction: 0 },
  "seated calf raise": { muscles: primary("calves"), scoring: proxy("squat", 1.0) },
  "sled push": { muscles: [...primary("quads", "glutes"), ...secondary("calves", "hamstrings")], scoring: volumeOnly, bodyweightFraction: 0 },
  "nordic curl": { muscles: [...primary("hamstrings"), ...minor("calves")], scoring: volumeOnly, bodyweightFraction: 0 },

  // ---- Chest ----
  "incline barbell bench": { muscles: [...primary("upperChest", "frontDelts"), ...secondary("triceps")], scoring: proxy("bench", 0.85) },
  "decline bench": { muscles: [...primary("midLowerChest"), ...secondary("triceps", "frontDelts")], scoring: standard("bench") },
  "close-grip bench": { muscles: [...primary("triceps"), ...secondary("midLowerChest", "frontDelts")], scoring: proxy("bench", 0.9) },
  "dumbbell fly": { muscles: [...primary("midLowerChest"), ...secondary("upperChest", "frontDelts")], scoring: proxy("bench", 0.25) },
  "cable fly": { muscles: [...primary("midLowerChest"), ...secondary("upperChest", "frontDelts")], scoring: proxy("bench", 0.25), loadBasis: "stack" },
  "pec deck": { muscles: [...primary("midLowerChest"), ...secondary("upperChest", "frontDelts")], scoring: proxy("bench", 0.6), loadBasis: "stack" },

  // ---- Back, traps, rear delts ----
  "shrugs": { muscles: [...primary("traps"), ...minor("forearms")], scoring: proxy("deadlift", 0.9) },
  "t-bar row": { muscles: [...primary("upperBack"), ...secondary("lats", "biceps", "lowerBack")], scoring: proxy("row", 0.9), loadBasis: "plates" },
  "one-arm dumbbell row": { muscles: [...primary("upperBack"), ...secondary("lats", "biceps")], scoring: proxy("row", 0.5) },
  "chest-supported row": { muscles: [...primary("upperBack"), ...secondary("lats", "biceps")], scoring: proxy("row", 0.85) },
  // Lat pulldown stays the primary lat lift, so a pullover only gives lats secondary credit.
  "pullover": { muscles: [...secondary("lats", "midLowerChest"), ...minor("triceps")], scoring: proxy("pulldown", 0.4) },
  "rear delt fly": { muscles: [...primary("sideRearDelts"), ...secondary("upperBack", "traps")], scoring: standard("lateralRaise") },

  // ---- Shoulders ----
  "arnold press": { muscles: [...primary("frontDelts"), ...secondary("sideRearDelts", "triceps")], scoring: standard("ohp") },

  // ---- Arms ----
  "ez-bar curl": { muscles: [...primary("biceps"), ...minor("forearms")], scoring: standard("curl") },
  "barbell curl": { muscles: [...primary("biceps"), ...minor("forearms")], scoring: standard("curl") },
  "cable curl": { muscles: [...primary("biceps"), ...minor("forearms")], scoring: proxy("curl", 0.8), loadBasis: "stack" },
  "concentration curl": { muscles: primary("biceps"), scoring: proxy("curl", 0.45) },
  "rope overhead tricep extension": { muscles: primary("triceps"), scoring: proxy("tricepExt", 0.85), loadBasis: "stack" },
  "tricep kickback": { muscles: primary("triceps"), scoring: proxy("tricepExt", 0.3) },
  "bench dips": { muscles: [...primary("triceps"), ...secondary("midLowerChest", "frontDelts")], scoring: standard("bench"), bodyweightFraction: 0.5 },
  "close-grip push-up": { muscles: [...primary("triceps"), ...secondary("midLowerChest", "frontDelts")], scoring: standard("bench"), bodyweightFraction: 0.64 },

  // ---- Core (abs and obliques stay on separate exercise sets) ----
  crunch: { muscles: primary("abs"), scoring: volumeOnly, bodyweightFraction: 0 },
  "cable crunch": { muscles: primary("abs"), scoring: volumeOnly, bodyweightFraction: 0, loadBasis: "stack" },
  "sit-up": { muscles: primary("abs"), scoring: volumeOnly, bodyweightFraction: 0 },
  "bicycle crunch": { muscles: [...primary("abs"), ...minor("obliques")], scoring: volumeOnly, bodyweightFraction: 0 },
  "ab wheel rollout": { muscles: [...primary("abs"), ...minor("lats")], scoring: volumeOnly, bodyweightFraction: 0 },
  "russian twist": { muscles: primary("obliques"), scoring: volumeOnly, bodyweightFraction: 0, ...ROTATION },
  "side plank": { muscles: [...primary("obliques"), ...secondary("glutes")], scoring: volumeOnly, bodyweightFraction: 0 },
  "bird dog": { muscles: [...primary("lowerBack"), ...secondary("glutes")], scoring: volumeOnly, bodyweightFraction: 0 },

  // ---- Full body / conditioning ----
  "kettlebell swing": { muscles: [...primary("glutes", "hamstrings"), ...secondary("lowerBack", "forearms")], scoring: proxy("deadlift", 0.4), ...HINGE },
  "battle ropes": { muscles: [...primary("frontDelts", "forearms"), ...secondary("abs", "lats")], scoring: volumeOnly, bodyweightFraction: 0 },

  "back extension": { muscles: [...primary("lowerBack"), ...secondary("glutes", "hamstrings")], scoring: standard("deadlift"), bodyweightFraction: 0.5, ...HINGE },
};

// Same-movement name variants -> canonical key in EXERCISE_MUSCLE_MAP (both
// lowercase). History for every variant combines under the canonical entry.
// Branded machine names are aliases only, so logs that use them keep scoring
// without any brand being part of the shared exercise library.
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
  "half-kneeling pallof press": "pallof press",
  "wide-grip pulldown": "lat pulldown",
  "wide grip pulldown": "lat pulldown",
  "wide-grip lat pulldown": "lat pulldown",
  "pec deck (machine fly)": "pec deck",
  "machine fly": "pec deck",
  "chest fly machine": "pec deck",
  "rear delt fly (reverse fly)": "rear delt fly",
  "reverse fly": "rear delt fly",
  "ez curl": "ez-bar curl",
  "ez bar curl": "ez-bar curl",
  "bb curl": "barbell curl",
  "triceps kickback": "tricep kickback",
  "bench dip": "bench dips",
  "kettlebell swings": "kettlebell swing",
  "kb swing": "kettlebell swing",
  "crunches": "crunch",
  "sit up": "sit-up",
  "sit-ups": "sit-up",
  "situp": "sit-up",
  "nordic hamstring curl": "nordic curl",
  "good mornings": "good morning",
  "lunge": "forward lunge",
  "lunges": "forward lunge",
  "decline bench press": "decline bench",
  "incline bench press": "incline barbell bench",
  "incline barbell bench press": "incline barbell bench",
  "close grip bench": "close-grip bench",
  "close-grip bench press": "close-grip bench",
  "close grip bench press": "close-grip bench",
  "db fly": "dumbbell fly",
  "cable crossover": "cable fly",
  "shrug": "shrugs",
  "dumbbell shrugs": "shrugs",
  "barbell shrugs": "shrugs",
  "db row": "one-arm dumbbell row",
  "one arm dumbbell row": "one-arm dumbbell row",
  "single arm dumbbell row": "one-arm dumbbell row",
  "close grip push-up": "close-grip push-up",
  "close-grip pushup": "close-grip push-up",
  "nautilus angled leg press plate loaded": "leg press",
  "angled leg press": "leg press",
  "plate loaded leg press": "leg press",
  "chest press - nautilus machine": "chest press machine",
  "nautilus leverage chest press": "chest press machine",
  "nautilus leverage incline chest press": "incline chest press machine",
  "hoist preacher curl machine": "preacher curl machine",
  "nautilus impact bicep curl": "bicep curl machine",
  "nautilus impact tricep extension": "tricep extension machine",
  "nautilus impact rear deltoid machine": "rear delt machine",
  "deltoid raise machine": "lateral raise machine",
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
    if (lower === "ez") return "EZ";
    if (lower === "w" && str[offset + 1] === "/") return "w";
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}
