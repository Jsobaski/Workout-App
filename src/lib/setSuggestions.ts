// Smart set suggestions: from your own history, what to try next time for a movement
// (double progression: climb the reps, then add weight). Pure; it only ever offers a
// suggestion the user can tap, and never changes anything by itself.
//
// Learned from the user's own logs (with plain defaults when there's too little history):
//  - the rep ceiling (how far they climb before adding weight),
//  - the weight increment their equipment actually allows (from the differences between logged weights),
// and always bounded by the exercise's restriction and limit settings.
import { liftGroupMembers } from "./liftGroups";
import { daysBetween } from "./muscleScoring";
import { ExerciseSettingsData, resolveExerciseConfig } from "./exerciseSettings";
import { ExerciseHistory, HistorySession, exerciseGroupKey } from "./exerciseHistory";
import { parseLimit } from "./limits";
import { SetEntry, WorkoutEntry } from "./types";

/** Used for the rep ceiling until there's enough history to learn the user's own. */
export const DEFAULT_REP_CEILING = 12;
/** Restart reps after adding weight, as a fraction of the ceiling (8 for 12, 10 for 15), never below MIN_RESTART_REPS. */
export const RESTART_FRACTION = 2 / 3;
export const MIN_RESTART_REPS = 5;
/** Sessions looked at (most recent) and the least needed before the ceiling is learned. */
export const CEILING_LOOKBACK = 8;
export const MIN_SESSIONS_FOR_CEILING = 3;
/** Distinct logged weights needed before an increment is inferred (two or more steps). */
export const MIN_WEIGHTS_FOR_INCREMENT = 3;
/** Longer than this since the last session: ease back in instead of progressing. */
export const LAYOFF_DAYS = 28;
export const EASE_BACK_FACTOR = 0.9;
/** A session this far below the one before (in estimated 1RM) is treated as an off day: repeat, don't progress. */
export const OFF_DAY_RATIO = 0.9;
/** Kept for callers/tests that refer to the classic 8-12 range. */
export const REP_FLOOR = 8;
export const REP_CEILING = DEFAULT_REP_CEILING;

export type SuggestionKind = "add-weight" | "add-rep" | "add-seconds" | "repeat" | "ease-back";

export interface SetSuggestion {
  kind: SuggestionKind;
  sets: SetEntry[];
  flags: { bodyweight: boolean; timed: boolean; banded: boolean };
  /** One short line shown to the user. */
  reason: string;
}

export interface SuggestionOptions {
  /** This device's restrictions and limits; a restricted exercise gets no suggestion and limits cap what's suggested. */
  settings?: ExerciseSettingsData;
  /** Every distinct weight logged on this exercise and its grouped variants, used to infer the equipment's step. */
  loggedWeights?: number[];
}

const fmt = (n: number) => String(Number.isInteger(n) ? n : Number(n.toFixed(2)));
const roundTo = (value: number, step: number) => Math.round(value / step) * step;
const fallbackStep = (weight: number) => (weight < 50 ? 2.5 : 5);

const topWeight = (session: HistorySession) => Math.max(...session.sets.map((s) => s.weight));
/** Sets near the top weight; lighter warm-ups are left out. With no weight at all, every set counts. */
function workingSets(session: HistorySession): SetEntry[] {
  const top = topWeight(session);
  return top <= 0 ? session.sets : session.sets.filter((s) => s.weight >= top * 0.9);
}
/** The rep count every working set reached that day. */
const minWorkingReps = (session: HistorySession) => Math.min(...workingSets(session).map((s) => s.reps));

/**
 * The rep count this user climbs to before adding weight, learned from their logs.
 *  1. Each time the top weight went up between sessions, the reps every working set had reached just before
 *     is one observation of the user's ceiling; the most common one wins (ties go to the higher).
 *  2. Otherwise a plateau at one weight: the highest count every working set reached in two or more of
 *     the last sessions at that weight (only when the reps aren't still climbing).
 *  3. Otherwise DEFAULT_REP_CEILING, which is also used with fewer than MIN_SESSIONS_FOR_CEILING sessions.
 * Clamped to at least MIN_RESTART_REPS.
 */
export function inferRepCeiling(sessions: HistorySession[]): { ceiling: number; learned: boolean } {
  const recent = sessions.slice(-CEILING_LOOKBACK);
  if (recent.length < MIN_SESSIONS_FOR_CEILING) return { ceiling: DEFAULT_REP_CEILING, learned: false };

  const observations: number[] = [];
  for (let i = 0; i + 1 < recent.length; i++) {
    if (topWeight(recent[i + 1]) > topWeight(recent[i])) observations.push(minWorkingReps(recent[i]));
  }
  if (observations.length > 0) {
    const counts = new Map<number, number>();
    for (const o of observations) counts.set(o, (counts.get(o) ?? 0) + 1);
    const best = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
    return { ceiling: Math.max(MIN_RESTART_REPS, best), learned: true };
  }

  // Plateau: the sessions at the latest top weight.
  const latestTop = topWeight(recent[recent.length - 1]);
  const block = recent.filter((s) => topWeight(s) === latestTop);
  if (block.length >= MIN_SESSIONS_FOR_CEILING) {
    const mins = block.map(minWorkingReps);
    const climbing = mins[mins.length - 1] > mins[mins.length - 2];
    if (!climbing) {
      for (let v = Math.max(...mins); v >= 1; v--) {
        if (mins.filter((m) => m >= v).length >= 2) return { ceiling: Math.max(MIN_RESTART_REPS, v), learned: true };
      }
    }
  }
  return { ceiling: DEFAULT_REP_CEILING, learned: false };
}

/**
 * The smallest weight step the user's equipment allows, from the gaps between weights they've logged:
 * the smallest gap that most gaps are whole multiples of. Null with too little history.
 */
export function inferIncrement(weights: number[]): number | null {
  const distinct = Array.from(new Set(weights.filter((w) => w > 0).map((w) => Math.round(w * 100) / 100))).sort((a, b) => a - b);
  if (distinct.length < MIN_WEIGHTS_FOR_INCREMENT) return null;
  const gaps = distinct.slice(1).map((w, i) => Math.round((w - distinct[i]) * 100) / 100);
  const candidates = Array.from(new Set(gaps)).filter((g) => g >= 1).sort((a, b) => a - b);
  for (const c of candidates) {
    const multiples = gaps.filter((g) => Math.abs(g / c - Math.round(g / c)) < 0.02).length;
    if (multiples / gaps.length >= 0.75) return c;
  }
  return null;
}

/** Every distinct weight logged on a movement and on the movements automatically grouped with it. */
export function loggedWeightsForGroup(entries: WorkoutEntry[], name: string, settings?: ExerciseSettingsData): number[] {
  const key = exerciseGroupKey(name);
  const keys = new Set([key, ...liftGroupMembers(key, settings)]);
  const weights = new Set<number>();
  for (const e of entries) {
    if (e.timed || e.bodyweight || e.banded || !keys.has(exerciseGroupKey(e.exerciseName))) continue;
    for (const s of e.sets) if (s.weight > 0) weights.add(s.weight);
  }
  return Array.from(weights);
}

export function suggestNextSets(history: ExerciseHistory | null, today: string, options: SuggestionOptions = {}): SetSuggestion | null {
  if (!history || history.sessions.length === 0) return null;
  const { settings } = options;

  // A restricted exercise (its own restriction or a restricted pattern) gets no suggestion at all.
  const cfg = resolveExerciseConfig(history.name, settings);
  if (cfg?.restricted) return null;
  const limit = parseLimit(cfg?.limit);

  const sessions = history.sessions;
  const last = sessions[sessions.length - 1];
  const previous = sessions.length > 1 ? sessions[sessions.length - 2] : null;
  const flags = last.flags;
  const copy = (): SetEntry[] => last.sets.map((s) => ({ ...s }));

  // Never beyond the user's limit: at most that many sets, each at most that many reps.
  const withinLimit = (s: SetSuggestion): SetSuggestion => {
    if (!limit) return s;
    const sets = s.sets.slice(0, limit.sets).map((set) => (set.reps > limit.reps ? { ...set, reps: limit.reps } : set));
    const changed = sets.length !== s.sets.length || sets.some((set, i) => set.reps !== s.sets[i].reps);
    return { ...s, sets, reason: changed ? `${s.reason} (kept within your ${limit.sets}x${limit.reps} limit)` : s.reason };
  };

  const increment = history.metric === "e1rm" ? inferIncrement(options.loggedWeights ?? history.sessions.flatMap((x) => x.sets.map((set) => set.weight))) : null;
  const stepFor = (weight: number) => increment ?? fallbackStep(weight);

  // Coming back after a long break: lighter, same reps.
  const daysSince = Math.max(0, daysBetween(last.dateKey, today));
  if (daysSince > LAYOFF_DAYS) {
    if (history.metric === "e1rm") {
      const top = topWeight(last);
      const sets = copy().map((s) => {
        if (s.weight <= 0) return s;
        if (increment) {
          // Stay on the equipment's steps: drop whole increments (at least one) from where you were.
          const steps = Math.max(1, Math.round((s.weight * (1 - EASE_BACK_FACTOR)) / increment));
          const lighter = Math.round((s.weight - steps * increment) * 100) / 100;
          return lighter > 0 ? { ...s, weight: lighter } : s;
        }
        return { ...s, weight: roundTo(s.weight * EASE_BACK_FACTOR, 2.5) };
      });
      if (top > 0 && sets.some((s, i) => s.weight !== last.sets[i].weight)) {
        return withinLimit({ kind: "ease-back", sets, flags, reason: `${daysSince} days since last time: ease back in at about 90% of your last weights` });
      }
    }
    return withinLimit({ kind: "repeat", sets: copy(), flags, reason: `${daysSince} days since last time: repeat that session` });
  }

  if (history.metric === "seconds") {
    return withinLimit({
      kind: "add-seconds",
      sets: copy().map((s) => ({ ...s, durationSec: (s.durationSec ?? 0) + 5 })),
      flags,
      reason: "Add 5 seconds to each hold",
    });
  }

  if (history.metric === "reps") {
    return withinLimit({ kind: "add-rep", sets: copy().map((s) => ({ ...s, reps: s.reps + 1 })), flags, reason: "Add a rep to each set" });
  }

  // Weighted lift. An off day (clearly below the session before) is repeated, not built on.
  if (previous && last.best < previous.best * OFF_DAY_RATIO) {
    return withinLimit({ kind: "repeat", sets: copy(), flags, reason: "Last session was lighter than the one before: repeat it before moving up" });
  }

  const top = topWeight(last);
  if (top <= 0) {
    return withinLimit({ kind: "add-rep", sets: copy().map((s) => ({ ...s, reps: s.reps + 1 })), flags, reason: "Add a rep to each set" });
  }
  const isWorking = (s: SetEntry) => s.weight >= top * 0.9;
  const minReps = Math.min(...last.sets.filter(isWorking).map((s) => s.reps));

  // The ceiling is the user's own, and never above what their limit allows.
  const learned = inferRepCeiling(sessions);
  const ceiling = limit ? Math.min(learned.ceiling, limit.reps) : learned.ceiling;
  const ceilingNote = learned.learned && !limit ? " (your usual top)" : "";

  if (minReps >= ceiling) {
    const step = stepFor(top);
    const next = Math.round((top + step) * 100) / 100;
    const restart = Math.min(ceiling, Math.max(MIN_RESTART_REPS, Math.round(ceiling * RESTART_FRACTION)));
    return withinLimit({
      kind: "add-weight",
      sets: copy().map((s) => (isWorking(s) ? { ...s, weight: next, reps: restart } : s)),
      flags,
      reason: `Every working set reached ${ceiling} reps${ceilingNote}: add ${fmt(next - top)} lb and start back at ${restart}`,
    });
  }
  return withinLimit({
    kind: "add-rep",
    sets: copy().map((s) => (isWorking(s) && s.reps < ceiling ? { ...s, reps: s.reps + 1 } : s)),
    flags,
    reason: `Same weight, one more rep per set (aim for ${ceiling}, then add weight)`,
  });
}
