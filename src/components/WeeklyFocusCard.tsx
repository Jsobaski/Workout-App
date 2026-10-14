"use client";

import { MUSCLE_GROUPS, MuscleGroupId, muscleGroup } from "@/lib/muscleTaxonomy";
import { MuscleStats, tierForScore } from "@/lib/muscleEngine";
import { exercisesForMuscle } from "@/lib/exerciseMuscleMap";
import {
  FOCUS_GOLF_BOOST,
  FOCUS_STALENESS_BOOST_CAP,
  FOCUS_STALENESS_BOOST_PER_DAY,
  FOCUS_TOP_N,
} from "@/lib/muscleScoreConfig";

interface FocusItem {
  group: MuscleGroupId;
  reason: string;
  suggestions: string[];
}

function buildFocusList(statsByGroup: Record<MuscleGroupId, MuscleStats>): FocusItem[] {
  const ranked = MUSCLE_GROUPS.map((def) => {
    const stats = statsByGroup[def.id];
    const effectiveForRanking = stats.hasAnyData ? stats.effective! : 0;
    const stalenessBonus = stats.hasAnyData
      ? Math.min((stats.daysStale ?? 0) * FOCUS_STALENESS_BOOST_PER_DAY, FOCUS_STALENESS_BOOST_CAP)
      : FOCUS_STALENESS_BOOST_CAP; // never-trained counts as maximally stale
    const golfBoost = def.golfRelevant ? FOCUS_GOLF_BOOST : 0;
    const score = (100 - effectiveForRanking) + stalenessBonus + golfBoost;

    let reason: string;
    if (!stats.hasAnyData) {
      reason = "Never trained yet";
    } else if (stats.isStale) {
      const delta = stats.peak != null ? Math.round(stats.peak - stats.effective!) : 0;
      reason = delta > 0
        ? `Not trained in ${stats.daysStale} days, down ${delta} points`
        : `Not trained in ${stats.daysStale} days`;
    } else {
      reason = `Currently ${tierForScore(stats.effective!).label} — keep building`;
    }

    return { group: def.id, score, reason };
  });

  return ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, FOCUS_TOP_N)
    .map((r) => ({ group: r.group, reason: r.reason, suggestions: exercisesForMuscle(r.group, 3) }));
}

export default function WeeklyFocusCard({ statsByGroup }: { statsByGroup: Record<MuscleGroupId, MuscleStats> }) {
  const focusList = buildFocusList(statsByGroup);

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <h2 className="mb-3 text-sm font-semibold text-neutral-300">Focus This Week</h2>
      <div className="space-y-3">
        {focusList.map((item, i) => (
          <div key={item.group} className="flex items-start gap-3 rounded-lg bg-neutral-800/50 px-3 py-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-100">{muscleGroup(item.group).label}</p>
              <p className="text-xs text-neutral-500">{item.reason}</p>
              {item.suggestions.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {item.suggestions.map((name) => (
                    <span key={name} className="rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] text-neutral-400">
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
