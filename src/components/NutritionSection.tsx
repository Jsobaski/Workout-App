"use client";

import { useState } from "react";
import CollapsibleSection from "./CollapsibleSection";
import { FoodEntry } from "@/lib/types";
import { formatTime } from "@/lib/date";
import { nutritionTotals } from "@/lib/aggregate";
import { copyToClipboard, formatNutritionText } from "@/lib/shareText";

export default function NutritionSection({
  dateKey,
  entries,
  targetCalories,
  targetProtein,
  onAdd,
  onUpdate,
  onDelete,
}: {
  dateKey: string;
  entries: FoodEntry[];
  targetCalories?: [number | null, number | null];
  targetProtein?: number | null;
  onAdd: () => void;
  onUpdate: (entry: FoodEntry) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const totals = nutritionTotals(entries);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await copyToClipboard(
      formatNutritionText(dateKey, entries, totals, { calories: targetCalories, proteinG: targetProtein })
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <CollapsibleSection
      title="Today's Nutrition"
      right={
        <span className="text-sm font-normal text-neutral-400">
          {totals.calories} kcal · {totals.proteinG}g protein
        </span>
      }
    >
      {((targetCalories && (targetCalories[0] || targetCalories[1])) || targetProtein) && (
        <div className="mb-3 space-y-2.5">
          {targetCalories && (targetCalories[0] || targetCalories[1]) && (
            <NutrientProgress
              label="Calories"
              value={totals.calories}
              target={targetCalories[1] ?? targetCalories[0] ?? null}
              rangeLabel={
                targetCalories[0] && targetCalories[1]
                  ? `${targetCalories[0]}–${targetCalories[1]}`
                  : String(targetCalories[1] ?? targetCalories[0])
              }
              unit=" kcal"
            />
          )}
          {targetProtein ? (
            <NutrientProgress
              label="Protein"
              value={totals.proteinG}
              target={targetProtein}
              rangeLabel={String(targetProtein)}
              unit="g"
            />
          ) : null}
        </div>
      )}

      {entries.length === 0 ? (
        <p className="py-2 text-sm text-neutral-500">No food logged yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) =>
            editingId === entry.id ? (
              <EditFoodRow
                key={entry.id}
                entry={entry}
                onCancel={() => setEditingId(null)}
                onSave={async (updated) => {
                  await onUpdate(updated);
                  setEditingId(null);
                }}
              />
            ) : (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-neutral-800/50 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-neutral-100">
                    {entry.itemName}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {formatTime(entry.timestamp)} · {entry.calories} kcal ·{" "}
                    {entry.proteinG}g protein
                    {entry.source === "photo" ? " · 📷" : ""}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => setEditingId(entry.id)}
                    className="rounded-md px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(entry.id)}
                    className="rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-950"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-800 pt-3">
        <div className="text-sm font-semibold text-neutral-200">
          Total: {totals.calories} kcal · {totals.proteinG}g protein
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            disabled={entries.length === 0}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={onAdd}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
          >
            + Add Food
          </button>
        </div>
      </div>
    </CollapsibleSection>
  );
}

function NutrientProgress({
  label,
  value,
  target,
  rangeLabel,
  unit,
}: {
  label: string;
  value: number;
  target: number | null;
  rangeLabel: string;
  unit: string;
}) {
  if (!target) return null;
  const pct = Math.min(100, Math.round((value / target) * 100));
  const over = value > target;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-neutral-500">{label}</span>
        <span className={over ? "text-amber-400" : "text-neutral-300"}>
          {value.toLocaleString()} / {rangeLabel}
          {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
        <div
          className={`h-full rounded-full transition-all ${
            over ? "bg-amber-500" : "bg-emerald-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function EditFoodRow({
  entry,
  onSave,
  onCancel,
}: {
  entry: FoodEntry;
  onSave: (entry: FoodEntry) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [itemName, setItemName] = useState(entry.itemName);
  const [calories, setCalories] = useState(String(entry.calories));
  const [proteinG, setProteinG] = useState(String(entry.proteinG));

  return (
    <div className="space-y-2 rounded-lg border border-emerald-800 bg-neutral-800/70 p-3">
      <input
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100"
        placeholder="Item name"
      />
      <div className="flex gap-2">
        <input
          type="number"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100"
          placeholder="Calories"
        />
        <input
          type="number"
          value={proteinG}
          onChange={(e) => setProteinG(e.target.value)}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100"
          placeholder="Protein (g)"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md px-3 py-1 text-xs text-neutral-400 hover:bg-neutral-700"
        >
          Cancel
        </button>
        <button
          onClick={() =>
            onSave({
              ...entry,
              itemName: itemName.trim() || entry.itemName,
              calories: Number(calories) || 0,
              proteinG: Number(proteinG) || 0,
            })
          }
          className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500"
        >
          Save
        </button>
      </div>
    </div>
  );
}
