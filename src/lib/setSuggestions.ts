// Smart set suggestions: from your own history, what to try next time for a movement
// (double progression: climb the reps, then add weight). Pure; it only ever offers a
// suggestion the user can tap, and never changes anything by itself.
import { daysBetween } from "./muscleScoring";
import { ExerciseHistory } from "./exerciseHistory";
import { SetEntry } from "./types";

/** Rep range for double progression: reach the top on every working set, then add weight and restart at the bottom. */
export const REP_FLOOR = 8;
export const REP_CEILING = 12;
/** Longer than this since the last session: ease back in instead of progressing. */
export const LAYOFF_DAYS = 28;
export const EASE_BACK_FACTOR = 0.9;
/** A session this far below the one before (in estimated 1RM) is treated as an off day: repeat, don't progress. */
export const OFF_DAY_RATIO = 0.9;

export type SuggestionKind = "add-weight" | "add-rep" | "add-seconds" | "repeat" | "ease-back";

export interface SetSuggestion {
  kind: SuggestionKind;
  sets: SetEntry[];
  flags: { bodyweight: boolean; timed: boolean; banded: boolean };
  /** One short line shown to the user. */
  reason: string;
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step;
const weightStep = (weight: number) => (weight < 50 ? 2.5 : 5);
const fmt = (n: number) => String(Number.isInteger(n) ? n : Number(n.toFixed(1)));

export function suggestNextSets(history: ExerciseHistory | null, today: string): SetSuggestion | null {
  if (!history || history.sessions.length === 0) return null;
  const sessions = history.sessions;
  const last = sessions[sessions.length - 1];
  const previous = sessions.length > 1 ? sessions[sessions.length - 2] : null;
  const flags = last.flags;
  const copy = (): SetEntry[] => last.sets.map((s) => ({ ...s }));

  // Coming back after a long break: lighter, same reps.
  if (Math.max(0, daysBetween(last.dateKey, today)) > LAYOFF_DAYS) {
    const days = daysBetween(last.dateKey, today);
    if (history.metric === "e1rm") {
      const sets = copy().map((s) => ({ ...s, weight: s.weight > 0 ? roundTo(s.weight * EASE_BACK_FACTOR, 2.5) : 0 }));
      if (sets.some((s, i) => s.weight !== last.sets[i].weight)) {
        return { kind: "ease-back", sets, flags, reason: `${days} days since last time: ease back in at about 90% of your last weights` };
      }
    }
    return { kind: "repeat", sets: copy(), flags, reason: `${days} days since last time: repeat that session` };
  }

  if (history.metric === "seconds") {
    return {
      kind: "add-seconds",
      sets: copy().map((s) => ({ ...s, durationSec: (s.durationSec ?? 0) + 5 })),
      flags,
      reason: "Add 5 seconds to each hold",
    };
  }

  if (history.metric === "reps") {
    return {
      kind: "add-rep",
      sets: copy().map((s) => ({ ...s, reps: s.reps + 1 })),
      flags,
      reason: "Add a rep to each set",
    };
  }

  // Weighted lift. An off day (clearly below the session before) is repeated, not built on.
  if (previous && last.best < previous.best * OFF_DAY_RATIO) {
    return { kind: "repeat", sets: copy(), flags, reason: "Last session was lighter than the one before: repeat it before moving up" };
  }

  const top = Math.max(...last.sets.map((s) => s.weight));
  if (top <= 0) {
    return { kind: "add-rep", sets: copy().map((s) => ({ ...s, reps: s.reps + 1 })), flags, reason: "Add a rep to each set" };
  }
  // Working sets are the ones near the top weight; lighter warm-ups are left alone.
  const isWorking = (s: SetEntry) => s.weight >= top * 0.9;
  const minReps = Math.min(...last.sets.filter(isWorking).map((s) => s.reps));

  if (minReps >= REP_CEILING) {
    const next = top + weightStep(top);
    return {
      kind: "add-weight",
      sets: copy().map((s) => (isWorking(s) ? { ...s, weight: next, reps: REP_FLOOR } : s)),
      flags,
      reason: `Every working set reached ${REP_CEILING} reps: add ${fmt(next - top)} lb and start back at ${REP_FLOOR}`,
    };
  }
  return {
    kind: "add-rep",
    sets: copy().map((s) => (isWorking(s) && s.reps < REP_CEILING ? { ...s, reps: s.reps + 1 } : s)),
    flags,
    reason: `Same weight, one more rep per set (aim for ${REP_CEILING}, then add weight)`,
  };
}
