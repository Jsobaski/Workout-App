// Every tunable constant for the muscle-scoring engine lives here, per the
// spec: nothing hardcoded elsewhere in muscleScoring.ts/muscleEngine.ts.

// ---- Decay (detraining) ----
// effective = floor + (peak - floor) * 0.5 ^ (max(0, daysSincePeak - grace) / halfLife)
export const DECAY_GRACE_DAYS = 14;
export const DECAY_HALF_LIFE_DAYS = 42;
export const DECAY_FLOOR_RATIO = 0.7; // effective never drops below 70% of peak

// ---- Tiers ----
export interface MuscleTier {
  id: string;
  label: string;
  minScore: number; // inclusive
  color: string;
  /** Ring drawn around the swatch/polygon — Elite uses a gold ring so it reads as "brightest" and can't be mistaken for unrated. */
  outline?: string;
}

export const MUSCLE_TIERS: MuscleTier[] = [
  { id: "needs-work", label: "Needs Work", minScore: 0, color: "#ef4444" },
  { id: "developing", label: "Developing", minScore: 20, color: "#eab308" },
  { id: "solid", label: "Solid", minScore: 40, color: "#86efac" },
  { id: "strong", label: "Strong", minScore: 60, color: "#16a34a" },
  { id: "elite", label: "Elite", minScore: 80, color: "#fefce8", outline: "#facc15" },
];

/** Soft glow drawn behind Elite regions on the body map. */
export const ELITE_GLOW_COLOR = "#facc15";
/** Outline for muscles whose decay/staleness is paused because every exercise for them is restricted. */
export const PAUSED_OUTLINE_COLOR = "#38bdf8";

export const UNRATED_COLOR = "#52525b"; // no logs yet for this muscle — gray, not "Needs Work"

// ---- Scoring composition ----
export const SECONDARY_MUSCLE_WEIGHT = 0.4; // a set's contribution to a secondary muscle, vs. 1.0 for primary
/** Secondary credit can never exceed this fraction of the muscle's own best primary lift score. */
export const SECONDARY_CAP_FRACTION = 0.5;
/** A muscle with no load-scored primary lift can take at most this much strength score from secondary credit. */
export const SECONDARY_ONLY_CAP = 20;
export const MINOR_MUSCLE_WEIGHT = 0.15; // incidental credit (e.g. curls -> forearms); counts for score, never resets "last trained"
export const VOLUME_BONUS_MAX_POINTS = 10; // max points the volume/consistency component can add on top of the load-standard score
export const VOLUME_BONUS_WINDOW_DAYS = 28;
export const VOLUME_BONUS_TARGET_SESSIONS = 8; // distinct training days hitting this muscle in the window for the full bonus

// ---- Score display scale ----
// Raw scores are uncapped internally (progress past "100" stays visible in the
// detail panel/summary). The *displayed* score follows the raw score up to
// SOFT_CAP_START, then compresses asymptotically toward 100 so that 100 is
// effectively unreachable: display = start + (100 - start) * (1 - e^-((raw - start)/SOFT_CAP_SCALE)).
// With scale 60: raw 100 -> ~86, raw 150 -> ~94, raw 200 -> ~97.
export const SOFT_CAP_START = 80;
export const SOFT_CAP_SCALE = 60;

// ---- Freshness ----
// A set only counts as "meaningful stimulus" (resets the freshness clock) if
// its estimated load is at or above this fraction of that lift's current e1RM.
export const FRESHNESS_SET_THRESHOLD_RATIO = 0.6;
export const DEFAULT_STALE_THRESHOLD_DAYS = 10;

// ---- Bodyweight ----
export const BODYWEIGHT_FALLBACK_LB = 170; // used only when the user hasn't set CoachingContext.currentWeightLb
// Fraction of bodyweight a bodyweight-logged set is credited with when the
// exercise doesn't define its own (per-exercise `bodyweightFraction` wins).
// 0 means "no load credit": such sets feed consistency/reps-time only, never strength tiers.
export const DEFAULT_BODYWEIGHT_FRACTION = 0.5;

// ---- Strength standards ----
// Bodyweight multiple of estimated 1RM at score breakpoints 0/25/50/75/100,
// linearly interpolated (and clamped 0-100) between them. Approximate,
// commonly-cited consensus ratios — not from one single proprietary source.
export type LiftFamily =
  | "squat"
  | "deadlift"
  | "bench"
  | "ohp"
  | "row"
  | "pullup"
  | "hipThrust"
  // Isolation/machine families — calibrated to realistic e1RM bodyweight multiples
  // (the old proxy-of-a-compound-lift factors were far too lenient: a few
  // curls/raises read as Elite with raw scores of 130-270).
  | "curl"
  | "tricepExt"
  | "lateralRaise"
  | "facePull"
  | "pulldown"
  | "legPress"
  | "legExtension"
  | "legCurl";

export const LIFT_FAMILY_STANDARDS: Record<LiftFamily, [number, number, number, number, number]> = {
  squat: [0.25, 0.75, 1.25, 1.75, 2.25],
  deadlift: [0.5, 1.0, 1.5, 2.0, 2.5],
  bench: [0.25, 0.5, 0.85, 1.2, 1.5],
  ohp: [0.2, 0.4, 0.6, 0.85, 1.1],
  row: [0.3, 0.55, 0.85, 1.15, 1.5],
  pullup: [0.7, 0.9, 1.15, 1.4, 1.65],
  hipThrust: [0.5, 1.0, 1.5, 2.0, 2.5],
  curl: [0.15, 0.3, 0.5, 0.7, 0.95], // barbell/machine total; DB curls use a 0.55 factor (logged per hand)
  tricepExt: [0.15, 0.35, 0.6, 0.85, 1.15], // cable pushdown / machine extension
  lateralRaise: [0.04, 0.08, 0.14, 0.2, 0.28], // per hand
  facePull: [0.15, 0.3, 0.5, 0.7, 0.95],
  pulldown: [0.4, 0.7, 1.0, 1.35, 1.7],
  legPress: [0.6, 1.25, 2.0, 2.75, 3.5],
  legExtension: [0.25, 0.5, 0.9, 1.3, 1.7],
  legCurl: [0.2, 0.4, 0.65, 0.9, 1.2],
};
export const STANDARD_SCORE_BREAKPOINTS = [0, 25, 50, 75, 100] as const;

// ---- Focus ranking ----
// priority = (100 - effective score) + staleness bonus + priority-tag bonus. The score
// deficit (0-100) dominates; staleness and the optional priority-tag bonus are capped tie-breakers
// (at most 20 + 10 points) so a very low-scoring muscle can't be buried below
// a merely stale one. Muscles with paused (restricted) decay get no staleness bonus.
export const FOCUS_TOP_N = 3;
export const FOCUS_STALENESS_BOOST_PER_DAY = 1; // added per day stale, capped below
export const FOCUS_STALENESS_BOOST_CAP = 20;
/** Added only to muscles the user has tagged as priority muscles (default: none). */
export const FOCUS_PRIORITY_BOOST = 10;
/** Window (days) for every "change vs. N days ago" figure shown in the UI and summary. */
export const TREND_WINDOW_DAYS = 30;

// ---- Provisional scores ----
// A muscle scored solely from one lift group logged on fewer than this many
// distinct days is "provisional": its tier is held one level below the computed one.
export const PROVISIONAL_MIN_SESSIONS = 3;
/** How far below the computed tier's lower bound a provisional score is held. */
export const PROVISIONAL_CAP_EPSILON = 0.01;

// ---- Score display ----
/** A score within this many points of a tier boundary is shown with one decimal so the tier never looks wrong. */
export const TIER_BOUNDARY_DECIMAL_WINDOW = 0.5;
