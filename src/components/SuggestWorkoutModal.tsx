"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import { clearSavedPin, getSavedPin } from "@/lib/appPin";
import { CoachingContext, SuggestedExercise, WorkoutSuggestion } from "@/lib/types";
import { dateKeysInRange, todayKey } from "@/lib/date";
import { listWorkoutEntriesInRange } from "@/lib/db";

export default function SuggestWorkoutModal({
  coachingContext,
  cached,
  addedNames,
  onClose,
  onLoaded,
  onAdd,
  onLocked,
}: {
  coachingContext: CoachingContext;
  cached: WorkoutSuggestion | null;
  addedNames: Set<string>;
  onClose: () => void;
  onLoaded: (suggestion: WorkoutSuggestion) => void;
  onAdd: (exercise: SuggestedExercise) => Promise<void>;
  onLocked: () => void;
}) {
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [exercises, setExercises] = useState<SuggestedExercise[]>(cached?.exercises ?? []);
  const [summary, setSummary] = useState(cached?.summary ?? "");
  const [addingName, setAddingName] = useState<string | null>(null);

  async function fetchSuggestion() {
    setLoading(true);
    setError(null);
    try {
      const recentDateKeys = dateKeysInRange(todayKey(), 7);
      const recent = await listWorkoutEntriesInRange(recentDateKeys);
      const recentWorkouts = recent
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((e) => ({
          dateKey: e.dateKey,
          exerciseName: e.exerciseName,
          muscleGroups: e.muscleGroups,
          sets: e.sets,
          notes: e.notes,
        }));

      const pin = getSavedPin();
      const res = await fetch("/api/suggest-workout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(pin ? { "x-app-pin": pin } : {}),
        },
        body: JSON.stringify({ recentWorkouts, coachingContext }),
      });
      if (res.status === 401) {
        clearSavedPin();
        onLocked();
        throw new Error("Locked — unlock AI features with your PIN in Settings.");
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Suggestion failed");
      const suggestion: WorkoutSuggestion = {
        exercises: data.exercises || [],
        summary: data.summary || "",
      };
      setExercises(suggestion.exercises);
      setSummary(suggestion.summary);
      onLoaded(suggestion);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not get a suggestion right now."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!cached) {
      void Promise.resolve().then(() => fetchSuggestion());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleTap(exercise: SuggestedExercise) {
    if (addedNames.has(exercise.name) || addingName) return;
    setAddingName(exercise.name);
    try {
      await onAdd(exercise);
    } finally {
      setAddingName(null);
    }
  }

  return (
    <Modal title="Suggested Workout" onClose={onClose}>
      {loading && (
        <p className="py-6 text-center text-sm text-neutral-400">
          Reviewing your recent training…
        </p>
      )}

      {!loading && error && (
        <div className="space-y-3">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-neutral-800 py-2 text-sm text-neutral-200"
          >
            Log an exercise manually instead
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          {summary && (
            <p className="rounded-lg bg-neutral-800/60 px-3 py-2 text-sm text-neutral-300">
              {summary}
            </p>
          )}
          {exercises.length === 0 && (
            <p className="text-sm text-neutral-500">No suggestion returned.</p>
          )}
          {exercises.map((ex, i) => {
            const added = addedNames.has(ex.name);
            const adding = addingName === ex.name;
            return (
              <button
                key={i}
                onClick={() => handleTap(ex)}
                disabled={added || adding}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  added
                    ? "border-emerald-800 bg-emerald-950/20 opacity-70"
                    : "border-neutral-800 bg-neutral-800/40 hover:border-emerald-700 hover:bg-emerald-950/30"
                } disabled:cursor-default`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-neutral-100">{ex.name}</span>
                  <span
                    className={`text-xs ${added ? "text-emerald-400" : "text-neutral-400"}`}
                  >
                    {added
                      ? "✓ Added"
                      : adding
                        ? "Adding…"
                        : `${ex.sets} × ${ex.reps} @ ${ex.weight}lb`}
                  </span>
                </div>
                {ex.reasoning && (
                  <p className="mt-1 text-xs text-neutral-500">{ex.reasoning}</p>
                )}
                {ex.caution && (
                  <p className="mt-1 text-xs text-amber-400">⚠ {ex.caution}</p>
                )}
              </button>
            );
          })}
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-neutral-600">
              Tap an exercise to add it to today&apos;s workout
            </p>
            <button
              onClick={fetchSuggestion}
              className="text-xs text-emerald-400 hover:underline"
            >
              Get new suggestions
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
