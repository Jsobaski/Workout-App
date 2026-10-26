"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MUSCLE_GROUPS, MuscleGroupId } from "@/lib/muscleTaxonomy";
import { buildMuscleTrends, trendDirection } from "@/lib/muscleTrends";
import { ExerciseSettingsData } from "@/lib/exerciseSettings";
import { formatShortDate, todayKey } from "@/lib/date";
import { WorkoutEntry } from "@/lib/types";
import { MUSCLE_TIERS } from "@/lib/muscleScoreConfig";
import { formatScore } from "@/lib/muscleScoreFormat";

const RANGES = [
  { label: "12 weeks", weeks: 12, stepDays: 7 },
  { label: "6 months", weeks: 26, stepDays: 14 },
] as const;

const ARROW = { rising: "▲", steady: "▬", falling: "▼" } as const;
const COLOR = { rising: "text-emerald-400", steady: "text-neutral-400", falling: "text-red-400" } as const;

function Sparkline({ values, rising }: { values: (number | null)[]; rising: boolean | null }) {
  const w = 96;
  const h = 28;
  const pts = values.map((v, i) => (v == null ? null : ([(i / Math.max(1, values.length - 1)) * w, h - 2 - (Math.min(100, Math.max(0, v)) / 100) * (h - 4)] as const)));
  const segments: string[] = [];
  let current: string[] = [];
  for (const p of pts) {
    if (p) current.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`);
    else if (current.length) {
      segments.push(current.join(" "));
      current = [];
    }
  }
  if (current.length) segments.push(current.join(" "));
  const stroke = rising == null ? "#737373" : rising ? "#34d399" : "#f87171";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0">
      {segments.map((pointsAttr, i) => (
        <polyline key={i} points={pointsAttr} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      ))}
    </svg>
  );
}

// Muscle score over time: a sparkline and slope per muscle, and a full chart for the one you tap.
export default function MuscleTrendLines({
  entries,
  bodyweightLb,
  settings,
}: {
  entries: WorkoutEntry[];
  bodyweightLb: number | null;
  settings: ExerciseSettingsData;
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[0]);
  const [openId, setOpenId] = useState<MuscleGroupId | null>(null);
  const today = todayKey();

  const trends = useMemo(
    () => buildMuscleTrends(entries, bodyweightLb, today, settings, { weeks: range.weeks, stepDays: range.stepDays }),
    [entries, bodyweightLb, today, settings, range]
  );

  const rows = MUSCLE_GROUPS.filter((g) => trends.series[g.id].some((v) => v != null));
  if (rows.length === 0) return null;

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-300">Score over time</h2>
        <div className="flex gap-1 text-xs">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r)}
              className={`rounded-md px-2.5 py-1 font-medium ${range.label === r.label ? "bg-emerald-600 text-white" : "bg-neutral-800 text-neutral-400"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <ul className="divide-y divide-neutral-800">
        {rows.map(({ id, label }) => {
          const values = trends.series[id];
          const latest = [...values].reverse().find((v) => v != null) ?? null;
          const slope = trends.slopePerWeek[id];
          const dir = trendDirection(slope);
          const open = openId === id;
          return (
            <li key={id}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : id)}
                className="flex w-full items-center gap-3 py-2 text-left text-sm"
              >
                <span className="min-w-0 flex-1 truncate text-neutral-200">{label}</span>
                <Sparkline values={values} rising={dir == null || dir === "steady" ? null : dir === "rising"} />
                <span className="w-9 shrink-0 text-right tabular-nums text-neutral-300">{latest == null ? "–" : formatScore(latest)}</span>
                <span className={`w-16 shrink-0 text-right text-xs tabular-nums ${dir ? COLOR[dir] : "text-neutral-600"}`}>
                  {dir && slope != null ? `${ARROW[dir]} ${slope > 0 ? "+" : ""}${slope.toFixed(1)}/wk` : "–"}
                </span>
              </button>
              {open && (
                <div className="pb-3">
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={trends.dates.map((d, i) => ({ label: formatShortDate(d), score: values[i] == null ? null : Math.round(values[i]! * 10) / 10 }))}>
                      <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
                      <XAxis dataKey="label" stroke="#737373" fontSize={10} interval="preserveStartEnd" minTickGap={24} />
                      <YAxis stroke="#737373" fontSize={10} domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} width={28} />
                      {MUSCLE_TIERS.filter((t) => t.minScore > 0).map((t) => (
                        <ReferenceLine key={t.id} y={t.minScore} stroke={t.color} strokeOpacity={0.35} strokeDasharray="4 4" />
                      ))}
                      <Tooltip contentStyle={{ background: "#171717", border: "1px solid #333" }} />
                      <Line type="monotone" dataKey="score" stroke="#34d399" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                  <p className="text-[11px] text-neutral-500">Dashed lines mark the tier boundaries (20, 40, 60, 80).</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-neutral-600">Slope is the average change in points per week over the period.</p>
    </section>
  );
}
