"use client";

import { MuscleGroupId, muscleGroup } from "@/lib/muscleTaxonomy";
import { MuscleStats } from "@/lib/muscleEngine";
import { MuscleDelta } from "@/lib/muscleComparison";
import { buildFocusList } from "@/lib/muscleFocus";
import type { ExerciseSettingsOverrides } from "@/lib/exerciseSettings";

export default function WeeklyFocusCard({
  statsByGroup,
  deltas,
  overrides,
}: {
  statsByGroup: Record<MuscleGroupId, MuscleStats>;
  deltas?: Record<MuscleGroupId, MuscleDelta>;
  overrides?: ExerciseSettingsOverrides;
}) {
  const focusList = buildFocusList(statsByGroup, deltas, overrides);

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
              {item.suggestions.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {item.suggestions.map((name) => (
                    <span key={name} className="rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] text-neutral-400">
                      {name}
                      {item.needsConfirmation.includes(name) && <span className="text-amber-400"> (confirm w/ PT)</span>}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-[11px] text-amber-400">
                  No unrestricted exercises available — check with your PT.
                </p>
              )}
              {item.skippedRestricted.length > 0 && (
                <p className="mt-1.5 text-[11px] text-sky-300/80">
                  Skipped (restricted):{" "}
                  {item.skippedRestricted.map((r) => r.name).join(", ")}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
