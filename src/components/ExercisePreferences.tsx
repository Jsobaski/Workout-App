"use client";

import { useEffect, useState } from "react";
import ExerciseSettingsEditor from "./ExerciseSettingsEditor";
import { useExerciseSettings } from "@/hooks/useExerciseSettings";
import { getCoachingContext, listAllWorkoutEntries } from "@/lib/db";
import { MOVEMENT_PATTERNS, MovementPattern } from "@/lib/exerciseMuscleMap";
import { MUSCLE_GROUPS, MuscleGroupId } from "@/lib/muscleTaxonomy";
import { WorkoutEntry } from "@/lib/types";

// All local preferences in one panel so they share a single settings state
// (separate instances could overwrite each other's edits when saving).
export default function ExercisePreferences() {
  const { settings, loading, saveSettings } = useExerciseSettings();
  const [entries, setEntries] = useState<WorkoutEntry[]>([]);
  const [bodyweightLb, setBodyweightLb] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [all, coaching] = await Promise.all([listAllWorkoutEntries(), getCoachingContext()]);
      if (cancelled) return;
      setEntries(all);
      setBodyweightLb(coaching.currentWeightLb);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="text-xs text-neutral-500">Loading…</p>;

  function togglePattern(id: MovementPattern, on: boolean) {
    const patterns = { ...settings.patterns };
    if (on) patterns[id] = patterns[id] ?? {};
    else delete patterns[id];
    saveSettings({ ...settings, patterns });
  }

  function setPatternNote(id: MovementPattern, note: string) {
    const patterns = { ...settings.patterns, [id]: note.trim() ? { note: note.trim() } : {} };
    saveSettings({ ...settings, patterns });
  }

  function toggleFocus(id: MuscleGroupId, on: boolean) {
    const focus = new Set(settings.focusMuscles);
    if (on) focus.add(id);
    else focus.delete(id);
    saveSettings({ ...settings, focusMuscles: Array.from(focus) });
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 text-xs font-semibold text-neutral-300">Restricted movement patterns</h3>
        <p className="mb-2 text-xs text-neutral-500">
          Restrict a whole pattern and it applies to every exercise tagged with it (and its alternate names). Restricted
          exercises are never suggested. You can still allow a single exercise below. Nothing is restricted unless you
          choose it.
        </p>
        <div className="space-y-2">
          {MOVEMENT_PATTERNS.map((p) => {
            const on = settings.patterns[p.id] != null;
            return (
              <div key={p.id} className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => togglePattern(p.id, e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-neutral-700 bg-neutral-900 accent-sky-500"
                  />
                  <span>
                    <span className="text-sm text-neutral-200">{p.label}</span>
                    <span className="block text-[11px] text-neutral-500">{p.hint}</span>
                  </span>
                </label>
                {on && (
                  <input
                    key={`pn-${p.id}-${settings.patterns[p.id]?.note ?? ""}`}
                    defaultValue={settings.patterns[p.id]?.note ?? ""}
                    onBlur={(e) => setPatternNote(p.id, e.target.value)}
                    placeholder="Note (optional)"
                    className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-xs font-semibold text-neutral-300">Priority muscles</h3>
        <p className="mb-2 text-xs text-neutral-500">
          Tag muscles that matter most for your goals or sport. Only these get a small bonus in Focus This Week
          (default: none).
        </p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {MUSCLE_GROUPS.map((g) => (
            <label key={g.id} className="flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                checked={settings.focusMuscles.includes(g.id)}
                onChange={(e) => toggleFocus(g.id, e.target.checked)}
                className="h-4 w-4 rounded border-neutral-700 bg-neutral-900 accent-emerald-600"
              />
              {g.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-xs font-semibold text-neutral-300">Per-exercise settings</h3>
        <ExerciseSettingsEditor settings={settings} onChange={saveSettings} entries={entries} bodyweightLb={bodyweightLb} />
      </div>
    </div>
  );
}
