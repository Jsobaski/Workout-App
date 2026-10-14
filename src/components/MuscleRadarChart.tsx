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
      <RadarChart data={data} outerRadius="70%">
        <PolarGrid stroke="#262626" />
        <PolarAngleAxis dataKey="group" stroke="#a3a3a3" fontSize={9} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#525252" fontSize={9} tickCount={5} />
        <Radar name="Before" dataKey="Before" stroke="#737373" fill="#737373" fillOpacity={0.15} strokeDasharray="4 3" />
        <Radar name="After" dataKey="After" stroke="#34d399" fill="#34d399" fillOpacity={0.3} />
        <Tooltip contentStyle={{ background: "#171717", border: "1px solid #333" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
