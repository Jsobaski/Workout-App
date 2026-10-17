"use client";

import { MUSCLE_GROUPS, MuscleGroupId } from "@/lib/muscleTaxonomy";
import { MuscleDelta, describeDeltaStatus } from "@/lib/muscleComparison";

// Horizontal diverging bar chart of After minus Before per muscle, sorted by
// change. Muscles whose change isn't a like-for-like comparison (different
// exercise/equipment, new, paused) are listed below the bars with a plain label
// instead of a bar, so equipment swaps never read as strength gained.
export default function MuscleChangeChart({ deltas }: { deltas: Record<MuscleGroupId, MuscleDelta> }) {
  const rows = MUSCLE_GROUPS.map((g) => ({ id: g.id, label: g.label, d: deltas[g.id] }));
  const comparable = rows
    .filter((r) => r.d.delta != null)
    .sort((a, b) => (b.d.delta as number) - (a.d.delta as number));
  const notComparable = rows.filter((r) => r.d.delta == null && r.d.status !== "no-data" && r.d.status !== "incidental");
  const maxAbs = Math.max(10, ...comparable.map((r) => Math.abs(r.d.delta as number)));

  return (
    <div className="space-y-1.5" role="list" aria-label="Change per muscle, After minus Before">
      {comparable.map(({ id, label, d }) => {
        const value = d.delta as number;
        const widthPct = (Math.abs(value) / maxAbs) * 50;
        const positive = value >= 0;
        return (
          <div key={id} role="listitem" className="flex items-center gap-2 text-xs">
            <span className="w-28 shrink-0 truncate text-neutral-300" title={d.anchorExercise ? `${label} — measured on ${d.anchorExercise}` : label}>
              {label}
            </span>
            <div className="relative h-4 flex-1 rounded-sm bg-neutral-900">
              <div className="absolute inset-y-0 left-1/2 w-px bg-neutral-600" />
              <div
                className={`absolute inset-y-0 rounded-sm ${positive ? "bg-emerald-500" : "bg-red-500"}`}
                style={positive ? { left: "50%", width: `${widthPct}%` } : { right: "50%", width: `${widthPct}%` }}
              />
            </div>
            <span className={`w-12 shrink-0 text-right tabular-nums ${positive ? "text-emerald-400" : "text-red-400"}`}>
              {value > 0 ? "+" : ""}
              {Math.round(value)}
            </span>
            {d.equipmentChanged && (
              <span
                className="shrink-0 rounded-full bg-amber-950 px-1.5 py-0.5 text-[10px] text-amber-300"
                title="The exercise driving this muscle's score changed — the bar only reflects the shared exercise."
              >
                equip. changed
              </span>
            )}
          </div>
        );
      })}
      {notComparable.length > 0 && (
        <div className="space-y-1 border-t border-neutral-800 pt-2">
          <p className="text-[11px] text-neutral-500">Not comparable (no bar shown):</p>
          {notComparable.map(({ id, label, d }) => (
            <div key={id} className="flex items-center gap-2 text-xs">
              <span className="w-28 shrink-0 truncate text-neutral-400">{label}</span>
              <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-400">
                {describeDeltaStatus(d)}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="pt-1 text-[11px] text-neutral-600">
        Points on the 0-100 scale, measured on the same exercise in both snapshots.
      </p>
    </div>
  );
}
