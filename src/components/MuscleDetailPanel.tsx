"use client";

import Modal from "./Modal";
import { MuscleGroupId, muscleGroup } from "@/lib/muscleTaxonomy";
import { MuscleStats, tierForScore } from "@/lib/muscleEngine";
import { formatShortDate } from "@/lib/date";
import { MuscleDelta, describeDeltaStatus } from "@/lib/muscleComparison";
import { formatScore } from "@/lib/muscleScoreFormat";
import { PROVISIONAL_MIN_SESSIONS, TREND_WINDOW_DAYS } from "@/lib/muscleScoreConfig";

export default function MuscleDetailPanel({
  groupIds,
  statsByGroup,
  deltaByGroup,
  onClose,
}: {
  groupIds: MuscleGroupId[];
  statsByGroup: Record<MuscleGroupId, MuscleStats>;
  deltaByGroup?: Record<MuscleGroupId, MuscleDelta>;
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
          const delta = deltaByGroup?.[id];

          return (
            <div key={id} className="space-y-2 border-t border-neutral-800 pt-3 first:border-0 first:pt-0">
              {groupIds.length > 1 && <p className="text-sm font-semibold text-neutral-200">{def.label}</p>}

              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ background: tier.color, border: tier.outline ? `1.5px solid ${tier.outline}` : undefined }}
                />
                <span className="text-sm font-medium text-neutral-100">
                  {tier.label}
                  {stats.provisional && <span className="ml-1.5 rounded-full bg-violet-900 px-2 py-0.5 text-[10px] font-medium text-violet-200">provisional</span>}
                </span>
                <span className="text-xs text-neutral-500">
                  {formatScore(stats.effective!)} / 100 effective
                  {stats.peak != null && formatScore(stats.peak) !== formatScore(stats.effective!) && (
                    <> &middot; peak {formatScore(stats.peak)}</>
                  )}
                  {stats.effectiveRaw != null && stats.effectiveRaw > 100 && (
                    <> &middot; raw {Math.round(stats.effectiveRaw)} (uncapped)</>
                  )}
                </span>
              </div>

              {stats.provisional && (
                <p className="rounded-md bg-violet-950/60 px-2 py-1 text-xs text-violet-200">
                  Provisional — this score comes from a lift logged on {stats.provisionalSessions ?? 0} of{" "}
                  {PROVISIONAL_MIN_SESSIONS} sessions, so the tier is held one level below the computed one
                  {stats.uncappedEffective != null && <> ({formatScore(stats.uncappedEffective)})</>} until the third
                  session. Similar lifts on the same equipment count toward those sessions.
                </p>
              )}
              {stats.pausedRestricted && (
                <p className="rounded-md bg-sky-950/60 px-2 py-1 text-xs text-sky-300">
                  Paused (restricted) — every exercise for this muscle is restricted, so decay and staleness are on
                  hold rather than dropping.
                </p>
              )}
              {!stats.pausedRestricted && stats.lastPrimaryWasRestricted && (
                <p className="rounded-md bg-amber-950/50 px-2 py-1 text-xs text-amber-300">
                  Last direct work was a restricted exercise, but allowed alternatives exist — this muscle is decaying
                  normally. Try one of the suggestions in Focus This Week.
                </p>
              )}
              {stats.scoringBasis === "reps-time" && (
                <p className="text-xs text-neutral-500">
                  Scored by reps/time and training consistency — no load standard applies to this muscle&apos;s work.
                </p>
              )}
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
                {delta && describeDeltaStatus(delta) && (
                  <div className="col-span-2">
                    Change vs {TREND_WINDOW_DAYS} days ago:{" "}
                    <span
                      className={
                        delta.delta == null
                          ? "text-neutral-300"
                          : delta.delta > 0
                            ? "text-emerald-400"
                            : delta.delta < 0
                              ? "text-red-400"
                              : "text-neutral-200"
                      }
                    >
                      {describeDeltaStatus(delta)}
                    </span>
                    {delta.anchorExercise && <span className="text-neutral-500"> (on {delta.anchorExercise})</span>}
                  </div>
                )}
                {stats.lastSecondaryDateKey && (
                  <div className="col-span-2 text-neutral-500">
                    Incidental (secondary) work: {formatShortDate(stats.lastSecondaryDateKey)} — doesn&apos;t count as
                    training this muscle directly.
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
