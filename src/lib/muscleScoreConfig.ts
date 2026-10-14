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
}

export const MUSCLE_TIERS: MuscleTier[] = [
  { id: "needs-work", label: "Needs Work", minScore: 0, color: "#ef4444" },
  { id: "developing", label: "Developing", minScore: 20, color: "#eab308" },
  { id: "solid", label: "Solid", minScore: 40, color: "#86efac" },
  { id: "strong", label: "Strong", minScore: 60, color: "#16a34a" },
  { id: "elite", label: "Elite", minScore: 80, color: "#18181b" },
];

export const UNRATED_COLOR = "#52525b"; // no logs yet for this muscle — gray, not "Needs Work"

// ---- Scoring composition ----
export const SECONDARY_MUSCLE_WEIGHT = 0.4; // a set's contribution to a secondary muscle, vs. 1.0 for primary
export const VOLUME_BONUS_MAX_POINTS = 10; // max points the volume/consistency component can add on top of the load-standard score
export const VOLUME_BONUS_WINDOW_DAYS = 28;
export const VOLUME_BONUS_TARGET_SESSIONS = 8; // distinct training days hitting this muscle in the window for the full bonus

// ---- Freshness ----
// A set only counts as "meaningful stimulus" (resets the freshness clock) if
// its estimated load is at or above this fraction of that lift's current e1RM.
export const FRESHNESS_SET_THRESHOLD_RATIO = 0.6;
export const DEFAULT_STALE_THRESHOLD_DAYS = 10;

// ---- Bodyweight ----
export const BODYWEIGHT_FALLBACK_LB = 170; // used only when the user hasn't set CoachingContext.currentWeightLb

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
  | "hipThrust";

export const LIFT_FAMILY_STANDARDS: Record<LiftFamily, [number, number, number, number, number]> = {
  squat: [0.25, 0.75, 1.25, 1.75, 2.25],
  deadlift: [0.5, 1.0, 1.5, 2.0, 2.5],
  bench: [0.25, 0.5, 0.85, 1.2, 1.5],
  ohp: [0.2, 0.4, 0.6, 0.85, 1.1],
  row: [0.3, 0.55, 0.85, 1.15, 1.5],
  pullup: [0.7, 0.9, 1.15, 1.4, 1.65],
  hipThrust: [0.5, 1.0, 1.5, 2.0, 2.5],
};
export const STANDARD_SCORE_BREAKPOINTS = [0, 25, 50, 75, 100] as const;

// ---- Focus ranking ----
export const FOCUS_TOP_N = 3;
export const FOCUS_STALENESS_BOOST_PER_DAY = 1.5; // added to (100 - effective) per day stale, capped below
export const FOCUS_STALENESS_BOOST_CAP = 30;
export const FOCUS_GOLF_BOOST = 15;
