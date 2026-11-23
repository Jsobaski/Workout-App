import { ExerciseScoreSnapshot, MuscleEngineResult, MuscleStats, tierForScore } from "./muscleEngine";
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
import {
  BODYWEIGHT_CLAMP_LB,
  DECAY_FLOOR_RATIO,
  DECAY_GRACE_DAYS,
  DEFAULT_STALE_THRESHOLD_DAYS,
  E1RM_FULL_CREDIT_REPS,
  E1RM_MAX_CREDITED_REPS,
  E1RM_TAPER_CREDIT,
  PROVISIONAL_MIN_SESSIONS,
  REFERENCE_BODYWEIGHT_LB,
  STANDARDS_VERSION,
  TREND_WINDOW_DAYS,
  VOLUME_BONUS_WINDOW_DAYS,
} from "./muscleScoreConfig";
import { formatScore } from "./muscleScoreFormat";

const RECENT_DAYS = 14;

const shortDate = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** The rules behind the numbers, built from the live tunables so the export can't drift from the scoring. */
function scoringRulesLines(): string[] {
  const taperReps = `${E1RM_FULL_CREDIT_REPS + 1}-${E1RM_MAX_CREDITED_REPS}`;
  return [
    `Scoring rules (standards version ${STANDARDS_VERSION}):`,
    `- e1RM = Epley (weight x (1 + reps/30)) on credited reps: reps 1-${E1RM_FULL_CREDIT_REPS} count in full, reps ${taperReps} count ${Math.round(E1RM_TAPER_CREDIT * 100)}% each, reps above ${E1RM_MAX_CREDITED_REPS} add nothing. E.g. 12 reps count as ${E1RM_FULL_CREDIT_REPS + (E1RM_MAX_CREDITED_REPS - E1RM_FULL_CREDIT_REPS) * E1RM_TAPER_CREDIT}.`,
    `- Each lift's e1RM is compared with strength-standard tables (multiples of bodyweight for a ${REFERENCE_BODYWEIGHT_LB} lb lifter, scaled by bodyweight^2/3, bodyweight clamped to ${BODYWEIGHT_CLAMP_LB[0]}-${BODYWEIGHT_CLAMP_LB[1]} lb); a muscle's score comes from its best primary lift plus capped secondary credit and a small consistency bonus (${VOLUME_BONUS_WINDOW_DAYS}-day window).`,
    `- Decay: scores hold for ${DECAY_GRACE_DAYS} days after the last meaningful primary work, then fade toward a floor of ${Math.round(DECAY_FLOOR_RATIO * 100)}% of the peak. Muscles scored only by consistency (e.g. planks) use the same rule on their best consistency reached. Decay never counts as new work or resets the stale clock.`,
    "- 'best' is the lift with the highest peak for that muscle, with when it was last done. If a different lift now leads because the peak lift has decayed, both are named.",
    "- Workout totals show weight lifted ('loaded') separately from bodyweight credit (an estimate of body load on bodyweight-logged sets).",
  ];
}

/**
 * "best: X ~N lb e1RM (last done D)". When the lift with the highest peak has decayed below another primary lift's
 * current standing, the recent lift is named as the leader and the older one is explained instead of silently dropped.
 */
function describeBestLift(s: MuscleStats): string {
  const best = s.bestLift!;
  const primaries = s.exerciseScores.filter((e) => e.weight >= 1);
  const peakLift = primaries.find((e) => e.key === best.key);
  const leader = primaries.reduce<ExerciseScoreSnapshot | null>(
    (top, e) => (top == null || e.effectiveScore > top.effectiveScore ? e : top),
    null
  );
  const last = (e: ExerciseScoreSnapshot | undefined) => (e?.lastDateKey ? ` last done ${shortDate(e.lastDateKey)}` : "");
  if (peakLift && leader && leader.key !== peakLift.key && leader.effectiveScore > peakLift.effectiveScore + 0.05) {
    return `best: ${leader.name} ~${Math.round(leader.e1RM)} lb e1RM (${last(leader).trim()}); ${peakLift.name}${last(peakLift)}, decayed`;
  }
  const when = last(peakLift).trim();
  return `best: ${best.exerciseName} ~${Math.round(best.e1RM)} lb e1RM${when ? ` (${when})` : ""}`;
}

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
    `Changes are ${TREND_WINDOW_DAYS}-day and only shown when the same lift (similar exercises on the same kind of equipment count as one lift) leads both snapshots; otherwise it says "new exercise, no comparison". A score from a lift logged on fewer than ${PROVISIONAL_MIN_SESSIONS} sessions is marked PROVISIONAL and its tier is held one level below the computed one.`,
    "",
    ...scoringRulesLines(),
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
    if (s.provisional) parts.push(`PROVISIONAL: ${s.provisionalSessions ?? 0} of ${PROVISIONAL_MIN_SESSIONS} sessions, tier held one level below computed${s.uncappedEffective != null ? ` (${formatScore(s.uncappedEffective)})` : ""}`);
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
      parts.push(describeBestLift(s));
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
