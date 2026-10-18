"use client";

import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { MUSCLE_GROUPS, MuscleGroupId } from "@/lib/muscleTaxonomy";
import { MuscleStats } from "@/lib/muscleEngine";

interface TickProps {
  x?: number;
  y?: number;
  textAnchor?: "start" | "middle" | "end" | "inherit";
  payload?: { value: string };
}

// Break each muscle label into short lines (at "/" and spaces) so the labels
// stay narrow — that lets the radar itself fill almost the whole card instead
// of shrinking to make room for wide names like "Mid/Lower Chest".
function splitLabel(label: string): string[] {
  return label
    .replace(/\//g, "/ ")
    .split(" ")
    .filter(Boolean);
}

function AngleTick({ x = 0, y = 0, textAnchor = "middle", payload }: TickProps) {
  const parts = splitLabel(payload?.value ?? "");
  return (
    <text x={x} y={y} textAnchor={textAnchor} fill="#d4d4d4" fontSize={9}>
      {parts.map((part, i) => (
        <tspan key={i} x={x} dy={i === 0 ? -((parts.length - 1) * 5) : 10}>
          {part}
        </tspan>
      ))}
    </text>
  );
}

function RadiusTick(props: { x?: number | string; y?: number | string; payload?: { value?: unknown } }) {
  if (props.payload?.value !== 50) return <g />;
  return (
    <text x={props.x} y={props.y} fill="#737373" fontSize={9}>
      50
    </text>
  );
}

export default function MuscleRadarChart({
  before,
  after,
}: {
  before: Record<MuscleGroupId, MuscleStats>;
  after: Record<MuscleGroupId, MuscleStats>;
}) {
  const data = MUSCLE_GROUPS.map((g) => ({
    group: g.label,
    Before: before[g.id]?.effective ?? 0,
    After: after[g.id]?.effective ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <RadarChart data={data} outerRadius="100%" margin={{ top: 30, right: 44, bottom: 30, left: 44 }}>
        <PolarGrid stroke="#404040" />
        <PolarAngleAxis dataKey="group" tick={<AngleTick />} />
        {/* Rings at 25/50/75/100 (the outer ring marks 100), but only "50" is labeled, halfway between two spokes, so axis numbers never collide with the muscle names. */}
        <PolarRadiusAxis
          angle={90 - 360 / MUSCLE_GROUPS.length / 2}
          domain={[0, 100]}
          ticks={[25, 50, 75, 100]}
          tick={RadiusTick}
          axisLine={false}
        />
        <Radar
          name="Before"
          dataKey="Before"
          stroke="#fbbf24"
          strokeWidth={2}
          strokeDasharray="5 4"
          fill="#fbbf24"
          fillOpacity={0.06}
        />
        <Radar name="After" dataKey="After" stroke="#34d399" strokeWidth={2} fill="#34d399" fillOpacity={0.3} />
        <Tooltip contentStyle={{ background: "#171717", border: "1px solid #333" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
