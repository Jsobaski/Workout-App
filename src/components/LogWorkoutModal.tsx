"use client";

import { useState } from "react";
import Modal from "./Modal";
import { SetEntry, WorkoutEntry } from "@/lib/types";
import { inferMuscleGroups } from "@/lib/muscleGroups";

export interface WorkoutPrefill {
  exerciseName?: string;
  sets?: SetEntry[];
  notes?: string;
  caution?: string;
}

export default function LogWorkoutModal({
  exerciseNames,
  prefill,
  onClose,
  onSave,
}: {
  exerciseNames: string[];
  prefill?: WorkoutPrefill;
  onClose: () => void;
  onSave: (entry: Omit<WorkoutEntry, "id" | "dateKey">) => Promise<void>;
}) {
  const [exerciseName, setExerciseName] = useState(prefill?.exerciseName ?? "");
  const [sets, setSets] = useState<SetEntry[]>(
    prefill?.sets && prefill.sets.length > 0
      ? prefill.sets
      : [{ reps: 8, weight: 0 }]
  );
  const [notes, setNotes] = useState(prefill?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateSet(index: number, field: keyof SetEntry, value: number) {
    setSets((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }

  async function handleSave() {
    if (!exerciseName.trim()) {
      setError("Enter an exercise name.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        timestamp: Date.now(),
        exerciseName: exerciseName.trim(),
        muscleGroups: inferMuscleGroups(exerciseName.trim()),
        sets,
        notes: notes.trim() || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Log Exercise" onClose={onClose}>
      {prefill?.caution && (
        <div className="mb-3 rounded-lg border border-amber-800 bg-amber-950/50 px-3 py-2 text-xs text-amber-300">
          ⚠ {prefill.caution}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <input
            list="exercise-names"
            value={exerciseName}
            onChange={(e) => setExerciseName(e.target.value)}
            placeholder="Exercise name"
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
          />
          <datalist id="exercise-names">
            {exerciseNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-neutral-500">Sets</p>
          {sets.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-12 text-xs text-neutral-500">Set {i + 1}</span>
              <input
                type="number"
                value={s.reps}
                onChange={(e) => updateSet(i, "reps", Number(e.target.value))}
                placeholder="Reps"
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100"
              />
              <input
                type="number"
                value={s.weight}
                onChange={(e) => updateSet(i, "weight", Number(e.target.value))}
                placeholder="Weight (lb)"
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100"
              />
              {sets.length > 1 && (
                <button
                  onClick={() =>
                    setSets((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  className="text-neutral-500 hover:text-red-400"
                  aria-label="Remove set"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() =>
              setSets((prev) => [
                ...prev,
                prev.length > 0
                  ? { ...prev[prev.length - 1] }
                  : { reps: 8, weight: 0 },
              ])
            }
            className="text-xs text-emerald-400 hover:underline"
          >
            + Add set
          </button>
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional) — e.g. neck cramped, cut short"
          rows={2}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
        />

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm text-neutral-400 hover:bg-neutral-800"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}
