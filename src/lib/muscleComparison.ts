// Like-for-like comparison between two engine snapshots (e.g. Before vs
// After, or 30 days ago vs today). Exercises that are automatically grouped as
// the same lift (liftGroups.ts: same primary muscles, similar name or pattern,
// same load basis) count as one lift, so switching between them is not a
// change. A number is only shown when it IS the muscle's real score change and
// the same lift group leads in both snapshots; when the leading lift has no
// comparable baseline (brand new, or a different load basis) the result says so
// instead of printing a number that could contradict the real change. Pure.
import { MuscleStats } from "./muscleEngine";
import { MUSCLE_GROUPS, MuscleGroupId } from "./muscleTaxonomy";

export type DeltaStatus =
  | "like-for-like" // the same lift group leads both snapshots; delta is the muscle's real score change
  | "consistency" // reps/time-scored muscle: change in the consistency-driven score
  | "new" // the leading lift has no comparable baseline (new exercise, or a different load basis)
  | "lead-changed" // a different (already-logged) lift group leads now — no single like-for-like figure
  | "paused" // decay paused because every exercise for the muscle is restricted — not a drop
  | "incidental" // only secondary/minor credit, no direct (primary) work — nothing meaningful to compare
  | "no-data";

export interface MuscleDelta {
  group: MuscleGroupId;
  /** Points on the displayed 0-100 scale, always equal to the muscle's real score change; null when no comparable baseline exists. */
  delta: number | null;
  status: DeltaStatus;
  /** The lift the change was measured on (like-for-like only). */
  anchorExercise?: string;
}

/** The lift group leading a muscle's strength score: highest-scoring primary lift (any lift if none is primary). */
function leadingExercise(stats: MuscleStats) {
  const primary = stats.exerciseScores.filter((e) => e.weight >= 1);
  const pool = primary.length > 0 ? primary : stats.exerciseScores;
  if (pool.length === 0) return null;
  return pool.reduce((best, e) => (e.peakScore > best.peakScore ? e : best));
}

export function compareSnapshots(
  before: Record<MuscleGroupId, MuscleStats>,
  after: Record<MuscleGroupId, MuscleStats>
): Record<MuscleGroupId, MuscleDelta> {
  const result = {} as Record<MuscleGroupId, MuscleDelta>;

  for (const { id } of MUSCLE_GROUPS) {
    const b = before[id];
    const a = after[id];

    if (!a.hasAnyData) {
      result[id] = { group: id, delta: null, status: "no-data" };
      continue;
    }
    if (a.pausedRestricted) {
      result[id] = { group: id, delta: null, status: "paused" };
      continue;
    }
    if (a.lastTrainedDateKey == null) {
      result[id] = { group: id, delta: null, status: "incidental" };
      continue;
    }
    if (!b.hasAnyData || b.lastTrainedDateKey == null) {
      result[id] = { group: id, delta: null, status: "new" };
      continue;
    }

    const realChange = a.effective! - b.effective!;

    if (a.scoringBasis !== "load" && b.scoringBasis !== "load") {
      result[id] = { group: id, delta: realChange, status: "consistency" };
      continue;
    }
    // Strength-scored now but reps/time-scored before (or vice versa): nothing comparable.
    if (a.scoringBasis !== b.scoringBasis) {
      result[id] = { group: id, delta: null, status: "new" };
      continue;
    }

    const leadAfter = leadingExercise(a);
    const leadBefore = leadingExercise(b);
    if (!leadAfter || !leadBefore) {
      result[id] = { group: id, delta: null, status: "new" };
      continue;
    }
    if (leadAfter.groupKey === leadBefore.groupKey) {
      result[id] = { group: id, delta: realChange, status: "like-for-like", anchorExercise: leadAfter.name };
      continue;
    }
    // A different lift leads now. If the new leader has no baseline at all (it's new, or a
    // different load basis so it was never grouped with anything logged before), say so.
    const hadBaseline = b.exerciseScores.some((e) => e.groupKey === leadAfter.groupKey);
    result[id] = { group: id, delta: null, status: hadBaseline ? "lead-changed" : "new" };
  }
  return result;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${Math.abs(count) === 1 ? singular : plural}`;
}

/** "up 4 points" / "down 1 point" / "no change" — rounded the same way everywhere. */
export function describeDelta(delta: number): string {
  const rounded = Math.round(delta);
  if (rounded === 0) return "no change";
  return `${rounded > 0 ? "up" : "down"} ${pluralize(Math.abs(rounded), "point")}`;
}

export function describeDeltaStatus(d: MuscleDelta): string | null {
  switch (d.status) {
    case "like-for-like":
    case "consistency":
      return d.delta == null ? null : describeDelta(d.delta);
    case "new":
      return "new exercise, no comparison";
    case "lead-changed":
      return "lead lift changed, no comparison";
    case "paused":
      return "paused (restricted)";
    case "incidental":
      return "incidental credit only";
    default:
      return null;
  }
}
