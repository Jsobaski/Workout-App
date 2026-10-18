// Optional helper for the MANUAL load multiplier. Nothing here changes a score
// by itself: given two exercises the user logged in the same weeks (e.g. a
// machine press and a dumbbell press), it proposes a multiplier for the first
// one and the user accepts or rejects it in Settings.
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { WorkoutEntry } from "./types";
import { canonicalExerciseKey, exerciseDisplayName } from "./exerciseMuscleMap";
import { ExerciseSettingsData, effectiveLoadForSet, resolveConfigForKey } from "./exerciseSettings";
import { BODYWEIGHT_FALLBACK_LB } from "./muscleScoreConfig";
import { epley1RM } from "./muscleScoring";

export interface PairedWeek {
  /** Monday of the week (YYYY-MM-DD). */
  weekStart: string;
  /** Best e1RM that week for the exercise being calibrated, from the raw logged weight (multiplier 1). */
  targetE1RM: number;
  /** Best e1RM that week for the reference exercise, using its own current settings. */
  referenceE1RM: number;
  /** referenceE1RM / targetE1RM — the multiplier that would have made them equal that week. */
  ratio: number;
}

export interface MultiplierProposal {
  /** Median ratio across paired weeks, rounded to 2 decimals. */
  multiplier: number;
  weeks: PairedWeek[];
}

function weekStartKey(dateKey: string): string {
  return format(startOfWeek(parseISO(dateKey), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

function bestE1RMByWeek(
  entries: WorkoutEntry[],
  canonicalKey: string,
  loadFor: (entry: WorkoutEntry, weight: number) => number
): Map<string, number> {
  const best = new Map<string, number>();
  for (const entry of entries) {
    if (entry.timed || canonicalExerciseKey(entry.exerciseName) !== canonicalKey) continue;
    const week = weekStartKey(entry.dateKey);
    for (const set of entry.sets) {
      const e1RM = epley1RM(loadFor(entry, set.weight), set.reps);
      if (e1RM > (best.get(week) ?? 0)) best.set(week, e1RM);
    }
  }
  return best;
}

/**
 * Proposes a multiplier for `targetKey` from weeks where both exercises were
 * logged. Returns null when there are no such weeks (nothing to compare).
 */
export function proposeMultiplier(
  entries: WorkoutEntry[],
  targetKey: string,
  referenceKey: string,
  opts: { bodyweightLb?: number | null; settings?: ExerciseSettingsData } = {}
): MultiplierProposal | null {
  if (targetKey === referenceKey) return null;
  const bodyweightLb = opts.bodyweightLb && opts.bodyweightLb > 0 ? opts.bodyweightLb : BODYWEIGHT_FALLBACK_LB;
  const targetCfg = resolveConfigForKey(targetKey, opts.settings);
  const referenceCfg = resolveConfigForKey(referenceKey, opts.settings);
  if (!targetCfg || !referenceCfg) return null;

  const target = bestE1RMByWeek(entries, targetKey, (entry, weight) =>
    effectiveLoadForSet(weight, {
      isBodyweight: entry.bodyweight,
      bodyweightLb,
      bodyweightFraction: targetCfg.bodyweightFraction,
      loadMultiplier: 1,
    })
  );
  const reference = bestE1RMByWeek(entries, referenceKey, (entry, weight) =>
    effectiveLoadForSet(weight, {
      isBodyweight: entry.bodyweight,
      bodyweightLb,
      bodyweightFraction: referenceCfg.bodyweightFraction,
      loadMultiplier: referenceCfg.loadMultiplier,
    })
  );

  const weeks: PairedWeek[] = [];
  for (const [weekStart, targetE1RM] of target) {
    const referenceE1RM = reference.get(weekStart);
    if (!referenceE1RM || targetE1RM <= 0) continue;
    weeks.push({ weekStart, targetE1RM, referenceE1RM, ratio: referenceE1RM / targetE1RM });
  }
  if (weeks.length === 0) return null;
  weeks.sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  const ratios = weeks.map((w) => w.ratio).sort((a, b) => a - b);
  const mid = Math.floor(ratios.length / 2);
  const median = ratios.length % 2 ? ratios[mid] : (ratios[mid - 1] + ratios[mid]) / 2;
  return { multiplier: Math.round(median * 100) / 100, weeks };
}

/** "Oct 6–12" style label for a paired week. */
export function describePairedWeek(week: PairedWeek): string {
  const start = parseISO(week.weekStart);
  return `${format(start, "MMM d")}–${format(addDays(start, 6), "MMM d")}`;
}

export function displayNameForKey(key: string): string {
  return exerciseDisplayName(key);
}
