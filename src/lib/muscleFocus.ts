// "Focus This Week" ranking. Pure so the ordering rules are unit-tested.
//
// How the order is chosen: every muscle gets
//   priority = (100 - effective score) + staleness bonus + golf bonus
// where the staleness bonus is FOCUS_STALENESS_BOOST_PER_DAY per day since last
// primary work (capped at FOCUS_STALENESS_BOOST_CAP) and the golf bonus is
// FOCUS_GOLF_BOOST. The score deficit (0-100) dominates; staleness and golf are
// capped tie-breakers, so a very low-scoring muscle (e.g. quads at 11) can't be
// buried below a merely stale one. Muscles with paused (restricted) decay get
// no staleness bonus; never-trained muscles count as maximally stale. The top
// FOCUS_TOP_N are returned, each with unrestricted exercise suggestions and a
// list of exercises skipped because they're PT-restricted.
import { MUSCLE_GROUPS, MuscleGroupId } from "./muscleTaxonomy";
import { MuscleStats, tierForScore } from "./muscleEngine";
import { suggestExercisesForMuscle } from "./exerciseMuscleMap";
import { ExerciseSettingsOverrides } from "./exerciseSettings";
import { MuscleDelta, describeDeltaStatus } from "./muscleComparison";
import {
  FOCUS_GOLF_BOOST,
  FOCUS_STALENESS_BOOST_CAP,
  FOCUS_STALENESS_BOOST_PER_DAY,
  FOCUS_TOP_N,
  TREND_WINDOW_DAYS,
} from "./muscleScoreConfig";

export interface FocusItem {
  group: MuscleGroupId;
  priority: number;
  reason: string;
  suggestions: string[];
  skippedRestricted: { name: string; note?: string }[];
  paused: boolean;
}

export function buildFocusList(
  statsByGroup: Record<MuscleGroupId, MuscleStats>,
  deltas?: Record<MuscleGroupId, MuscleDelta>,
  overrides?: ExerciseSettingsOverrides,
  topN: number = FOCUS_TOP_N
): FocusItem[] {
  const ranked = MUSCLE_GROUPS.map((def) => {
    const stats = statsByGroup[def.id];
    const effective = stats.hasAnyData ? stats.effective ?? 0 : 0;
    const stalenessBonus = !stats.hasAnyData
      ? FOCUS_STALENESS_BOOST_CAP // never-trained counts as maximally stale
      : stats.pausedRestricted
        ? 0
        : Math.min((stats.daysStale ?? FOCUS_STALENESS_BOOST_CAP / FOCUS_STALENESS_BOOST_PER_DAY) * FOCUS_STALENESS_BOOST_PER_DAY, FOCUS_STALENESS_BOOST_CAP);
    const golfBonus = def.golfRelevant ? FOCUS_GOLF_BOOST : 0;
    const priority = 100 - effective + stalenessBonus + golfBonus;

    let reason: string;
    if (!stats.hasAnyData) {
      reason = "Never trained yet";
    } else if (stats.pausedRestricted) {
      reason = "Paused (restricted) — last primary work was a PT-restricted exercise";
    } else if (stats.daysStale == null) {
      reason = "No direct (primary) work logged — only incidental credit";
    } else if (stats.isStale) {
      reason = `Not trained in ${stats.daysStale} ${stats.daysStale === 1 ? "day" : "days"}`;
    } else {
      reason = `Currently ${tierForScore(stats.effective!).label} — keep building`;
    }
    // One window everywhere (TREND_WINDOW_DAYS), always labeled, and the same
    // like-for-like figure the detail panel and copied summary show.
    const delta = deltas?.[def.id];
    const deltaText = delta ? describeDeltaStatus(delta) : null;
    if (deltaText && delta && delta.status !== "paused") {
      const numeric = delta.delta != null;
      reason += numeric ? ` · ${deltaText} vs ${TREND_WINDOW_DAYS} days ago` : ` · ${deltaText}`;
    }

    return { group: def.id, priority, reason, paused: stats.pausedRestricted };
  });

  return ranked
    .sort((a, b) => b.priority - a.priority)
    .slice(0, topN)
    .map((r) => {
      const { suggestions, skippedRestricted } = suggestExercisesForMuscle(r.group, 3, overrides);
      return { ...r, suggestions, skippedRestricted };
    });
}
