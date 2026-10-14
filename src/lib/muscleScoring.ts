// Pure scoring/decay/freshness math — no React, no DB access, no I/O.
// Every number here is deterministic given its inputs so this module is
// fully unit-testable and safe to recompute from logs on every render.
import {
  DECAY_FLOOR_RATIO,
  DECAY_GRACE_DAYS,
  DECAY_HALF_LIFE_DAYS,
  STANDARD_SCORE_BREAKPOINTS,
  VOLUME_BONUS_MAX_POINTS,
} from "./muscleScoreConfig";

/** Epley formula: estimated 1-rep max from a completed set. */
export function epley1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight < 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
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
