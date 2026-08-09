"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMeasurements } from "@/hooks/useMeasurements";
import LogMeasurementsModal from "@/components/LogMeasurementsModal";
import { MEASUREMENT_FIELDS, MeasurementField } from "@/lib/measurements";
import { BodyMeasurementEntry } from "@/lib/types";
import { formatShortDate } from "@/lib/date";

function findPreviousValue(
  entries: BodyMeasurementEntry[],
  index: number,
  field: MeasurementField
): number | undefined {
  for (let i = index + 1; i < entries.length; i++) {
    const value = entries[i][field.key];
    if (value != null) return value;
  }
  return undefined;
}

function formatDelta(delta: number, unit: string): string {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${Math.round(delta * 10) / 10}${unit}`;
}

export default function MeasurementsPage() {
  const { entries, loading, addMeasurementEntry, removeMeasurementEntry } =
    useMeasurements();
  const [showLog, setShowLog] = useState(false);

  const fieldsWithData = useMemo(
    () => MEASUREMENT_FIELDS.filter((f) => entries.some((e) => e[f.key] != null)),
    [entries]
  );
  const [chartFieldKey, setChartFieldKey] = useState<string | null>(null);
  const chartField =
    fieldsWithData.find((f) => f.key === chartFieldKey) ?? fieldsWithData[0] ?? null;

  const chartData = useMemo(() => {
    if (!chartField) return [];
    return entries
      .filter((e) => e[chartField.key] != null)
      .slice()
      .reverse() // entries are newest-first; chart reads chronologically
      .map((e) => ({
        label: formatShortDate(e.dateKey),
        value: e[chartField.key],
      }));
  }, [entries, chartField]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-100">Measurements</h1>
          <p className="text-xs text-neutral-500">
            Check in every few weeks — month-to-month change is easier to read
            than day-to-day noise.
          </p>
        </div>
        <button
          onClick={() => setShowLog(true)}
          className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
        >
          + Log Measurements
        </button>
      </div>

      {loading && <p className="text-sm text-neutral-500">Loading…</p>}

      {fieldsWithData.length > 0 && chartField && (
        <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-300">Trend</h2>
            <select
              value={chartField.key}
              onChange={(e) => setChartFieldKey(e.target.value)}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
            >
              {fieldsWithData.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#737373" fontSize={11} />
              <YAxis
                stroke="#737373"
                fontSize={11}
                domain={["auto", "auto"]}
                unit={chartField.unit}
              />
              <Tooltip
                contentStyle={{ background: "#171717", border: "1px solid #333" }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#34d399"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {!loading && entries.length === 0 && (
        <p className="py-6 text-center text-sm text-neutral-500">
          No measurements logged yet. Suggested areas: body weight, body fat
          %, neck, shoulders, chest, waist, hips, bicep, forearm, thigh, calf.
        </p>
      )}

      <div className="space-y-2">
        {entries.map((entry, index) => {
          const filledFields = MEASUREMENT_FIELDS.filter(
            (f) => entry[f.key] != null
          );
          return (
            <div
              key={entry.id}
              className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-100">
                  {formatShortDate(entry.dateKey)}
                </span>
                <button
                  onClick={() => removeMeasurementEntry(entry.id)}
                  className="rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-950"
                >
                  Delete
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                {filledFields.map((field) => {
                  const value = entry[field.key] as number;
                  const previous = findPreviousValue(entries, index, field);
                  const delta = previous != null ? value - previous : null;
                  return (
                    <div key={field.key} className="text-xs">
                      <span className="text-neutral-500">{field.label}: </span>
                      <span className="text-neutral-200">
                        {value}
                        {field.unit}
                      </span>
                      {delta != null && delta !== 0 && (
                        <span className="ml-1 text-neutral-500">
                          ({formatDelta(delta, field.unit)})
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {entry.notes && (
                <p className="mt-2 text-xs italic text-neutral-500">{entry.notes}</p>
              )}
            </div>
          );
        })}
      </div>

      {showLog && (
        <LogMeasurementsModal
          onClose={() => setShowLog(false)}
          onSave={addMeasurementEntry}
        />
      )}
    </div>
  );
}
