"use client";

import { useState } from "react";
import CollapsibleSection from "./CollapsibleSection";
import { SetEntry, WorkoutEntry } from "@/lib/types";
import { workoutSummary } from "@/lib/aggregate";
import { copyToClipboard, formatWorkoutText } from "@/lib/shareText";
import { BAND_OPTIONS, BandColor, bandLabel } from "@/lib/bands";

export default function WorkoutSection({
  dateKey,
  entries,
  onAdd,
  onSuggest,
  canSuggest,
  onChooseSplit,
  onUpdate,
  onDelete,
}: {
  dateKey: string;
  entries: WorkoutEntry[];
  onAdd: () => void;
  onSuggest: () => void;
  canSuggest: boolean;
  onChooseSplit: () => void;
  onUpdate: (entry: WorkoutEntry) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const summary = workoutSummary(entries);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await copyToClipboard(formatWorkoutText(dateKey, entries));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <CollapsibleSection
      title="Today's Workout"
      right={
        <span className="text-sm font-normal text-neutral-400">
          {summary.exerciseCount} exercise{summary.exerciseCount === 1 ? "" : "s"} ·{" "}
          {summary.setCount} set{summary.setCount === 1 ? "" : "s"}
        </span>
      }
    >
      {summary.muscleGroups.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {summary.muscleGroups.map((g) => (
            <span
              key={g}
              className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300"
            >
              {g}
            </span>
          ))}
        </div>
      )}

      {entries.length === 0 ? (
        <p className="py-2 text-sm text-neutral-500">No workout logged yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) =>
            editingId === entry.id ? (
              <EditWorkoutRow
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
                className="flex items-start justify-between gap-2 rounded-lg bg-neutral-800/50 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-neutral-100">
                    {entry.exerciseName}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1 text-xs text-neutral-400">
                    {entry.sets.map((s, i) => {
                      const qty = entry.timed
                        ? `${s.durationSec}s`
                        : entry.bodyweight || entry.banded
                          ? `${s.reps} reps`
                          : `${s.reps}×${s.weight}lb`;
                      return (
                        <span
                          key={i}
                          className="rounded bg-neutral-900 px-1.5 py-0.5"
                        >
                          {entry.banded && s.bandColor ? `${qty} (${bandLabel(s.bandColor)})` : qty}
                        </span>
                      );
                    })}
                    {entry.bodyweight && (
                      <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-neutral-500">
                        Bodyweight
                      </span>
                    )}
                  </div>
                  {entry.notes && (
                    <div className="mt-1 text-xs italic text-neutral-500">
                      {entry.notes}
                    </div>
                  )}
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
          Total volume: {summary.totalVolume.toLocaleString()} lb
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCopy}
            disabled={entries.length === 0}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={onChooseSplit}
            className="rounded-lg border border-emerald-700 px-3 py-1.5 text-sm font-medium text-emerald-400 hover:bg-emerald-950"
          >
            Choose Split
          </button>
          {canSuggest && (
            <button
              onClick={onSuggest}
              className="rounded-lg border border-emerald-700 px-3 py-1.5 text-sm font-medium text-emerald-400 hover:bg-emerald-950"
            >
              Suggest Today&apos;s Workout
            </button>
          )}
          <button
            onClick={onAdd}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
          >
            + Log Exercise
          </button>
        </div>
      </div>
    </CollapsibleSection>
  );
}

function EditWorkoutRow({
  entry,
  onSave,
  onCancel,
}: {
  entry: WorkoutEntry;
  onSave: (entry: WorkoutEntry) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [exerciseName, setExerciseName] = useState(entry.exerciseName);
  const [sets, setSets] = useState<SetEntry[]>(entry.sets.map((s) => ({ ...s })));
  const [bodyweight, setBodyweight] = useState(entry.bodyweight ?? false);
  const [timed, setTimed] = useState(entry.timed ?? false);
  const [banded, setBanded] = useState(entry.banded ?? false);
  const [notes, setNotes] = useState(entry.notes ?? "");

  const updateSet = (index: number, field: keyof SetEntry, value: number) => {
    setSets((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const updateSetBand = (index: number, color: BandColor) => {
    setSets((prev) => prev.map((s, i) => (i === index ? { ...s, bandColor: color } : s)));
  };

  function toggleBodyweight(checked: boolean) {
    setBodyweight(checked);
    if (checked) {
      setSets((prev) => prev.map((s) => ({ ...s, weight: 0 })));
    }
  }

  function toggleTimed(checked: boolean) {
    setTimed(checked);
    setSets((prev) =>
      prev.map((s) => (checked ? { ...s, reps: 0, durationSec: s.durationSec ?? 60 } : { ...s, reps: s.reps || 8 }))
    );
  }

  function toggleBanded(checked: boolean) {
    setBanded(checked);
    if (checked) {
      setSets((prev) => prev.map((s) => ({ ...s, bandColor: s.bandColor ?? "green" })));
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-emerald-800 bg-neutral-800/70 p-3">
      <input
        value={exerciseName}
        onChange={(e) => setExerciseName(e.target.value)}
        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100"
        placeholder="Exercise name"
      />
      <label className="flex items-center gap-2 text-xs text-neutral-400">
        <input
          type="checkbox"
          checked={bodyweight}
          onChange={(e) => toggleBodyweight(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-700 bg-neutral-900 accent-emerald-600"
        />
        Bodyweight exercise (no added weight)
      </label>
      <label className="flex items-center gap-2 text-xs text-neutral-400">
        <input
          type="checkbox"
          checked={timed}
          onChange={(e) => toggleTimed(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-700 bg-neutral-900 accent-emerald-600"
        />
        Timed (seconds) — e.g. planks, holds
      </label>
      <label className="flex items-center gap-2 text-xs text-neutral-400">
        <input
          type="checkbox"
          checked={banded}
          onChange={(e) => toggleBanded(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-700 bg-neutral-900 accent-emerald-600"
        />
        Resistance band
      </label>
      <div className="space-y-1.5">
        {sets.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-10 text-xs text-neutral-500">Set {i + 1}</span>
            {timed ? (
              <input
                type="number"
                value={s.durationSec ?? 0}
                onChange={(e) => updateSet(i, "durationSec", Number(e.target.value))}
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100"
                placeholder="Seconds"
              />
            ) : (
              <input
                type="number"
                value={s.reps}
                onChange={(e) => updateSet(i, "reps", Number(e.target.value))}
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100"
                placeholder="Reps"
              />
            )}
            {banded ? (
              <select
                value={s.bandColor ?? "green"}
                onChange={(e) => updateSetBand(i, e.target.value as BandColor)}
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100"
              >
                {BAND_OPTIONS.map((o) => (
                  <option key={o.color} value={o.color}>
                    {bandLabel(o.color)}
                  </option>
                ))}
              </select>
            ) : (
              !bodyweight && (
                <input
                  type="number"
                  value={s.weight}
                  onChange={(e) => updateSet(i, "weight", Number(e.target.value))}
                  className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100"
                  placeholder="Weight"
                />
              )
            )}
            <button
              onClick={() => setSets((prev) => prev.filter((_, idx) => idx !== i))}
              className="text-neutral-500 hover:text-red-400"
              aria-label="Remove set"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          onClick={() => setSets((prev) => [...prev, { reps: 8, weight: 0 }])}
          className="text-xs text-emerald-400 hover:underline"
        >
          + Add set
        </button>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100"
        placeholder="Notes (optional)"
        rows={2}
      />
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
              exerciseName: exerciseName.trim() || entry.exerciseName,
              sets,
              bodyweight: bodyweight || undefined,
              timed: timed || undefined,
              banded: banded || undefined,
              notes: notes.trim() || undefined,
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
