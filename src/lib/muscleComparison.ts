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
import { ExerciseSettingsData, resolveConfigForKey } from "./exerciseSettings";
import { DECAY_FLOOR_RATIO, DECAY_GRACE_DAYS, VOLUME_BONUS_WINDOW_DAYS } from "./muscleScoreConfig";

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

export type DeltaReasonKind =
  | "lead-lift" // the lead lift (or the training volume behind it) really changed
  | "replaced" // a new lift replaced the old one, or the lift has no earlier baseline
  | "decay" // time since the last direct work
  | "restricted" // the lead lift is now restricted (or the whole muscle is paused)
  | "basis" // the muscle is now scored from a direct lift instead of incidental credit
  | "none";

export interface DeltaReason {
  kind: DeltaReasonKind;
  label: string;
  text: string;
}

const REASON_LABELS: Record<DeltaReasonKind, string> = {
  "lead-lift": "Real change",
  replaced: "New lift",
  decay: "Inactivity",
  restricted: "Restricted",
  basis: "Scoring changed",
  none: "No comparison",
};

function reason(kind: DeltaReasonKind, text: string): DeltaReason {
  return { kind, label: REASON_LABELS[kind], text };
}

/**
 * Why a muscle's delta is what it is, chosen automatically from the two snapshots (no input needed):
 * a real change in the lead lift, a new lift replacing the old one, decay from inactivity,
 * or the lead lift now being restricted. Pure.
 */
export function explainDelta(
  before: MuscleStats,
  after: MuscleStats,
  delta: MuscleDelta,
  settings?: ExerciseSettingsData
): DeltaReason {
  const lead = leadingExercise(after);
  const leadBefore = leadingExercise(before);

  switch (delta.status) {
    case "paused":
      return reason("restricted", "Every exercise for this muscle is restricted, so its score is held instead of decaying.");
    case "no-data":
      return reason("none", "Nothing logged for this muscle yet.");
    case "incidental":
      return reason("none", "Only incidental credit from other lifts. There is no direct work to compare.");
    case "new":
      if (before.hasAnyData && before.scoringBasis !== "load" && after.scoringBasis === "load" && lead) {
        return reason(
          "basis",
          `Now scored from ${lead.name} instead of incidental credit, so this isn't a gain or a drop. The score keeps at least what it was until the ${lead.name} score is higher.`
        );
      }
      return reason(
        "replaced",
        lead && leadBefore
          ? `${lead.name} now leads and has no comparable earlier baseline (a new lift, or loaded a different way than ${leadBefore.name}), so no change is claimed.`
          : lead
            ? `${lead.name} is new for this muscle, so there is nothing earlier to compare with.`
            : "This muscle had no earlier scored work to compare with."
      );
    case "lead-changed":
      return reason(
        "replaced",
        `${lead?.name ?? "A different lift"} now leads this muscle${leadBefore ? ` instead of ${leadBefore.name}` : ""}, so a single before/after figure would be misleading.`
      );
  }

  const change = delta.delta ?? 0;
  if (Math.abs(change) < 0.5) return reason("none", "No meaningful change in this period.");
  if (delta.status === "consistency") {
    return reason("lead-lift", "Reps, time and training consistency changed. This muscle has no load standard to score against.");
  }

  // Split the real change into "peak" (best lift / training volume) and "decay" (days since direct work).
  const peakChange = (after.peak ?? 0) - (before.peak ?? 0);
  const decayChange = (after.effective ?? 0) - (after.peak ?? 0) - ((before.effective ?? 0) - (before.peak ?? 0));
  const days = after.daysStale;

  if (change < 0 && decayChange < 0 && Math.abs(decayChange) >= Math.abs(peakChange)) {
    const decayText =
      days != null
        ? `no direct work for ${days} ${days === 1 ? "day" : "days"} (decay starts after ${DECAY_GRACE_DAYS} days and never goes below ${Math.round(DECAY_FLOOR_RATIO * 100)}% of your peak)`
        : "no direct work logged";
    const cfg = lead ? resolveConfigForKey(lead.key, settings) : null;
    if (cfg?.restricted) {
      return reason(
        "restricted",
        `${lead!.name} is now restricted, so it hasn't been repeated: ${decayText}. Your peak is unchanged; an allowed exercise for this muscle will bring the score back.`
      );
    }
    return reason("decay", `Decay from inactivity: ${decayText}. Your best lift is unchanged.`);
  }

  const bScore = lead ? before.exerciseScores.find((e) => e.groupKey === lead.groupKey) : undefined;
  if (lead && bScore && Math.abs(lead.e1RM - bScore.e1RM) >= 1) {
    return reason("lead-lift", `${lead.name} best estimated 1RM went from ${Math.round(bScore.e1RM)} to ${Math.round(lead.e1RM)} lb.`);
  }
  return reason(
    "lead-lift",
    `Training volume over the last ${VOLUME_BONUS_WINDOW_DAYS} days changed${lead ? ` (${lead.name}'s best is unchanged)` : ""}.`
  );
}
