// Like-for-like comparison between two engine snapshots (e.g. Before vs
// After, or 30 days ago vs today). A muscle's change is measured on the SAME
// exercise in both snapshots, so switching to a different exercise or machine
// (40 lb DB bench -> plate-loaded press) shows up as "equipment changed"
// instead of as strength gained. Pure — no React, DB or I/O.
import { MuscleStats } from "./muscleEngine";
import { MUSCLE_GROUPS, MuscleGroupId } from "./muscleTaxonomy";

export type DeltaStatus =
  | "like-for-like" // change on a shared exercise
  | "consistency" // reps/time-scored muscle: change in the consistency-driven score
  | "equipment-changed" // scored by different exercises in each snapshot — not comparable
  | "paused" // decay paused for a PT-restricted exercise — not a drop
  | "incidental" // only secondary/minor credit, no direct (primary) work — nothing meaningful to compare
  | "new" // no data in the Before snapshot
  | "no-data";

export interface MuscleDelta {
  group: MuscleGroupId;
  /** Points on the displayed 0-100 scale; null when the change isn't comparable. */
  delta: number | null;
  status: DeltaStatus;
  /** The shared exercise the change was measured on (like-for-like only). */
  anchorExercise?: string;
  /**
   * The exercise now driving the muscle's score isn't the one that drove it in
   * the Before snapshot (switched exercise/machine), so the headline score
   * change is NOT purely strength. `delta` still only reflects the shared exercise.
   */
  equipmentChanged?: boolean;
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

    if (a.scoringBasis !== "load" && b.scoringBasis !== "load") {
      result[id] = { group: id, delta: a.effective! - b.effective!, status: "consistency" };
      continue;
    }

    const beforeByKey = new Map(b.exerciseScores.map((e) => [e.key, e]));
    const shared = a.exerciseScores.filter((e) => beforeByKey.has(e.key));
    // Prefer primary-contribution exercises as the anchor; fall back to any shared one.
    const primaryShared = shared.filter((e) => e.weight >= 1.0);
    const candidates = primaryShared.length > 0 ? primaryShared : shared;
    if (candidates.length === 0) {
      result[id] = { group: id, delta: null, status: "equipment-changed" };
      continue;
    }
    const anchor = candidates.reduce((best, e) => (e.effectiveScore > best.effectiveScore ? e : best));
    const topKey = (scores: typeof a.exerciseScores) =>
      scores.length === 0 ? null : scores.reduce((best, e) => (e.effectiveScore > best.effectiveScore ? e : best)).key;
    const equipmentChanged = topKey(a.exerciseScores) !== topKey(b.exerciseScores);
    result[id] = {
      group: id,
      delta: anchor.effectiveScore - beforeByKey.get(anchor.key)!.effectiveScore,
      status: "like-for-like",
      anchorExercise: anchor.name,
      equipmentChanged,
    };
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
      return d.delta == null ? null : `${describeDelta(d.delta)}${d.equipmentChanged ? " (equipment changed)" : ""}`;
    case "consistency":
      return d.delta == null ? null : describeDelta(d.delta);
    case "equipment-changed":
      return "equipment changed — not comparable";
    case "paused":
      return "paused (restricted)";
    case "new":
      return "new — no earlier data";
    case "incidental":
      return "incidental credit only";
    default:
      return null;
  }
}
