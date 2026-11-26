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
/** A consistency-only muscle's peak is the best window that ended within this many days; a window that ended earlier does not count. */
export const CONSISTENCY_LOOKBACK_DAYS = 42;
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
  // Barbell squat / deadlift / bench re-anchored to published standards (see below); the older
  // squat / deadlift / bench tables stay for dumbbell, machine, bodyweight and proxy-scored lifts.
  | "barbellSquat"
  | "barbellDeadlift"
  | "barbellBench"
  | "ohp"
  | "row"
  | "pullup"
  | "hipThrust"
  // Isolation/machine families — calibrated to realistic e1RM bodyweight multiples
  // (the old proxy-of-a-compound-lift factors were far too lenient: a few
  // curls/raises read as Elite with raw scores of 130-270).
  | "curl"
  | "tricepExt"
  | "wristCurl"
  | "shrug"
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
  // The three barbell lifts, anchored to published standards (all values are multiples of bodyweight at a 180 lb
  // reference lifter; scoring scales them to the user's bodyweight, see REFERENCE_BODYWEIGHT_LB). Approximate:
  //  squat: Strength Level male 145 / 209 / 289 / 382 / 482 lb (beginner..elite) and FitnessVolt's modeled 180 lb
  //    male (intermediate 292 lb = 1.62x, advanced 373 lb = 2.07x), i.e. about 0.80 / 1.15 / 1.60 / 2.10 / 2.65x.
  //  deadlift: Strength Level male 173 / 246 / 336 / 440 / 552 lb and FitnessVolt 180 lb intermediate 340 lb (1.89x),
  //    about 0.95 / 1.35 / 1.85 / 2.45 / 3.05x.
  //  bench: the intermediate anchor, 1.23-1.25x (Gravitus 225 lb and FitnessVolt 221 lb at 180 lb), is sourced; the
  //    other levels follow the shape of Strength Level's male bench row (0.47 / 0.70 / 1 / 1.34 / 1.73 of intermediate).
  barbellSquat: [0.8, 1.15, 1.6, 2.1, 2.65],
  barbellDeadlift: [0.95, 1.35, 1.85, 2.45, 3.05],
  barbellBench: [0.58, 0.86, 1.23, 1.65, 2.12],
  ohp: [0.2, 0.4, 0.6, 0.85, 1.1],
  row: [0.3, 0.55, 0.85, 1.15, 1.5],
  pullup: [0.7, 0.9, 1.15, 1.4, 1.65],
  hipThrust: [0.5, 1.0, 1.5, 2.0, 2.5],
  // Barbell/machine total; DB curls use a 0.55 factor (logged per hand). Strength Level male: cable curl 13 / 29 / 51 / 81 /
  // 115 kg and dumbbell curl 14 / 29 / 52 / 80 / 113 lb per hand; this table is consistent with both (approximate).
  curl: [0.15, 0.32, 0.57, 0.88, 1.2],
  // Cable pushdown / machine extension: Strength Level male bodyweight ratios 0.25 / 0.50 / 0.75 / 1.00 / 1.50x.
  tricepExt: [0.25, 0.5, 0.75, 1.0, 1.5],
  // Wrist curl (per dumbbell, e1RM / bodyweight). Anchors are published community/standards data for the
  // dumbbell wrist curl, male lifters: Strength Level (beginner 8 / novice 28 / intermediate 62 / advanced 108 /
  // elite 164 lb per hand, ~0.04 / 0.16 / 0.34 / 0.60 / 0.91 x a ~180 lb average lifter) and FitnessVolt
  // (180 lb male: intermediate ~65 lb = 0.36x, advanced ~110 lb = 0.61x). The two agree on the upper anchors, which are
  // used as published (0.34 / 0.60 / 0.90). The 25-point anchor sits at 0.115 rather than the published novice 0.16 so a
  // returning lifter's ordinary starting load (about 15 lb x 15, e1RM 20 lb after the 10-rep cap, ~0.10x at 205 lb) reads
  // Developing, not Needs Work.
  // Reverse wrist curl is this table x 0.57: the extensors are weaker than the flexors (isokinetic extensor/flexor peak
  // torque ratio 0.57 in a 40-subject study; Strength Level's dumbbell reverse vs. normal wrist curl levels are ~0.56-0.71x).
  wristCurl: [0.04, 0.115, 0.34, 0.6, 0.9],
  // Barbell shrug (total load), Strength Level bodyweight ratios: beginner 0.5x, novice 1.0x, intermediate 1.5x, advanced 2.25x, elite 3.0x
  // (about 103/178/279/401/539 lb at the site's typical male). Dumbbell shrugs are logged per hand, so they use half.
  shrug: [0.5, 1.0, 1.5, 2.25, 3.0],
  // Per hand. Strength Level male dumbbell lateral raise 8 / 18 / 34 / 54 / 79 lb, about 0.045 / 0.10 / 0.19 / 0.30 / 0.44x
  // of a ~180 lb lifter (their bodyweight isn't stated, so approximate).
  lateralRaise: [0.045, 0.1, 0.19, 0.3, 0.44],
  facePull: [0.15, 0.3, 0.5, 0.7, 0.95],
  pulldown: [0.4, 0.7, 1.0, 1.35, 1.7],
  // Leg press: Strength Level male seated press intermediate about 2.5x and its sled press 1.25 / 2.0 / 2.75 / 4.0 / 5.25x
  // (their tables are inconsistent, so this blends them; approximate).
  legPress: [1.2, 1.9, 2.6, 3.7, 4.9],
  legExtension: [0.25, 0.5, 0.9, 1.3, 1.7],
  legCurl: [0.2, 0.4, 0.65, 0.9, 1.2],
};
// ---- Bodyweight scaling ----
// Every table above is a multiple of bodyweight for a 180 lb lifter. Strength does not grow in proportion to
// bodyweight (a heavier lifter is stronger in absolute terms, but not by the same percentage), so the required
// multiple is scaled by (bodyweight / 180) ^ -1/3, i.e. absolute strength standards grow with bodyweight ^ 2/3, the
// standard allometric scaling used for comparing lifters of different sizes. Bodyweight is clamped to a sensible range.
export const REFERENCE_BODYWEIGHT_LB = 180;
export const BODYWEIGHT_EXPONENT = 2 / 3;
export const BODYWEIGHT_CLAMP_LB: [number, number] = [90, 400];

// ---- Estimated 1RM ----
// Epley is unreliable for high-rep sets (a set of 15 is not a 1.5x max), so the reps that feed it taper off:
// full credit up to E1RM_FULL_CREDIT_REPS, half credit (E1RM_TAPER_CREDIT) for each rep after that up to
// E1RM_MAX_CREDITED_REPS, and nothing beyond. Epley itself is unchanged; it just receives the credited reps.
export const E1RM_FULL_CREDIT_REPS = 10;
export const E1RM_TAPER_CREDIT = 0.5;
export const E1RM_MAX_CREDITED_REPS = 12;

// ---- Women's reference ----
// Optional scoring preference. The tables above are men's published standards; the women's setting multiplies the
// required bodyweight multiple by these factors. Source: a 809,986-entry powerlifting normative study (PubMed
// 39060209), 90th percentile young adults, women relative to men: bench 1.35/1.95 = 0.69, squat 2.26/2.83 = 0.80,
// deadlift 2.66/3.25 = 0.82. Extended to every other lift by body region (upper body like the bench, lower body and
// trunk like the squat and deadlift); approximate.
export const WOMEN_STANDARD_FACTOR = { upper: 0.7, lower: 0.8 } as const;

/** Bump when any standards table, the bodyweight scaling or the e1RM rule changes, so exports say which rules they used. */
export const STANDARDS_VERSION = "2026.2";

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
