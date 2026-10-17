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

// Wrap each muscle label onto at most two lines (at "/" or the first space) so
// long names like "Mid/Lower Chest" and "Side/Rear Delts" stay narrow instead
// of clipping at the chart edge or colliding with their neighbours.
function splitLabel(label: string): string[] {
  const slash = label.indexOf("/");
  if (slash > 0) return [label.slice(0, slash + 1), label.slice(slash + 1)];
  const space = label.indexOf(" ");
  if (space > 0) return [label.slice(0, space), label.slice(space + 1)];
  return [label];
}

function AngleTick({ x = 0, y = 0, textAnchor = "middle", payload }: TickProps) {
  const parts = splitLabel(payload?.value ?? "");
  return (
    <text x={x} y={y} textAnchor={textAnchor} fill="#d4d4d4" fontSize={9}>
      {parts.map((part, i) => (
        <tspan key={i} x={x} dy={i === 0 ? (parts.length > 1 ? -4 : 0) : 10}>
          {part}
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
    <ResponsiveContainer width="100%" height={340}>
      <RadarChart data={data} outerRadius="70%" margin={{ top: 12, right: 24, bottom: 12, left: 24 }}>
        <PolarGrid stroke="#404040" />
        <PolarAngleAxis dataKey="group" tick={<AngleTick />} />
        {/* A single "50" label, halfway between two spokes, so axis numbers never collide with the muscle names. */}
        <PolarRadiusAxis
          angle={90 - 360 / MUSCLE_GROUPS.length / 2}
          domain={[0, 100]}
          ticks={[50]}
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
