"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import { CoachingContext, SuggestedExercise, WorkoutEntry } from "@/lib/types";
import { dateKeysInRange, todayKey } from "@/lib/date";
import { listWorkoutEntriesInRange } from "@/lib/db";

export default function SuggestWorkoutModal({
  coachingContext,
  onClose,
  onPickExercise,
}: {
  coachingContext: CoachingContext;
  onClose: () => void;
  onPickExercise: (exercise: SuggestedExercise) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exercises, setExercises] = useState<SuggestedExercise[]>([]);
  const [summary, setSummary] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const recentDateKeys = dateKeysInRange(todayKey(), 7);
        const recent: WorkoutEntry[] = await listWorkoutEntriesInRange(
          recentDateKeys
        );
        const recentWorkouts = recent
          .sort((a, b) => a.timestamp - b.timestamp)
          .map((e) => ({
            dateKey: e.dateKey,
            exerciseName: e.exerciseName,
            muscleGroups: e.muscleGroups,
            sets: e.sets,
            notes: e.notes,
          }));

        const res = await fetch("/api/suggest-workout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recentWorkouts, coachingContext }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Suggestion failed");
        if (!cancelled) {
          setExercises(data.exercises || []);
          setSummary(data.summary || "");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not get a suggestion right now."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          {exercises.map((ex, i) => (
            <button
              key={i}
              onClick={() => onPickExercise(ex)}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-800/40 p-3 text-left hover:border-emerald-700 hover:bg-emerald-950/30"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-neutral-100">{ex.name}</span>
                <span className="text-xs text-neutral-400">
                  {ex.sets} × {ex.reps} @ {ex.weight}lb
                </span>
              </div>
              {ex.reasoning && (
                <p className="mt-1 text-xs text-neutral-500">{ex.reasoning}</p>
              )}
              {ex.caution && (
                <p className="mt-1 text-xs text-amber-400">⚠ {ex.caution}</p>
              )}
            </button>
          ))}
          <p className="pt-1 text-center text-xs text-neutral-600">
            Tap an exercise to log it
          </p>
        </div>
      )}
    </Modal>
  );
}
