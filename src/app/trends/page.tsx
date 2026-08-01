"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTrendsData } from "@/hooks/useTrendsData";
import { useCoachingContext } from "@/hooks/useCoachingContext";
import { useExerciseNames } from "@/hooks/useExerciseNames";
import { useExerciseHistory } from "@/hooks/useExerciseHistory";

const RANGE_OPTIONS = [14, 30];

export default function TrendsPage() {
  const [days, setDays] = useState(14);
  const { dailyPoints, weeklyFrequency, loading } = useTrendsData(days);
  const { context } = useCoachingContext();
  const exerciseNames = useExerciseNames();
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const exerciseHistory = useExerciseHistory(selectedExercise);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-100">Trends</h1>
        <div className="flex gap-1 rounded-lg bg-neutral-800 p-1">
          {RANGE_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                days === d
                  ? "bg-emerald-600 text-white"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-sm text-neutral-500">Loading…</p>}

      <ChartCard title="Calories vs. target">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={dailyPoints}>
            <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#737373" fontSize={11} />
            <YAxis stroke="#737373" fontSize={11} />
            <Tooltip
              contentStyle={{ background: "#171717", border: "1px solid #333" }}
            />
            {context.calorieTargetLow && (
              <ReferenceLine
                y={context.calorieTargetLow}
                stroke="#facc15"
                strokeDasharray="4 4"
              />
            )}
            {context.calorieTargetHigh && (
              <ReferenceLine
                y={context.calorieTargetHigh}
                stroke="#facc15"
                strokeDasharray="4 4"
              />
            )}
            <Line
              type="monotone"
              dataKey="calories"
              stroke="#34d399"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Protein vs. target">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={dailyPoints}>
            <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#737373" fontSize={11} />
            <YAxis stroke="#737373" fontSize={11} />
            <Tooltip
              contentStyle={{ background: "#171717", border: "1px solid #333" }}
            />
            {context.proteinTargetG && (
              <ReferenceLine
                y={context.proteinTargetG}
                stroke="#facc15"
                strokeDasharray="4 4"
              />
            )}
            <Line
              type="monotone"
              dataKey="proteinG"
              stroke="#60a5fa"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Workout frequency (days trained per week)">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={weeklyFrequency}>
            <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
            <XAxis dataKey="weekKey" stroke="#737373" fontSize={11} />
            <YAxis stroke="#737373" fontSize={11} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "#171717", border: "1px solid #333" }}
            />
            <Bar dataKey="daysTrained" fill="#34d399" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Exercise progression"
        right={
          <select
            value={selectedExercise ?? ""}
            onChange={(e) => setSelectedExercise(e.target.value || null)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
          >
            <option value="">Pick an exercise…</option>
            {exerciseNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        }
      >
        {selectedExercise && exerciseHistory.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={exerciseHistory}>
              <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#737373" fontSize={11} />
              <YAxis stroke="#737373" fontSize={11} />
              <Tooltip
                contentStyle={{ background: "#171717", border: "1px solid #333" }}
              />
              <Line
                type="monotone"
                dataKey="maxWeight"
                stroke="#f472b6"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-sm text-neutral-500">
            {selectedExercise
              ? "No logged sessions for this exercise yet."
              : "Pick an exercise to see weight progression."}
          </p>
        )}
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-300">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}
