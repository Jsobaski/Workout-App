import { MuscleEngineResult, tierForScore } from "./muscleEngine";
import { MUSCLE_GROUPS, MuscleGroupId } from "./muscleTaxonomy";
import { WorkoutEntry } from "./types";
import { formatWorkoutText } from "./shareText";
import { shiftDateKey } from "./date";
import { MuscleDelta, describeDeltaStatus } from "./muscleComparison";
import {
  ExerciseSettingsData,
  listLimitedExercises,
  listNeedsConfirmation,
  listRestrictedExercises,
} from "./exerciseSettings";
import { MOVEMENT_PATTERNS } from "./exerciseMuscleMap";
import { DEFAULT_STALE_THRESHOLD_DAYS, TREND_WINDOW_DAYS } from "./muscleScoreConfig";
import { formatScore } from "./muscleScoreFormat";

const RECENT_DAYS = 14;

export function formatMuscleSummaryText(opts: {
  asOfDateKey: string;
  bodyweightLb: number | null;
  result: MuscleEngineResult;
  /** Like-for-like change vs TREND_WINDOW_DAYS ago (see compareSnapshots). */
  deltaByGroup: Record<MuscleGroupId, MuscleDelta>;
  entries: WorkoutEntry[];
  settings?: ExerciseSettingsData;
}): string {
  const { asOfDateKey, bodyweightLb, result, deltaByGroup, entries, settings } = opts;
  const lines = [
    `Muscle strength summary — as of ${asOfDateKey}`,
    bodyweightLb ? `Bodyweight: ${bodyweightLb} lb` : "Bodyweight: not set",
    "Scores are 0-100 (soft-capped, so 100 is hard to reach); 'raw' is the uncapped value. Tiers are decided on the unrounded score (shown with a decimal near a boundary): Needs Work (<20), Developing (20-39), Solid (40-59), Strong (60-79), Elite (80+).",
    `"Stale" = no meaningful primary-muscle training in ${DEFAULT_STALE_THRESHOLD_DAYS}+ days (score decays over time). Secondary credit never resets that clock.`,
    `Changes are ${TREND_WINDOW_DAYS}-day and like-for-like (same exercise); an equipment change is flagged instead of counted as strength.`,
    "",
    "Muscles:",
  ];

  const focus = new Set(settings?.focusMuscles ?? []);
  for (const g of MUSCLE_GROUPS) {
    const s = result.statsByGroup[g.id];
    const tag = focus.has(g.id) ? " [priority]" : "";
    if (!s.hasAnyData || s.effective == null) {
      lines.push(`- ${g.label}${tag}: no data logged`);
      continue;
    }
    const parts = [`${tierForScore(s.effective).label} (${formatScore(s.effective)})`];
    if (s.effectiveRaw != null) parts.push(`raw ${Math.round(s.effectiveRaw)}`);
    const change = deltaByGroup[g.id].status === "paused" ? null : describeDeltaStatus(deltaByGroup[g.id]);
    if (change) parts.push(`${change}${deltaByGroup[g.id].delta != null ? ` vs ${TREND_WINDOW_DAYS}d ago` : ""}`);
    if (s.lastTrainedDateKey) {
      parts.push(`last trained ${s.lastTrainedDateKey}${s.daysStale != null ? ` (${s.daysStale}d ago)` : ""}`);
    } else {
      parts.push("no direct (primary) work logged");
    }
    if (s.pausedRestricted) parts.push("PAUSED (every exercise for it is restricted)");
    else if (s.isStale) parts.push(s.lastPrimaryWasRestricted ? "STALE (last work was a restricted exercise — try an allowed one)" : "STALE");
    if (s.scoringBasis === "reps-time") {
      parts.push("scored by reps/time & consistency (no load standard)");
    } else if (s.bestLift) {
      parts.push(`best: ${s.bestLift.exerciseName} ~${Math.round(s.bestLift.e1RM)} lb e1RM`);
    }
    lines.push(`- ${g.label}${tag}: ${parts.join(", ")}`);
  }

  if (result.needsMapping.length > 0) {
    lines.push("", `Not scored yet (unmapped exercises): ${result.needsMapping.join(", ")}`);
  }

  // Restrictions, limits and flags are listed only when the user actually set some.
  const restrictedPatterns = MOVEMENT_PATTERNS.filter((p) => settings?.patterns[p.id]);
  const restricted = listRestrictedExercises(settings);
  const limits = listLimitedExercises(settings);
  const confirm = listNeedsConfirmation(settings);
  if (restrictedPatterns.length > 0 || restricted.length > 0 || limits.length > 0 || confirm.length > 0) lines.push("");
  if (restrictedPatterns.length > 0) {
    lines.push(
      `Restricted movement patterns: ${restrictedPatterns
        .map((p) => {
          const note = settings?.patterns[p.id]?.note;
          return note ? `${p.label} (${note})` : p.label;
        })
        .join(", ")}`
    );
  }
  if (restricted.length > 0) {
    lines.push(
      `Restricted exercises (do not recommend): ${restricted.map((r) => (r.note ? `${r.name} (${r.note})` : r.name)).join(", ")}`
    );
  }
  if (limits.length > 0) lines.push(`Limits (never exceed): ${limits.map((l) => `${l.name} ${l.limit}`).join(", ")}`);
  if (confirm.length > 0) lines.push(`Confirm before doing: ${confirm.join(", ")}`);

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
          { bodyweightLb, settings }
        )
      );
    }
  }
  return lines.join("\n").trimEnd();
}
