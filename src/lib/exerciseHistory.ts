// Per-exercise history: sessions, best sets, PRs and totals for one movement. Pure.
// Name variants of one movement (aliases, brand names) are combined through the canonical
// exercise key; unmapped names match case-insensitively. Values use the weights as logged.
import { canonicalExerciseKey, exerciseDisplayName } from "./exerciseMuscleMap";
import { epley1RM } from "./muscleScoring";
import { SetEntry, WorkoutEntry } from "./types";

export type HistoryMetric = "e1rm" | "reps" | "seconds";

export interface HistorySession {
  dateKey: string;
  sets: SetEntry[];
  /** How this lift was logged that day (used when suggesting the next session). */
  flags: { bodyweight: boolean; timed: boolean; banded: boolean };
  /** Best value of the metric that day: estimated 1RM (lb), reps, or seconds. */
  best: number;
  bestSet: SetEntry;
  /** Total lb moved (reps x weight), total reps, or total seconds, matching the metric. */
  volume: number;
  isPR: boolean;
}

export interface ExerciseHistory {
  key: string;
  name: string;
  metric: HistoryMetric;
  unit: string;
  /** Oldest first. */
  sessions: HistorySession[];
  best: HistorySession;
  prs: HistorySession[];
  totalVolume: number;
  totalSets: number;
}

export function exerciseGroupKey(name: string): string {
  return canonicalExerciseKey(name) ?? name.trim().toLowerCase();
}

function metricFor(entry: WorkoutEntry): HistoryMetric {
  if (entry.timed) return "seconds";
  if (entry.bodyweight || entry.banded) return "reps";
  return "e1rm";
}

function setValue(set: SetEntry, metric: HistoryMetric): number {
  if (metric === "seconds") return set.durationSec ?? 0;
  if (metric === "reps") return set.reps;
  return epley1RM(set.weight, set.reps);
}

function setVolume(set: SetEntry, metric: HistoryMetric): number {
  if (metric === "seconds") return set.durationSec ?? 0;
  if (metric === "reps") return set.reps;
  return set.reps * set.weight;
}

/** Entries for a movement, or null when it has never been logged. */
export function buildExerciseHistory(entries: WorkoutEntry[], name: string): ExerciseHistory | null {
  const key = exerciseGroupKey(name);
  const matching = entries.filter((e) => exerciseGroupKey(e.exerciseName) === key);
  if (matching.length === 0) return null;
  matching.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.timestamp - b.timestamp);

  // The most recent entry says how the lift is being logged now; earlier ones are measured the same way.
  const latest = matching[matching.length - 1];
  const metric = metricFor(latest);

  const byDay = new Map<string, WorkoutEntry[]>();
  for (const entry of matching) byDay.set(entry.dateKey, [...(byDay.get(entry.dateKey) ?? []), entry]);

  const sessions: HistorySession[] = [];
  let bestSoFar = 0;
  for (const dateKey of Array.from(byDay.keys()).sort()) {
    const dayEntries = byDay.get(dateKey)!;
    const sets = dayEntries.flatMap((e) => e.sets);
    if (sets.length === 0) continue;
    let bestSet = sets[0];
    let best = setValue(bestSet, metric);
    for (const set of sets) {
      const v = setValue(set, metric);
      if (v > best) {
        best = v;
        bestSet = set;
      }
    }
    const last = dayEntries[dayEntries.length - 1];
    sessions.push({
      dateKey,
      sets,
      flags: { bodyweight: !!last.bodyweight, timed: !!last.timed, banded: !!last.banded },
      best,
      bestSet,
      volume: sets.reduce((sum, s) => sum + setVolume(s, metric), 0),
      // The first session is a baseline, not a record.
      isPR: bestSoFar > 0 && best >= bestSoFar + 1,
    });
    bestSoFar = Math.max(bestSoFar, best);
  }
  if (sessions.length === 0) return null;

  const bestSession = sessions.reduce((a, b) => (b.best > a.best ? b : a));
  return {
    key,
    name: canonicalExerciseKey(name) ? exerciseDisplayName(key) : latest.exerciseName.trim(),
    metric,
    unit: metric === "e1rm" ? "lb" : metric === "seconds" ? "s" : "reps",
    sessions,
    best: bestSession,
    prs: sessions.filter((s) => s.isPR),
    totalVolume: sessions.reduce((sum, s) => sum + s.volume, 0),
    totalSets: sessions.reduce((sum, s) => sum + s.sets.length, 0),
  };
}

/** "3×10 @ 25 lb", "10, 10, 8 reps", "3 × 30s": identical sets are grouped. */
export function summarizeSets(sets: SetEntry[], flags: { timed: boolean; bodyweight: boolean; banded: boolean }): string {
  if (sets.length === 0) return "";
  const label = (s: SetEntry) =>
    flags.timed ? `${s.durationSec ?? 0}s` : flags.bodyweight || flags.banded ? `${s.reps}` : `${s.reps}@${s.weight}`;
  const first = label(sets[0]);
  const allSame = sets.every((s) => label(s) === first);
  if (allSame && sets.length > 1) {
    if (flags.timed) return `${sets.length} × ${sets[0].durationSec ?? 0}s`;
    if (flags.bodyweight || flags.banded) return `${sets.length}×${sets[0].reps} reps`;
    return `${sets.length}×${sets[0].reps} @ ${sets[0].weight} lb`;
  }
  if (flags.timed) return sets.map((s) => `${s.durationSec ?? 0}s`).join(", ");
  if (flags.bodyweight || flags.banded) return `${sets.map((s) => s.reps).join(", ")} reps`;
  return sets.map((s) => `${s.reps}×${s.weight}`).join(", ") + " lb";
}
