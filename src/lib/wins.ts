// "Wins": things worth celebrating, derived from the workout log (nothing stored).
// A win is a personal record on a lift, a muscle moving up a strength tier, or a
// badge milestone being crossed. Pure, so the same function feeds the Recent wins
// feed, the weekly recap and the celebration that fires right after a workout is saved.
import { BADGE_CATEGORIES, bestMonthWorkoutCount, currentWeekStreak, totalVolume, totalWorkoutDays } from "./badges";
import { shiftDateKey } from "./date";
import { ExerciseSettingsData, effectiveLoadForSet, resolveExerciseConfig } from "./exerciseSettings";
import { MUSCLE_TIERS, BODYWEIGHT_FALLBACK_LB } from "./muscleScoreConfig";
import { MuscleStats, computeMuscleEngine, tierForScore } from "./muscleEngine";
import { epley1RM } from "./muscleScoring";
import { MUSCLE_GROUPS } from "./muscleTaxonomy";
import { WorkoutEntry } from "./types";

export type WinKind = "pr" | "tier" | "badge";

export interface Win {
  /** Stable across recomputation, so "new" wins can be found by set difference. */
  id: string;
  kind: WinKind;
  dateKey: string;
  emoji: string;
  title: string;
  detail: string;
}

export interface WinOptions {
  bodyweightLb: number | null;
  settings?: ExerciseSettingsData;
  /** Only wins on or after this date are returned (history before it still counts as the baseline). */
  sinceDateKey?: string;
}

const tierIndex = (stats: MuscleStats) =>
  stats.effective == null ? -1 : MUSCLE_TIERS.findIndex((t) => t.id === tierForScore(stats.effective!).id);

/** Best estimated 1RM per exercise per day, for weighted lifts only (timed, banded and reps-only work has no 1RM). */
function dailyBests(entries: WorkoutEntry[], opts: WinOptions) {
  const bodyweight = opts.bodyweightLb && opts.bodyweightLb > 0 ? opts.bodyweightLb : BODYWEIGHT_FALLBACK_LB;
  const byExercise = new Map<string, { name: string; days: Map<string, number> }>();
  for (const entry of entries) {
    if (entry.timed || entry.banded) continue;
    const cfg = resolveExerciseConfig(entry.exerciseName, opts.settings);
    const key = cfg?.key ?? entry.exerciseName.trim().toLowerCase();
    let best = 0;
    for (const set of entry.sets) {
      const load = effectiveLoadForSet(set.weight, {
        isBodyweight: entry.bodyweight,
        bodyweightLb: bodyweight,
        bodyweightFraction: cfg?.bodyweightFraction ?? 0,
        loadMultiplier: cfg?.loadMultiplier ?? 1,
      });
      best = Math.max(best, epley1RM(load, set.reps));
    }
    if (best <= 0) continue;
    const slot = byExercise.get(key) ?? { name: cfg?.displayName ?? entry.exerciseName.trim(), days: new Map() };
    slot.days.set(entry.dateKey, Math.max(slot.days.get(entry.dateKey) ?? 0, best));
    byExercise.set(key, slot);
  }
  return byExercise;
}

function personalRecords(entries: WorkoutEntry[], opts: WinOptions): Win[] {
  const wins: Win[] = [];
  for (const [key, { name, days }] of dailyBests(entries, opts)) {
    let best = 0;
    for (const dateKey of Array.from(days.keys()).sort()) {
      const value = days.get(dateKey)!;
      // The first time a lift is logged sets the baseline; only beating an earlier best is a record.
      if (best > 0 && value >= best + 1 && (!opts.sinceDateKey || dateKey >= opts.sinceDateKey)) {
        wins.push({
          id: `pr:${dateKey}:${key}`,
          kind: "pr",
          dateKey,
          emoji: "🏆",
          title: `New ${name} PR`,
          detail: `Estimated 1RM ${Math.round(best)} → ${Math.round(value)} lb`,
        });
      }
      best = Math.max(best, value);
    }
  }
  return wins;
}

function tierUps(entries: WorkoutEntry[], dates: string[], opts: WinOptions): Win[] {
  const wins: Win[] = [];
  for (const dateKey of dates) {
    const before = computeMuscleEngine(entries, opts.bodyweightLb, shiftDateKey(dateKey, -1), undefined, opts.settings).statsByGroup;
    const after = computeMuscleEngine(entries, opts.bodyweightLb, dateKey, undefined, opts.settings).statsByGroup;
    for (const { id, label } of MUSCLE_GROUPS) {
      const b = before[id];
      const a = after[id];
      if (!b.hasAnyData || !a.hasAnyData || a.lastTrainedDateKey !== dateKey) continue;
      if (tierIndex(a) > tierIndex(b)) {
        const tier = tierForScore(a.effective!);
        wins.push({
          id: `tier:${dateKey}:${id}`,
          kind: "tier",
          dateKey,
          emoji: "📈",
          title: `${label} reached ${tier.label}`,
          detail: `Up from ${tierForScore(b.effective!).label}`,
        });
      }
    }
  }
  return wins;
}

const BADGE_METRICS: Record<string, (entries: WorkoutEntry[]) => number> = {
  workouts: totalWorkoutDays,
  volume: totalVolume,
  streak: currentWeekStreak,
  consistency: bestMonthWorkoutCount,
};

function badgeUnlocks(entries: WorkoutEntry[], dates: string[]): Win[] {
  const wins: Win[] = [];
  for (const dateKey of dates) {
    const upTo = entries.filter((e) => e.dateKey <= dateKey);
    const prior = entries.filter((e) => e.dateKey < dateKey);
    for (const category of BADGE_CATEGORIES) {
      const metric = BADGE_METRICS[category.id];
      if (!metric) continue;
      const now = metric(upTo);
      const was = metric(prior);
      for (const tier of category.tiers) {
        if (now >= tier && was < tier) {
          wins.push({
            id: `badge:${dateKey}:${category.id}:${tier}`,
            kind: "badge",
            dateKey,
            emoji: category.icon,
            title: `${category.title} badge unlocked`,
            detail: category.describe(tier),
          });
        }
      }
    }
  }
  return wins;
}

/** Wins from the whole history, newest first. */
export function computeWins(entries: WorkoutEntry[], opts: WinOptions): Win[] {
  const since = opts.sinceDateKey;
  const dates = Array.from(new Set(entries.map((e) => e.dateKey)))
    .filter((d) => !since || d >= since)
    .sort();
  return [...personalRecords(entries, opts), ...tierUps(entries, dates, opts), ...badgeUnlocks(entries, dates)].sort(
    (a, b) => b.dateKey.localeCompare(a.dateKey) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)
  );
}

/**
 * Wins created by a save: those in `after` that `before` didn't have, looking only
 * at the days the save touched (so it stays cheap even with a long history).
 */
export function newWinsFromSave(before: WorkoutEntry[], after: WorkoutEntry[], dateKey: string, opts: WinOptions): Win[] {
  const known = new Set(computeWins(before, { ...opts, sinceDateKey: dateKey }).map((w) => w.id));
  return computeWins(after, { ...opts, sinceDateKey: dateKey }).filter((w) => !known.has(w.id));
}
