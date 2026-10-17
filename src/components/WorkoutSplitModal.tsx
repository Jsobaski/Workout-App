"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import { SetEntry, WorkoutEntry } from "@/lib/types";
import { inferMuscleGroups } from "@/lib/muscleGroups";
import {
  SplitExercise,
  WORKOUT_SPLITS,
  guessNextSplitDayId,
} from "@/lib/workoutSplits";
import {
  findLastWorkoutEntryForExercise,
  findMostRecentWorkoutEntry,
  getExerciseSettings,
} from "@/lib/db";
import { ResolvedExerciseConfig, resolveExerciseConfig } from "@/lib/exerciseSettings";
import { formatShortDate } from "@/lib/date";

interface RowState {
  selected: boolean;
  sets: SetEntry[];
  bodyweight: boolean;
}

// PT-restricted exercises are shown (so nothing silently disappears from the
// split) but are never pre-selected for logging.
function defaultRow(
  exercise: SplitExercise,
  lastEntry: WorkoutEntry | null,
  restricted: boolean
): RowState {
  if (lastEntry) {
    return {
      selected: !restricted,
      sets: lastEntry.sets.map((s) => ({ ...s })),
      bodyweight: lastEntry.bodyweight ?? exercise.bodyweight ?? false,
    };
  }
  return {
    selected: !restricted,
    sets: [{ reps: 8, weight: exercise.suggestedWeight ?? 0 }],
    bodyweight: exercise.bodyweight ?? false,
  };
}

export default function WorkoutSplitModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (entry: Omit<WorkoutEntry, "id" | "dateKey">) => Promise<void>;
}) {
  const [dayId, setDayId] = useState(WORKOUT_SPLITS[0].id);
  const [lastEntries, setLastEntries] = useState<Record<string, WorkoutEntry | null>>({});
  const [configs, setConfigs] = useState<Record<string, ResolvedExerciseConfig | null>>({});
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loadingDay, setLoadingDay] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const day = useMemo(
    () => WORKOUT_SPLITS.find((d) => d.id === dayId) ?? WORKOUT_SPLITS[0],
    [dayId]
  );

  // Suggest the next day in rotation on first open, based on the most
  // recently logged exercise across all history.
  useEffect(() => {
    (async () => {
      const recent = await findMostRecentWorkoutEntry();
      setDayId(guessNextSplitDayId(recent?.exerciseName ?? null));
    })();
    // Only on mount — the user can still switch days manually afterward.
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingDay(true);
      const [entries, overrides] = await Promise.all([
        Promise.all(day.exercises.map((ex) => findLastWorkoutEntryForExercise(ex.name))),
        getExerciseSettings(),
      ]);
      if (cancelled) return;
      const lastByName: Record<string, WorkoutEntry | null> = {};
      const configByName: Record<string, ResolvedExerciseConfig | null> = {};
      const initialRows: Record<string, RowState> = {};
      day.exercises.forEach((ex, i) => {
        lastByName[ex.name] = entries[i];
        configByName[ex.name] = resolveExerciseConfig(ex.name, overrides);
        initialRows[ex.name] = defaultRow(ex, entries[i], configByName[ex.name]?.restricted ?? false);
      });
      setConfigs(configByName);
      setLastEntries(lastByName);
      setRows(initialRows);
      setLoadingDay(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [day]);

  function updateRow(name: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [name]: { ...prev[name], ...patch } }));
  }

  function updateSet(name: string, index: number, field: keyof SetEntry, value: number) {
    setRows((prev) => ({
      ...prev,
      [name]: {
        ...prev[name],
        sets: prev[name].sets.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
      },
    }));
  }

  function addSet(name: string) {
    setRows((prev) => {
      const current = prev[name].sets;
      const next = current.length > 0 ? { ...current[current.length - 1] } : { reps: 8, weight: 0 };
      return { ...prev, [name]: { ...prev[name], sets: [...current, next] } };
    });
  }

  function removeSet(name: string, index: number) {
    setRows((prev) => ({
      ...prev,
      [name]: { ...prev[name], sets: prev[name].sets.filter((_, i) => i !== index) },
    }));
  }

  function toggleBodyweight(name: string, checked: boolean) {
    setRows((prev) => ({
      ...prev,
      [name]: {
        ...prev[name],
        bodyweight: checked,
        sets: checked ? prev[name].sets.map((s) => ({ ...s, weight: 0 })) : prev[name].sets,
      },
    }));
  }

  const selectedCount = Object.values(rows).filter((r) => r.selected).length;

  async function handleLogSelected() {
    setSaving(true);
    setError(null);
    try {
      for (const exercise of day.exercises) {
        const row = rows[exercise.name];
        if (!row?.selected) continue;
        await onSave({
          timestamp: Date.now(),
          exerciseName: exercise.name,
          muscleGroups: inferMuscleGroups(exercise.name),
          sets: row.sets,
          bodyweight: row.bodyweight || undefined,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Choose Today's Workout" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {WORKOUT_SPLITS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDayId(d.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                d.id === dayId
                  ? "bg-emerald-600 text-white"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {loadingDay ? (
          <p className="py-4 text-center text-sm text-neutral-500">Loading history…</p>
        ) : (
          <div className="space-y-3">
            {day.exercises.map((exercise) => {
              const row = rows[exercise.name];
              const lastEntry = lastEntries[exercise.name];
              if (!row) return null;
              return (
                <div
                  key={exercise.name}
                  className={`rounded-lg border px-3 py-2.5 ${
                    row.selected
                      ? "border-emerald-800 bg-neutral-800/50"
                      : "border-neutral-800 bg-neutral-900/50"
                  }`}
                >
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={(e) => updateRow(exercise.name, { selected: e.target.checked })}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-700 bg-neutral-900 accent-emerald-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-neutral-100">
                        {exercise.name}
                        {configs[exercise.name]?.restricted && (
                          <span className="ml-2 rounded-full bg-sky-950 px-2 py-0.5 text-[10px] font-medium text-sky-300">
                            {configs[exercise.name]?.restrictionNote ?? "PT restricted"}
                          </span>
                        )}
                        {!configs[exercise.name]?.restricted && configs[exercise.name]?.needsPtConfirmation && (
                          <span className="ml-2 rounded-full bg-amber-950 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                            needs PT confirmation
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {lastEntry ? (
                          <>
                            Last time ({formatShortDate(lastEntry.dateKey)}):{" "}
                            {lastEntry.sets
                              .map((s) =>
                                lastEntry.bodyweight ? `${s.reps} reps` : `${s.reps}×${s.weight}lb`
                              )
                              .join(", ")}
                          </>
                        ) : (
                          <>
                            Never logged
                            {exercise.weightHint ? ` · suggested ${exercise.weightHint}` : ""}
                          </>
                        )}
                      </div>
                    </div>
                  </label>

                  {row.selected && (
                    <div className="mt-2.5 space-y-1.5 pl-6">
                      <label className="flex items-center gap-2 text-xs text-neutral-400">
                        <input
                          type="checkbox"
                          checked={row.bodyweight}
                          onChange={(e) => toggleBodyweight(exercise.name, e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-neutral-700 bg-neutral-900 accent-emerald-600"
                        />
                        Bodyweight
                      </label>
                      {row.sets.map((s, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-10 text-xs text-neutral-500">Set {i + 1}</span>
                          <input
                            type="number"
                            value={s.reps}
                            onChange={(e) => updateSet(exercise.name, i, "reps", Number(e.target.value))}
                            placeholder="Reps"
                            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100"
                          />
                          {!row.bodyweight && (
                            <input
                              type="number"
                              value={s.weight}
                              onChange={(e) => updateSet(exercise.name, i, "weight", Number(e.target.value))}
                              placeholder="Weight (lb)"
                              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100"
                            />
                          )}
                          {row.sets.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSet(exercise.name, i)}
                              className="text-neutral-500 hover:text-red-400"
                              aria-label="Remove set"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addSet(exercise.name)}
                        className="text-xs text-emerald-400 hover:underline"
                      >
                        + Add set
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

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
          onClick={handleLogSelected}
          disabled={saving || loadingDay || selectedCount === 0}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving
            ? "Logging…"
            : `Log ${selectedCount} Exercise${selectedCount === 1 ? "" : "s"}`}
        </button>
      </div>
    </Modal>
  );
}
