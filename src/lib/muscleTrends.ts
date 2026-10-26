// Muscle score over time: the engine run at regular dates, so each muscle gets a
// line (and a slope in points per week) instead of just Before vs After. Pure.
import { shiftDateKey } from "./date";
import { ExerciseSettingsData } from "./exerciseSettings";
import { computeMuscleEngine } from "./muscleEngine";
import { DEFAULT_STALE_THRESHOLD_DAYS } from "./muscleScoreConfig";
import { MUSCLE_GROUPS, MuscleGroupId } from "./muscleTaxonomy";
import { WorkoutEntry } from "./types";

export interface MuscleTrends {
  /** Oldest first, ending today. */
  dates: string[];
  /** Displayed score per date; null before the muscle had any data. */
  series: Record<MuscleGroupId, (number | null)[]>;
  /** Least-squares slope in points per week, or null with fewer than 3 scored points. */
  slopePerWeek: Record<MuscleGroupId, number | null>;
}

export type TrendDirection = "rising" | "steady" | "falling";
/** A slope smaller than this (points per week) reads as steady. */
export const STEADY_SLOPE = 0.4;

export function trendDirection(slopePerWeek: number | null): TrendDirection | null {
  if (slopePerWeek == null) return null;
  if (slopePerWeek > STEADY_SLOPE) return "rising";
  if (slopePerWeek < -STEADY_SLOPE) return "falling";
  return "steady";
}

export function linearSlope(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? null : num / den;
}

export function buildMuscleTrends(
  entries: WorkoutEntry[],
  bodyweightLb: number | null,
  today: string,
  settings: ExerciseSettingsData | undefined,
  opts: { weeks?: number; stepDays?: number } = {}
): MuscleTrends {
  const weeks = opts.weeks ?? 12;
  const stepDays = opts.stepDays ?? 7;
  const count = Math.max(1, Math.round((weeks * 7) / stepDays));
  const dates = Array.from({ length: count + 1 }, (_, i) => shiftDateKey(today, -(count - i) * stepDays));

  const series = Object.fromEntries(MUSCLE_GROUPS.map((g) => [g.id, [] as (number | null)[]])) as Record<MuscleGroupId, (number | null)[]>;
  for (const date of dates) {
    const { statsByGroup } = computeMuscleEngine(entries, bodyweightLb, date, DEFAULT_STALE_THRESHOLD_DAYS, settings);
    for (const { id } of MUSCLE_GROUPS) {
      const s = statsByGroup[id];
      series[id].push(s.hasAnyData && s.effective != null ? s.effective : null);
    }
  }

  const slopePerWeek = {} as Record<MuscleGroupId, number | null>;
  for (const { id } of MUSCLE_GROUPS) {
    const xs: number[] = [];
    const ys: number[] = [];
    series[id].forEach((v, i) => {
      if (v != null) {
        xs.push((i * stepDays) / 7);
        ys.push(v);
      }
    });
    slopePerWeek[id] = linearSlope(xs, ys);
  }
  return { dates, series, slopePerWeek };
}
