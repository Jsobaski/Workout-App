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
    "Scores are 0-100 (soft-capped, so 100 is hard to reach); 'raw' is the uncapped value, listed for every muscle for calibration review. Tiers: Needs Work (<20), Developing (20-39), Solid (40-59), Strong (60-79), Elite (80+).",
    `"Stale" = no meaningful primary-muscle training in ${DEFAULT_STALE_THRESHOLD_DAYS}+ days (score decays over time). Secondary credit never resets that clock.`,
    `"Paused" = every exercise for that muscle is restricted, so decay is on hold; if an allowed alternative exists the muscle just decays and the summary says what to try. Changes are ${TREND_WINDOW_DAYS}-day, like-for-like (same exercise); an equipment change is flagged instead of counted as strength.`,
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
    if (s.effectiveRaw != null) parts.push(`raw ${Math.round(s.effectiveRaw)}`);
    const change = deltaByGroup[g.id].status === "paused" ? null : describeDeltaStatus(deltaByGroup[g.id]);
    if (change) parts.push(`${change}${deltaByGroup[g.id].delta != null ? ` vs ${TREND_WINDOW_DAYS}d ago` : ""}`);
    if (s.lastTrainedDateKey) {
      parts.push(`last trained ${s.lastTrainedDateKey}${s.daysStale != null ? ` (${s.daysStale}d ago)` : ""}`);
    } else {
      parts.push("no direct (primary) work logged");
    }
    if (s.pausedRestricted) parts.push("PAUSED (all exercises restricted)");
    else if (s.isStale) parts.push(s.lastPrimaryWasRestricted ? "STALE (last work was a restricted exercise — try an allowed one)" : "STALE");
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

  if (result.calibrations.length > 0) {
    lines.push("", "Machine calibration (scaled to land within 15 points of the free-weight anchor):");
    for (const c of result.calibrations) {
      lines.push(
        `- ${c.exercise} vs ${c.anchor}: machine ${Math.round(c.machineScore)}, anchor ${Math.round(c.anchorScore)} -> ${
          c.adjusted
            ? `scaled x${c.multiplier.toFixed(2)} (now ${Math.round(c.calibratedScore)})`
            : "within tolerance, multiplier x1.00"
        }`
      );
    }
  }

  const restricted = listRestrictedExercises(overrides);
  const ptRestricted = restricted.filter((r) => r.kind === "pt");
  const selfRestricted = restricted.filter((r) => r.kind === "self");
  if (ptRestricted.length > 0) {
    lines.push(
      "",
      `PT-restricted (do not recommend): ${ptRestricted.map((r) => (r.note ? `${r.name} (${r.note})` : r.name)).join(", ")}`
    );
  }
  if (selfRestricted.length > 0) {
    lines.push(`Self-restricted (do not recommend): ${selfRestricted.map((r) => r.name).join(", ")}`);
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
