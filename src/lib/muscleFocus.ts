// "Focus This Week" ranking. Pure so the ordering rules are unit-tested.
//
// How the order is chosen: every muscle gets
//   priority = (100 - effective score) + staleness bonus + priority-tag bonus
// where the staleness bonus is FOCUS_STALENESS_BOOST_PER_DAY per day since last
// primary work (capped at FOCUS_STALENESS_BOOST_CAP) and the priority bonus is
// FOCUS_PRIORITY_BOOST, applied ONLY to muscles the user tagged as priorities in
// Settings (default: none, so no bonus at all). The score deficit (0-100)
// dominates; staleness and the priority tag are capped tie-breakers, so a very
// low-scoring muscle (e.g. quads at 11) can't be buried below a merely stale one. Muscles with paused (restricted) decay get
// no staleness bonus; never-trained muscles count as maximally stale. The top
// FOCUS_TOP_N are returned, each with unrestricted exercise suggestions and a
// list of exercises skipped because they're restricted.
import { MUSCLE_GROUPS, MuscleGroupId } from "./muscleTaxonomy";
import { MuscleStats, tierForScore } from "./muscleEngine";
import { SuggestionItem, suggestExercisesForMuscle } from "./exerciseSuggestions";
import { ExerciseSettingsData } from "./exerciseSettings";
import { MuscleDelta, describeDeltaStatus } from "./muscleComparison";
import {
  FOCUS_PRIORITY_BOOST,
  FOCUS_STALENESS_BOOST_CAP,
  FOCUS_STALENESS_BOOST_PER_DAY,
  FOCUS_TOP_N,
  TREND_WINDOW_DAYS,
} from "./muscleScoreConfig";

export interface FocusItem {
  group: MuscleGroupId;
  priority: number;
  reason: string;
  suggestions: SuggestionItem[];
  skippedRestricted: { name: string; note?: string }[];
  paused: boolean;
}

export function buildFocusList(
  statsByGroup: Record<MuscleGroupId, MuscleStats>,
  deltas?: Record<MuscleGroupId, MuscleDelta>,
  settings?: ExerciseSettingsData,
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
    const priorityBonus = settings?.focusMuscles.includes(def.id) ? FOCUS_PRIORITY_BOOST : 0;
    const priority = 100 - effective + stalenessBonus + priorityBonus;
    return { group: def.id, stats, priority };
  });

  return ranked
    .sort((a, b) => b.priority - a.priority)
    .slice(0, topN)
    .map(({ group, stats, priority }) => {
      const { items: suggestions, skippedRestricted } = suggestExercisesForMuscle(group, 3, settings);

      let reason: string;
      if (!stats.hasAnyData) {
        reason = "Never trained yet";
      } else if (stats.pausedRestricted) {
        reason = "Paused (restricted) — every exercise for this muscle is restricted";
      } else if (stats.lastPrimaryWasRestricted && suggestions.length > 0) {
        // Last direct work was a restricted exercise but allowed ones exist:
        // not paused — say what to do instead.
        reason = `Needs work — last trained via a restricted exercise; try: ${suggestions.map((i) => i.name).join(", ")}`;
      } else if (stats.daysStale == null) {
        reason = "No direct (primary) work logged — only incidental credit";
      } else if (stats.isStale) {
        reason = `Not trained in ${stats.daysStale} ${stats.daysStale === 1 ? "day" : "days"}`;
      } else {
        reason = `Currently ${tierForScore(stats.effective!).label} — keep building`;
      }

      // One window everywhere (TREND_WINDOW_DAYS), always labeled, and the same
      // like-for-like figure the detail panel and copied summary show.
      const delta = deltas?.[group];
      const deltaText = delta ? describeDeltaStatus(delta) : null;
      if (deltaText && delta && delta.status !== "paused" && delta.status !== "incidental") {
        reason += delta.delta != null ? ` · ${deltaText} vs ${TREND_WINDOW_DAYS} days ago` : ` · ${deltaText}`;
      }

      return { group, priority, reason, suggestions, skippedRestricted, paused: stats.pausedRestricted };
    });
}
