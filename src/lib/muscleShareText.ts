import { MuscleEngineResult, tierForScore } from "./muscleEngine";
import { MUSCLE_GROUPS, MuscleGroupId } from "./muscleTaxonomy";
import { WorkoutEntry } from "./types";
import { formatWorkoutText } from "./shareText";
import { shiftDateKey } from "./date";
import { MuscleDelta, describeDeltaStatus } from "./muscleComparison";
import { ExerciseSettingsOverrides, listNeedsPtConfirmation, listRestrictedExercises } from "./exerciseSettings";
import { DEFAULT_STALE_THRESHOLD_DAYS, TREND_WINDOW_DAYS } from "./muscleScoreConfig";

const RECENT_DAYS = 14;

export function formatMuscleSummaryText(opts: {
  asOfDateKey: string;
  bodyweightLb: number | null;
  result: MuscleEngineResult;
  /** Like-for-like change vs TREND_WINDOW_DAYS ago (see compareSnapshots). */
  deltaByGroup: Record<MuscleGroupId, MuscleDelta>;
  entries: WorkoutEntry[];
  overrides?: ExerciseSettingsOverrides;
}): string {
  const { asOfDateKey, bodyweightLb, result, deltaByGroup, entries, overrides } = opts;
  const lines = [
    `Muscle strength summary — as of ${asOfDateKey}`,
    bodyweightLb ? `Bodyweight: ${bodyweightLb} lb` : "Bodyweight: not set",
    "Scores are 0-100 (soft-capped, so 100 is hard to reach; 'raw' is the uncapped value). Tiers: Needs Work (<20), Developing (20-39), Solid (40-59), Strong (60-79), Elite (80+).",
    `"Stale" = no meaningful primary-muscle training in ${DEFAULT_STALE_THRESHOLD_DAYS}+ days (score decays over time). Secondary credit never resets that clock.`,
    `"Paused (restricted)" = last primary work was a PT-restricted exercise, so decay is on hold. Changes are ${TREND_WINDOW_DAYS}-day, like-for-like (same exercise); an equipment change is flagged instead of counted as strength.`,
    "",
    "Muscles:",
  ];

  for (const g of MUSCLE_GROUPS) {
    const s = result.statsByGroup[g.id];
    const golf = g.golfRelevant ? " [golf-relevant]" : "";
    if (!s.hasAnyData || s.effective == null) {
      lines.push(`- ${g.label}${golf}: no data logged`);
      continue;
    }
    const parts = [`${tierForScore(s.effective).label} (${Math.round(s.effective)})`];
    if (s.effectiveRaw != null && s.effectiveRaw > 100) parts.push(`raw ${Math.round(s.effectiveRaw)}`);
    const change = deltaByGroup[g.id].status === "paused" ? null : describeDeltaStatus(deltaByGroup[g.id]);
    if (change) parts.push(`${change}${deltaByGroup[g.id].delta != null ? ` vs ${TREND_WINDOW_DAYS}d ago` : ""}`);
    if (s.lastTrainedDateKey) {
      parts.push(`last trained ${s.lastTrainedDateKey}${s.daysStale != null ? ` (${s.daysStale}d ago)` : ""}`);
    } else {
      parts.push("no direct (primary) work logged");
    }
    if (s.pausedRestricted) parts.push("PAUSED (restricted)");
    else if (s.isStale) parts.push("STALE");
    if (s.scoringBasis === "reps-time") {
      parts.push("scored by reps/time & consistency (no load standard)");
    } else if (s.bestLift) {
      parts.push(`best: ${s.bestLift.exerciseName} ~${Math.round(s.bestLift.e1RM)} lb e1RM`);
    }
    lines.push(`- ${g.label}${golf}: ${parts.join(", ")}`);
  }

  if (result.needsMapping.length > 0) {
    lines.push("", `Not scored yet (unmapped exercises): ${result.needsMapping.join(", ")}`);
  }

  const restricted = listRestrictedExercises(overrides);
  if (restricted.length > 0) {
    lines.push(
      "",
      `PT-restricted (do not recommend): ${restricted.map((r) => (r.note ? `${r.name} (${r.note})` : r.name)).join(", ")}`
    );
  }
  const awaiting = listNeedsPtConfirmation(overrides);
  if (awaiting.length > 0) {
    lines.push(`Awaiting PT confirmation: ${awaiting.join(", ")}`);
  }

  const cutoff = shiftDateKey(asOfDateKey, -RECENT_DAYS);
  const recent = entries.filter((e) => e.dateKey > cutoff && e.dateKey <= asOfDateKey);
  const dateKeys = Array.from(new Set(recent.map((e) => e.dateKey))).sort().reverse();
  lines.push("", `Workouts, last ${RECENT_DAYS} days:`);
  if (dateKeys.length === 0) {
    lines.push("(none logged)");
  } else {
    for (const dateKey of dateKeys) {
      lines.push(
        "",
        formatWorkoutText(
          dateKey,
          recent.filter((e) => e.dateKey === dateKey).sort((a, b) => a.timestamp - b.timestamp),
          { bodyweightLb, overrides }
        )
      );
    }
  }
  return lines.join("\n").trimEnd();
}
