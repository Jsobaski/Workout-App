"use client";

import { useEffect, useMemo, useState } from "react";
import { SetEntry, WorkoutEntry } from "@/lib/types";
import { fuzzyMatchNames } from "@/lib/fuzzyMatch";
import { COMMON_EXERCISES } from "@/lib/commonExercises";
import { findLastWorkoutEntryForExercise, listAllWorkoutEntries } from "@/lib/db";
import { formatShortDate, todayKey } from "@/lib/date";
import { buildExerciseHistory, summarizeSets } from "@/lib/exerciseHistory";
import { SetSuggestion, loggedWeightsForGroup, suggestNextSets } from "@/lib/setSuggestions";
import { useExerciseSettings } from "@/hooks/useExerciseSettings";
import { BAND_OPTIONS, BandColor, bandLabel } from "@/lib/bands";

/** Everything the user enters for one movement in the Log Exercise form. */
export interface MovementDraft {
  key: number;
  name: string;
  sets: SetEntry[];
  bodyweight: boolean;
  timed: boolean;
  banded: boolean;
  notes: string;
}

export function newMovementDraft(key: number): MovementDraft {
  return { key, name: "", sets: [{ reps: 8, weight: 0 }], bodyweight: false, timed: false, banded: false, notes: "" };
}

// One movement's fields: name with suggestions, "last time", bodyweight/timed/band flags, sets, notes.
export default function MovementFields({
  draft,
  exerciseNames,
  onChange,
}: {
  draft: MovementDraft;
  exerciseNames: string[];
  onChange: (next: MovementDraft) => void;
}) {
  const { name, sets, bodyweight, timed, banded, notes } = draft;
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [lastEntry, setLastEntry] = useState<WorkoutEntry | null>(null);
  const [suggestion, setSuggestion] = useState<SetSuggestion | null>(null);
  const { settings } = useExerciseSettings();

  const historyNames = useMemo(() => new Set(exerciseNames), [exerciseNames]);
  const allNames = useMemo(() => Array.from(new Set([...exerciseNames, ...COMMON_EXERCISES])), [exerciseNames]);
  const suggestions = useMemo(() => fuzzyMatchNames(name, allNames, 6, historyNames), [name, allNames, historyNames]);

  useEffect(() => {
    let cancelled = false;
    const trimmed = name.trim();
    (async () => {
      const found = trimmed ? await findLastWorkoutEntryForExercise(trimmed) : null;
      // Smart set suggestion from this movement's whole history (name variants combined).
      let next: SetSuggestion | null = null;
      if (trimmed) {
        const all = await listAllWorkoutEntries();
        next = suggestNextSets(buildExerciseHistory(all, trimmed), todayKey(), {
          settings,
          loggedWeights: loggedWeightsForGroup(all, trimmed, settings),
        });
      }
      if (!cancelled) {
        setLastEntry(found);
        setSuggestion(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [name, settings]);

  const patch = (changes: Partial<MovementDraft>) => onChange({ ...draft, ...changes });

  function useLastTime() {
    if (!lastEntry) return;
    patch({
      sets: lastEntry.sets.map((s) => ({ ...s })),
      bodyweight: lastEntry.bodyweight ?? false,
      timed: lastEntry.timed ?? false,
      banded: lastEntry.banded ?? false,
    });
  }

  function useSuggestion() {
    if (!suggestion) return;
    patch({
      sets: suggestion.sets.map((s) => ({ ...s })),
      bodyweight: suggestion.flags.bodyweight,
      timed: suggestion.flags.timed,
      banded: suggestion.flags.banded,
    });
  }

  function selectSuggestion(value: string) {
    patch({ name: value });
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
      // Modal's own document keydown listener would also fire; stopImmediatePropagation keeps it from closing the modal.
      e.nativeEvent.stopImmediatePropagation();
      setShowSuggestions(false);
    }
  }

  const updateSet = (index: number, field: keyof SetEntry, value: number) =>
    patch({ sets: sets.map((s, i) => (i === index ? { ...s, [field]: value } : s)) });
  const updateSetBand = (index: number, color: BandColor) =>
    patch({ sets: sets.map((s, i) => (i === index ? { ...s, bandColor: color } : s)) });

  function toggleBodyweight(checked: boolean) {
    patch({ bodyweight: checked, sets: checked ? sets.map((s) => ({ ...s, weight: 0 })) : sets });
  }
  function toggleTimed(checked: boolean) {
    patch({
      timed: checked,
      sets: sets.map((s) => (checked ? { ...s, reps: 0, durationSec: s.durationSec ?? 60 } : { ...s, reps: s.reps || 8 })),
    });
  }
  function toggleBanded(checked: boolean) {
    patch({ banded: checked, sets: checked ? sets.map((s) => ({ ...s, bandColor: s.bandColor ?? "green" })) : sets });
  }

  const inputClass = "w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100";
  const checkClass = "h-4 w-4 rounded border-neutral-700 bg-neutral-900 accent-emerald-600";

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          value={name}
          onChange={(e) => {
            patch({ name: e.target.value });
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
            {suggestions.map((s, i) => (
              <li key={s}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSuggestion(s)}
                  className={`w-full px-3 py-1.5 text-left text-sm ${
                    i === highlightIndex ? "bg-emerald-950 text-emerald-300" : "text-neutral-200 hover:bg-neutral-800"
                  }`}
                >
                  {s}
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
                .map((s) => {
                  const qty = lastEntry.timed
                    ? `${s.durationSec}s`
                    : lastEntry.bodyweight || lastEntry.banded
                      ? `${s.reps} reps`
                      : `${s.reps}×${s.weight}lb`;
                  return lastEntry.banded && s.bandColor ? `${qty} (${bandLabel(s.bandColor)})` : qty;
                })
                .join(", ")}
            </span>
          </span>
          <button type="button" onClick={useLastTime} className="shrink-0 text-emerald-400 hover:underline">
            Use these
          </button>
        </div>
      )}

      {suggestion && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-900 bg-emerald-950/30 px-3 py-1.5 text-xs">
          <span className="min-w-0 text-neutral-400">
            <span className="font-medium text-emerald-300">Try: {summarizeSets(suggestion.sets, suggestion.flags)}</span>
            <span className="block">{suggestion.reason}</span>
          </span>
          <button type="button" onClick={useSuggestion} className="shrink-0 text-emerald-400 hover:underline">
            Use this
          </button>
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-neutral-400">
        <input type="checkbox" checked={bodyweight} onChange={(e) => toggleBodyweight(e.target.checked)} className={checkClass} />
        Bodyweight exercise (no added weight)
      </label>
      <label className="flex items-center gap-2 text-xs text-neutral-400">
        <input type="checkbox" checked={timed} onChange={(e) => toggleTimed(e.target.checked)} className={checkClass} />
        Timed (seconds) — e.g. planks, holds
      </label>
      <label className="flex items-center gap-2 text-xs text-neutral-400">
        <input type="checkbox" checked={banded} onChange={(e) => toggleBanded(e.target.checked)} className={checkClass} />
        Resistance band — e.g. clamshells, lateral walks
      </label>

      <div className="space-y-2">
        <p className="text-xs font-medium text-neutral-500">Sets</p>
        {sets.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-12 text-xs text-neutral-500">Set {i + 1}</span>
            {timed ? (
              <input
                type="number"
                value={s.durationSec ?? 0}
                onChange={(e) => updateSet(i, "durationSec", Number(e.target.value))}
                placeholder="Seconds"
                className={inputClass}
              />
            ) : (
              <input
                type="number"
                value={s.reps}
                onChange={(e) => updateSet(i, "reps", Number(e.target.value))}
                placeholder="Reps"
                className={inputClass}
              />
            )}
            {banded ? (
              <select value={s.bandColor ?? "green"} onChange={(e) => updateSetBand(i, e.target.value as BandColor)} className={inputClass}>
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
                  placeholder="Weight (lb)"
                  className={inputClass}
                />
              )
            )}
            {sets.length > 1 && (
              <button
                onClick={() => patch({ sets: sets.filter((_, idx) => idx !== i) })}
                className="text-neutral-500 hover:text-red-400"
                aria-label="Remove set"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => patch({ sets: [...sets, sets.length > 0 ? { ...sets[sets.length - 1] } : { reps: 8, weight: 0 }] })}
          className="text-xs text-emerald-400 hover:underline"
        >
          + Add set
        </button>
      </div>

      <textarea
        value={notes}
        onChange={(e) => patch({ notes: e.target.value })}
        placeholder="Notes (optional) — e.g. neck cramped, cut short"
        rows={2}
        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
      />
    </div>
  );
}
