// Pure scoring/decay/freshness math — no React, no DB access, no I/O.
// Every number here is deterministic given its inputs so this module is
// fully unit-testable and safe to recompute from logs on every render.
import {
  BODYWEIGHT_CLAMP_LB,
  BODYWEIGHT_EXPONENT,
  DECAY_FLOOR_RATIO,
  DECAY_GRACE_DAYS,
  DECAY_HALF_LIFE_DAYS,
  E1RM_REP_CAP,
  REFERENCE_BODYWEIGHT_LB,
  SOFT_CAP_SCALE,
  SOFT_CAP_START,
  STANDARD_SCORE_BREAKPOINTS,
  VOLUME_BONUS_MAX_POINTS,
} from "./muscleScoreConfig";

/** Epley formula: estimated 1-rep max from a completed set. */
export function epley1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight < 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/**
 * Estimated 1RM used for scoring and history: Epley, but reps beyond E1RM_REP_CAP don't count, since the formula
 * overstates high-rep sets (15 reps would otherwise read as a 1.5x max).
 */
export function estimate1RM(weight: number, reps: number): number {
  return epley1RM(weight, Math.min(reps, E1RM_REP_CAP));
}

/**
 * A lift's strength relative to the lifter's size, on the scale the standard tables use (the multiple a 180 lb lifter
 * would need): e1RM / bodyweight, scaled by (bodyweight / 180) ^ (1 - BODYWEIGHT_EXPONENT) so that absolute strength
 * is compared at bodyweight ^ 2/3 rather than proportionally.
 */
export function normalizedBodyweightRatio(e1RM: number, bodyweightLb: number): number {
  const bw = Math.min(BODYWEIGHT_CLAMP_LB[1], Math.max(BODYWEIGHT_CLAMP_LB[0], bodyweightLb));
  return (e1RM / bw) * Math.pow(bw / REFERENCE_BODYWEIGHT_LB, 1 - BODYWEIGHT_EXPONENT);
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

/**
 * Piecewise-linear interpolation of a bodyweight-ratio onto a 0-100 score,
 * given the ratio values at score breakpoints [0, 25, 50, 75, 100].
 */
export function ratioToScore(ratio: number, breakpoints: readonly [number, number, number, number, number]): number {
  const scores = STANDARD_SCORE_BREAKPOINTS;
  if (ratio <= breakpoints[0]) return 0;
  if (ratio >= breakpoints[breakpoints.length - 1]) return 100;
  for (let i = 0; i < breakpoints.length - 1; i++) {
    const lo = breakpoints[i];
    const hi = breakpoints[i + 1];
    if (ratio >= lo && ratio <= hi) {
      const t = (ratio - lo) / (hi - lo);
      return clampScore(scores[i] + t * (scores[i + 1] - scores[i]));
    }
  }
  return 0;
}

/**
 * Same interpolation as ratioToScore, but past the top breakpoint it keeps
 * extending along the last segment's slope instead of clamping at 100, so a
 * lift beyond "elite" still registers progress internally. Never negative.
 */
export function ratioToUncappedScore(ratio: number, breakpoints: readonly [number, number, number, number, number]): number {
  const last = breakpoints.length - 1;
  if (ratio <= breakpoints[0]) return 0;
  if (ratio <= breakpoints[last]) return ratioToScore(ratio, breakpoints);
  const slope = (STANDARD_SCORE_BREAKPOINTS[last] - STANDARD_SCORE_BREAKPOINTS[last - 1]) / (breakpoints[last] - breakpoints[last - 1]);
  return 100 + (ratio - breakpoints[last]) * slope;
}

/**
 * Inverse of ratioToUncappedScore: the bodyweight ratio that earns `score`
 * (scores at/below 0 map to the lowest breakpoint).
 */
export function ratioForScore(score: number, breakpoints: readonly [number, number, number, number, number]): number {
  const last = breakpoints.length - 1;
  if (score <= 0) return breakpoints[0];
  if (score >= 100) {
    const slope = (STANDARD_SCORE_BREAKPOINTS[last] - STANDARD_SCORE_BREAKPOINTS[last - 1]) / (breakpoints[last] - breakpoints[last - 1]);
    return breakpoints[last] + (score - 100) / slope;
  }
  for (let i = 0; i < last; i++) {
    const lo = STANDARD_SCORE_BREAKPOINTS[i];
    const hi = STANDARD_SCORE_BREAKPOINTS[i + 1];
    if (score >= lo && score <= hi) {
      return breakpoints[i] + ((score - lo) / (hi - lo)) * (breakpoints[i + 1] - breakpoints[i]);
    }
  }
  return breakpoints[0];
}

/**
 * Maps an uncapped raw score onto the displayed 0-100 scale: identity up to
 * SOFT_CAP_START, then asymptotically approaching (never reaching) 100.
 */
export function softCapScore(raw: number): number {
  if (raw <= 0) return 0;
  if (raw <= SOFT_CAP_START) return raw;
  const headroom = 100 - SOFT_CAP_START;
  return SOFT_CAP_START + headroom * (1 - Math.exp(-(raw - SOFT_CAP_START) / SOFT_CAP_SCALE));
}

/** Multiplier (0-1] that applyDecay would apply to any peak after `daysSincePeak` days. */
export function decayFactor(daysSincePeak: number): number {
  return applyDecay(100, daysSincePeak) / 100;
}

/**
 * Detraining decay: no loss for `graceDays`, then exponential decay with
 * `halfLifeDays` toward a floor of `floorRatio` of peak.
 */
export function applyDecay(
  peak: number,
  daysSincePeak: number,
  {
    graceDays = DECAY_GRACE_DAYS,
    halfLifeDays = DECAY_HALF_LIFE_DAYS,
    floorRatio = DECAY_FLOOR_RATIO,
  }: { graceDays?: number; halfLifeDays?: number; floorRatio?: number } = {}
): number {
  const floor = peak * floorRatio;
  const decayDays = Math.max(0, daysSincePeak - graceDays);
  const effective = floor + (peak - floor) * Math.pow(0.5, decayDays / halfLifeDays);
  return clampScore(effective);
}

/**
 * Consistency bonus, 0..maxPoints, scaling linearly with distinct training
 * days hitting this muscle within the window, capped at targetSessions.
 */
export function volumeConsistencyBonus(
  distinctTrainingDaysInWindow: number,
  targetSessions: number,
  maxPoints: number = VOLUME_BONUS_MAX_POINTS
): number {
  if (targetSessions <= 0) return 0;
  const ratio = Math.min(1, distinctTrainingDaysInWindow / targetSessions);
  return ratio * maxPoints;
}

export function daysBetween(fromDateKey: string, toDateKey: string): number {
  const from = new Date(`${fromDateKey}T00:00:00`).getTime();
  const to = new Date(`${toDateKey}T00:00:00`).getTime();
  return Math.round((to - from) / 86_400_000);
}
