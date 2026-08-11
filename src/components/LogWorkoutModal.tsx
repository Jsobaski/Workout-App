"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import { SetEntry, WorkoutEntry } from "@/lib/types";
import { inferMuscleGroups } from "@/lib/muscleGroups";
import { fuzzyMatchNames } from "@/lib/fuzzyMatch";
import { COMMON_EXERCISES } from "@/lib/commonExercises";
import { findLastWorkoutEntryForExercise } from "@/lib/db";
import { formatShortDate } from "@/lib/date";

export default function LogWorkoutModal({
  exerciseNames,
  onClose,
  onSave,
}: {
  exerciseNames: string[];
  onClose: () => void;
  onSave: (entry: Omit<WorkoutEntry, "id" | "dateKey">) => Promise<void>;
}) {
  const [exerciseName, setExerciseName] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [sets, setSets] = useState<SetEntry[]>([{ reps: 8, weight: 0 }]);
  const [bodyweight, setBodyweight] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const historyNames = useMemo(() => new Set(exerciseNames), [exerciseNames]);
  const allNames = useMemo(
    () => Array.from(new Set([...exerciseNames, ...COMMON_EXERCISES])),
    [exerciseNames]
  );
  const suggestions = useMemo(
    () => fuzzyMatchNames(exerciseName, allNames, 6, historyNames),
    [exerciseName, allNames, historyNames]
  );

  const [lastEntry, setLastEntry] = useState<WorkoutEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    const name = exerciseName.trim();
    (async () => {
      const found = name ? await findLastWorkoutEntryForExercise(name) : null;
      if (!cancelled) setLastEntry(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [exerciseName]);

  function useLastTime() {
    if (!lastEntry) return;
    setSets(lastEntry.sets.map((s) => ({ ...s })));
    setBodyweight(lastEntry.bodyweight ?? false);
  }

  function selectSuggestion(name: string) {
    setExerciseName(name);
    setShowSuggestions(false);
  }

  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectSuggestion(suggestions[highlightIndex]);
    } else if (e.key === "Escape") {
      // Next.js's root React listener and Modal's own document keydown
      // listener are both on `document` — stopPropagation() alone doesn't
      // stop a later same-node listener, only stopImmediatePropagation() does.
      e.nativeEvent.stopImmediatePropagation();
      setShowSuggestions(false);
    }
  }

  function updateSet(index: number, field: keyof SetEntry, value: number) {
    setSets((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }

  function toggleBodyweight(checked: boolean) {
    setBodyweight(checked);
    if (checked) {
      setSets((prev) => prev.map((s) => ({ ...s, weight: 0 })));
    }
  }

  async function handleSave() {
    if (!exerciseName.trim()) {
      setError("Enter an exercise name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        timestamp: Date.now(),
        exerciseName: exerciseName.trim(),
        muscleGroups: inferMuscleGroups(exerciseName.trim()),
        sets,
        bodyweight: bodyweight || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Log Exercise" onClose={onClose}>
      <div className="space-y-3">
        <div className="relative">
          <input
            value={exerciseName}
            onChange={(e) => {
              setExerciseName(e.target.value);
              setShowSuggestions(true);
              setHighlightIndex(0);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setShowSuggestions(false)}
            onKeyDown={handleNameKeyDown}
            placeholder="Exercise name"
            autoComplete="off"
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-neutral-700 bg-neutral-900 shadow-lg">
              {suggestions.map((name, i) => (
                <li key={name}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(name)}
                    className={`w-full px-3 py-1.5 text-left text-sm ${
                      i === highlightIndex
                        ? "bg-emerald-950 text-emerald-300"
                        : "text-neutral-200 hover:bg-neutral-800"
                    }`}
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {lastEntry && (
          <div className="flex items-center justify-between rounded-md bg-neutral-800/50 px-3 py-1.5 text-xs">
            <span className="text-neutral-400">
              Last time ({formatShortDate(lastEntry.dateKey)}):{" "}
              <span className="text-neutral-300">
                {lastEntry.sets
                  .map((s) =>
                    lastEntry.bodyweight ? `${s.reps} reps` : `${s.reps}×${s.weight}lb`
                  )
                  .join(", ")}
              </span>
            </span>
            <button
              type="button"
              onClick={useLastTime}
              className="shrink-0 text-emerald-400 hover:underline"
            >
              Use these
            </button>
          </div>
        )}

        <label className="flex items-center gap-2 text-xs text-neutral-400">
          <input
            type="checkbox"
            checked={bodyweight}
            onChange={(e) => toggleBodyweight(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-700 bg-neutral-900 accent-emerald-600"
          />
          Bodyweight exercise (no added weight)
        </label>

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
              {!bodyweight && (
                <input
                  type="number"
                  value={s.weight}
                  onChange={(e) => updateSet(i, "weight", Number(e.target.value))}
                  placeholder="Weight (lb)"
                  className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100"
                />
              )}
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
