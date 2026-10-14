"use client";

import Modal from "./Modal";
import { MuscleGroupId, muscleGroup } from "@/lib/muscleTaxonomy";
import { MuscleStats, tierForScore } from "@/lib/muscleEngine";
import { formatShortDate } from "@/lib/date";

export default function MuscleDetailPanel({
  groupIds,
  statsByGroup,
  trendByGroup,
  onClose,
}: {
  groupIds: MuscleGroupId[];
  statsByGroup: Record<MuscleGroupId, MuscleStats>;
  trendByGroup?: Partial<Record<MuscleGroupId, number | null>>;
  onClose: () => void;
}) {
  const title = groupIds.map((id) => muscleGroup(id).label).join(" & ") || "Muscle";

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        {groupIds.map((id) => {
          const stats = statsByGroup[id];
          const def = muscleGroup(id);
          if (!stats.hasAnyData) {
            return (
              <div key={id}>
                {groupIds.length > 1 && <p className="mb-1 text-sm font-semibold text-neutral-200">{def.label}</p>}
                <p className="text-sm text-neutral-500">
                  No logs mapped to this muscle yet — unrated, not &quot;Needs Work&quot;.
                </p>
              </div>
            );
          }

          const tier = tierForScore(stats.effective!);
          const trend = trendByGroup?.[id];

          return (
            <div key={id} className="space-y-2 border-t border-neutral-800 pt-3 first:border-0 first:pt-0">
              {groupIds.length > 1 && <p className="text-sm font-semibold text-neutral-200">{def.label}</p>}

              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ background: tier.color, border: tier.id === "elite" ? "1px solid #525252" : undefined }}
                />
                <span className="text-sm font-medium text-neutral-100">{tier.label}</span>
                <span className="text-xs text-neutral-500">
                  {Math.round(stats.effective!)} / 100 effective
                  {stats.peak != null && Math.round(stats.peak) !== Math.round(stats.effective!) && (
                    <> &middot; peak {Math.round(stats.peak)}</>
                  )}
                </span>
              </div>

              {stats.peak != null && stats.effective != null && stats.peak > stats.effective && (
                <p className="text-xs text-neutral-500">
                  Decayed from peak — an estimate based on time since last meaningful training, not a new measurement.
                </p>
              )}

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-neutral-400">
                <div>
                  Last trained:{" "}
                  <span className="text-neutral-200">
                    {stats.lastTrainedDateKey ? formatShortDate(stats.lastTrainedDateKey) : "—"}
                  </span>
                </div>
                <div>
                  Days stale:{" "}
                  <span className={stats.isStale ? "text-amber-400" : "text-neutral-200"}>
                    {stats.daysStale ?? "—"}
                  </span>
                </div>
                {stats.bestLift && (
                  <div className="col-span-2">
                    Best lift:{" "}
                    <span className="text-neutral-200">
                      {stats.bestLift.exerciseName} — {Math.round(stats.bestLift.e1RM)} lb e1RM
                    </span>
                  </div>
                )}
                {trend != null && (
                  <div className="col-span-2">
                    Trend:{" "}
                    <span className={trend > 0 ? "text-emerald-400" : trend < 0 ? "text-red-400" : "text-neutral-200"}>
                      {trend > 0 ? "+" : ""}
                      {Math.round(trend)} pts over last 30 days
                    </span>
                  </div>
                )}
              </div>

              {stats.contributingExercises.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-neutral-500">Exercises feeding this score</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {stats.contributingExercises.map((name) => (
                      <span
                        key={name}
                        className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-300"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
