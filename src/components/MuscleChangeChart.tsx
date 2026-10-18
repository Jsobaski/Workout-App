"use client";

import { useState } from "react";
import { MUSCLE_GROUPS, MuscleGroupId } from "@/lib/muscleTaxonomy";
import {
  MuscleDelta,
  describeDeltaStatus,
  explainDelta,
} from "@/lib/muscleComparison";
import { MuscleStats } from "@/lib/muscleEngine";
import { ExerciseSettingsData } from "@/lib/exerciseSettings";

// Horizontal diverging bar chart of After minus Before per muscle, sorted by
// change. Muscles with no comparable baseline (a new exercise or a different
// load basis leads, paused) are listed below the bars with a plain label instead
// of a bar, so a switch never reads as strength gained. Every bar is the
// muscle's real score change. Tapping a row opens an automatic reason: a real
// change in the lead lift, a new lift replacing the old one, decay from
// inactivity, or the lead lift now being restricted.
export default function MuscleChangeChart({
  deltas,
  before,
  after,
  settings,
}: {
  deltas: Record<MuscleGroupId, MuscleDelta>;
  before: Record<MuscleGroupId, MuscleStats>;
  after: Record<MuscleGroupId, MuscleStats>;
  settings?: ExerciseSettingsData;
}) {
  const [openId, setOpenId] = useState<MuscleGroupId | null>(null);
  const reasonRow = (id: MuscleGroupId) => {
    if (openId !== id) return null;
    const r = explainDelta(before[id], after[id], deltas[id], settings);
    return (
      <p className="ml-1 mt-1 rounded-md bg-neutral-900 px-2.5 py-1.5 text-[11px] leading-snug text-neutral-300">
        <span className="mr-1.5 rounded-full bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
          {r.label}
        </span>
        {r.text}
      </p>
    );
  };
  const rows = MUSCLE_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    d: deltas[g.id],
  }));
  const comparable = rows
    .filter((r) => r.d.delta != null)
    .sort((a, b) => (b.d.delta as number) - (a.d.delta as number));
  const notComparable = rows.filter(
    (r) =>
      r.d.delta == null &&
      r.d.status !== "no-data" &&
      r.d.status !== "incidental",
  );
  const maxAbs = Math.max(
    10,
    ...comparable.map((r) => Math.abs(r.d.delta as number)),
  );

  return (
    <div
      className="space-y-1.5"
      role="list"
      aria-label="Change per muscle, After minus Before"
    >
      {comparable.map(({ id, label, d }) => {
        const value = d.delta as number;
        const widthPct = (Math.abs(value) / maxAbs) * 50;
        const positive = value >= 0;
        return (
          <div key={id} role="listitem">
            <button
              type="button"
              aria-expanded={openId === id}
              onClick={() => setOpenId(openId === id ? null : id)}
              className="flex w-full items-center gap-2 text-left text-xs"
            >
              <span
                className="w-28 shrink-0 truncate text-neutral-300"
                title={
                  d.anchorExercise
                    ? `${label} — measured on ${d.anchorExercise}`
                    : label
                }
              >
                {label}
              </span>
              <div className="relative h-4 flex-1 rounded-sm bg-neutral-900">
                <div className="absolute inset-y-0 left-1/2 w-px bg-neutral-600" />
                <div
                  className={`absolute inset-y-0 rounded-sm ${positive ? "bg-emerald-500" : "bg-red-500"}`}
                  style={
                    positive
                      ? { left: "50%", width: `${widthPct}%` }
                      : { right: "50%", width: `${widthPct}%` }
                  }
                />
              </div>
              <span
                className={`w-12 shrink-0 text-right tabular-nums ${positive ? "text-emerald-400" : "text-red-400"}`}
              >
                {value > 0 ? "+" : ""}
                {Math.round(value)}
              </span>
            </button>
            {reasonRow(id)}
          </div>
        );
      })}
      {notComparable.length > 0 && (
        <div className="space-y-1 border-t border-neutral-800 pt-2">
          <p className="text-[11px] text-neutral-500">
            Not comparable (no bar shown):
          </p>
          {notComparable.map(({ id, label, d }) => (
            <div key={id}>
              <button
                type="button"
                aria-expanded={openId === id}
                onClick={() => setOpenId(openId === id ? null : id)}
                className="flex w-full items-center gap-2 text-left text-xs"
              >
                <span className="w-28 shrink-0 truncate text-neutral-400">
                  {label}
                </span>
                <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-400">
                  {describeDeltaStatus(d)}
                </span>
              </button>
              {reasonRow(id)}
            </div>
          ))}
        </div>
      )}
      <p className="pt-1 text-[11px] text-neutral-600">
        Points on the 0-100 scale: the change in the muscle&apos;s score, shown
        only when the same lift leads both snapshots. Tap a row for the reason.
      </p>
    </div>
  );
}
