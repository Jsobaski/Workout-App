import { MuscleEngineResult, tierForScore } from "./muscleEngine";
import { MUSCLE_GROUPS, MuscleGroupId } from "./muscleTaxonomy";
import { WorkoutEntry } from "./types";
import { formatWorkoutText } from "./shareText";
import { shiftDateKey } from "./date";

const RECENT_DAYS = 14;

export function formatMuscleSummaryText(opts: {
  asOfDateKey: string;
  bodyweightLb: number | null;
  result: MuscleEngineResult;
  trendByGroup: Partial<Record<MuscleGroupId, number | null>>;
  entries: WorkoutEntry[];
}): string {
  const { asOfDateKey, bodyweightLb, result, trendByGroup, entries } = opts;
  const lines = [
    `Muscle strength summary — as of ${asOfDateKey}`,
    bodyweightLb ? `Bodyweight: ${bodyweightLb} lb` : "Bodyweight: not set",
    "Scores are 0-100. Tiers: Needs Work (<20), Developing (20-39), Solid (40-59), Strong (60-79), Elite (80+).",
    `"Stale" = no meaningful training in 10+ days (score decays over time).`,
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
    const trend = trendByGroup[g.id];
    if (trend != null) {
      const rounded = Math.round(trend);
      parts.push(`${rounded > 0 ? "+" : ""}${rounded} vs 30 days ago`);
    }
    if (s.lastTrainedDateKey) {
      parts.push(`last trained ${s.lastTrainedDateKey}${s.daysStale != null ? ` (${s.daysStale}d ago)` : ""}`);
    }
    if (s.isStale) parts.push("STALE");
    if (s.bestLift) {
      parts.push(`best: ${s.bestLift.exerciseName} ~${Math.round(s.bestLift.e1RM)} lb e1RM`);
    }
    lines.push(`- ${g.label}${golf}: ${parts.join(", ")}`);
  }

  if (result.needsMapping.length > 0) {
    lines.push("", `Not scored yet (unmapped exercises): ${result.needsMapping.join(", ")}`);
  }

  const cutoff = shiftDateKey(asOfDateKey, -RECENT_DAYS);
  const recent = entries.filter((e) => e.dateKey > cutoff && e.dateKey <= asOfDateKey);
  const dateKeys = Array.from(new Set(recent.map((e) => e.dateKey))).sort().reverse();
  lines.push("", `Workouts, last ${RECENT_DAYS} days:`);
  if (dateKeys.length === 0) {
    lines.push("(none logged)");
  } else {
    for (const dateKey of dateKeys) {
      lines.push("", formatWorkoutText(dateKey, recent.filter((e) => e.dateKey === dateKey).sort((a, b) => a.timestamp - b.timestamp)));
    }
  }
  return lines.join("\n").trimEnd();
}
