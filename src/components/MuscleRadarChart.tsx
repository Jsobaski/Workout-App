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

const SPOKE_DEGREES = 360 / MUSCLE_GROUPS.length;

interface TickProps {
  x?: number;
  y?: number;
  cx?: number;
  textAnchor?: "start" | "middle" | "end" | "inherit";
  payload?: { value: string };
}

// Labels like "Mid/Lower Chest" were clipped at the chart edge; split them at
// "/" onto two lines and keep them inside the SVG (the chart also has side margins).
function AngleTick({ x = 0, y = 0, textAnchor = "middle", payload }: TickProps) {
  const parts = (payload?.value ?? "").split("/");
  return (
    <text x={x} y={y} textAnchor={textAnchor} fill="#d4d4d4" fontSize={10}>
      {parts.map((part, i) => (
        <tspan key={i} x={x} dy={i === 0 ? (parts.length > 1 ? -4 : 0) : 11}>
          {i < parts.length - 1 ? `${part}/` : part}
        </tspan>
      ))}
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
    <ResponsiveContainer width="100%" height={380}>
      <RadarChart data={data} outerRadius="62%" margin={{ top: 24, right: 52, bottom: 24, left: 52 }}>
        <PolarGrid stroke="#404040" />
        <PolarAngleAxis dataKey="group" tick={<AngleTick />} />
        {/* Radius labels sit halfway between two spokes so they never collide with the muscle names. */}
        <PolarRadiusAxis
          angle={90 - SPOKE_DEGREES / 2}
          domain={[0, 100]}
          tickCount={3}
          tick={{ fill: "#737373", fontSize: 9 }}
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
