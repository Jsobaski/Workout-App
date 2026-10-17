"use client";

import { useMemo, useState } from "react";
import { useExerciseSettings } from "@/hooks/useExerciseSettings";
import { EXERCISE_MUSCLE_MAP, LOAD_BASIS_LABELS, LoadBasis } from "@/lib/exerciseMuscleMap";
import {
  ExerciseSettingOverride,
  ExerciseSettingsOverrides,
  resolveConfigForKey,
} from "@/lib/exerciseSettings";

const BASIS_KEYS = Object.keys(LOAD_BASIS_LABELS) as LoadBasis[];

// Editable per-exercise scoring/safety settings: load multiplier + basis,
// bodyweight fraction, PT restriction (+ note) and "needs PT confirmation".
// Overrides are stored sparsely — only fields that differ from the built-in
// defaults — and saved immediately.
export default function ExerciseSettingsEditor() {
  const { overrides, loading, saveOverrides } = useExerciseSettings();
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const keys = useMemo(
    () =>
      Object.keys(EXERCISE_MUSCLE_MAP)
        .filter((k) => !EXERCISE_MUSCLE_MAP[k].hidden)
        .sort((a, b) => a.localeCompare(b)),
    []
  );

  if (loading) return <p className="text-xs text-neutral-500">Loading…</p>;

  const filtered = keys.filter((k) => k.includes(query.trim().toLowerCase()));

  async function update(key: string, patch: Partial<ExerciseSettingOverride>) {
    const defaults = resolveConfigForKey(key);
    if (!defaults) return;
    const merged: ExerciseSettingOverride = { ...overrides[key], ...patch };
    // Keep the stored override sparse: drop any field equal to the built-in default.
    const sparse: ExerciseSettingOverride = {};
    if (merged.loadMultiplier != null && merged.loadMultiplier !== defaults.loadMultiplier) sparse.loadMultiplier = merged.loadMultiplier;
    if (merged.loadBasis != null && merged.loadBasis !== defaults.loadBasis) sparse.loadBasis = merged.loadBasis;
    if (merged.bodyweightFraction != null && merged.bodyweightFraction !== defaults.bodyweightFraction) sparse.bodyweightFraction = merged.bodyweightFraction;
    if (merged.restricted != null && merged.restricted !== defaults.restricted) sparse.restricted = merged.restricted;
    if (merged.restrictionNote != null && merged.restrictionNote !== (defaults.restrictionNote ?? "")) sparse.restrictionNote = merged.restrictionNote;
    if (merged.needsPtConfirmation != null && merged.needsPtConfirmation !== defaults.needsPtConfirmation) sparse.needsPtConfirmation = merged.needsPtConfirmation;
    const next: ExerciseSettingsOverrides = { ...overrides };
    if (Object.keys(sparse).length === 0) delete next[key];
    else next[key] = sparse;
    await saveOverrides(next);
  }

  async function reset(key: string) {
    const next = { ...overrides };
    delete next[key];
    await saveOverrides(next);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">
        Effective load = logged weight × multiplier. Use it when a machine&apos;s number isn&apos;t the real load (plates
        only, both sides combined, cable stacks). Defaults are estimates — adjust them to match your gym. Restricted
        exercises are never suggested and pause decay for the muscles they last fed.
      </p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search exercises"
        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
      />
      <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
        {filtered.map((key) => {
          const cfg = resolveConfigForKey(key, overrides)!;
          const isOpen = openKey === key;
          const edited = key in overrides;
          return (
            <div key={key} className="rounded-lg border border-neutral-800 bg-neutral-900/50">
              <button
                type="button"
                onClick={() => setOpenKey(isOpen ? null : key)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-neutral-200">{cfg.displayName}</span>
                <span className="flex shrink-0 items-center gap-1.5 text-[10px]">
                  {cfg.restricted && <span className="rounded-full bg-sky-950 px-2 py-0.5 text-sky-300">restricted</span>}
                  {!cfg.restricted && cfg.needsPtConfirmation && (
                    <span className="rounded-full bg-amber-950 px-2 py-0.5 text-amber-300">PT?</span>
                  )}
                  {cfg.loadMultiplier !== 1 && <span className="text-neutral-500">×{cfg.loadMultiplier}</span>}
                  {edited && <span className="text-emerald-400">edited</span>}
                </span>
              </button>
              {isOpen && (
                <div className="space-y-3 border-t border-neutral-800 px-3 py-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-xs text-neutral-500">Load multiplier</span>
                      <input
                        key={`m-${cfg.loadMultiplier}`}
                        type="number"
                        step="0.05"
                        min="0"
                        defaultValue={cfg.loadMultiplier}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (e.target.value !== "" && Number.isFinite(v) && v >= 0) update(key, { loadMultiplier: v });
                        }}
                        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-neutral-500">Logged weight is…</span>
                      <select
                        value={cfg.loadBasis}
                        onChange={(e) => update(key, { loadBasis: e.target.value as LoadBasis })}
                        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100"
                      >
                        {BASIS_KEYS.map((b) => (
                          <option key={b} value={b}>
                            {LOAD_BASIS_LABELS[b]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="col-span-2 block">
                      <span className="mb-1 block text-xs text-neutral-500">
                        Bodyweight fraction (share of bodyweight credited when logged as bodyweight; 0 = none)
                      </span>
                      <input
                        key={`b-${cfg.bodyweightFraction}`}
                        type="number"
                        step="0.05"
                        min="0"
                        max="1.5"
                        defaultValue={cfg.bodyweightFraction}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (e.target.value !== "" && Number.isFinite(v) && v >= 0) update(key, { bodyweightFraction: v });
                        }}
                        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100"
                      />
                    </label>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-neutral-300">
                    <input
                      type="checkbox"
                      checked={cfg.restricted}
                      onChange={(e) => update(key, { restricted: e.target.checked })}
                      className="h-4 w-4 rounded border-neutral-700 bg-neutral-900 accent-sky-500"
                    />
                    PT restricted
                  </label>
                  {cfg.restricted && (
                    <input
                      key={`n-${cfg.restrictionNote ?? ""}`}
                      defaultValue={cfg.restrictionNote ?? ""}
                      onBlur={(e) => update(key, { restrictionNote: e.target.value.trim() })}
                      placeholder="Note, e.g. PT: no hip hinge"
                      className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100"
                    />
                  )}
                  <label className="flex items-center gap-2 text-sm text-neutral-300">
                    <input
                      type="checkbox"
                      checked={cfg.needsPtConfirmation}
                      onChange={(e) => update(key, { needsPtConfirmation: e.target.checked })}
                      className="h-4 w-4 rounded border-neutral-700 bg-neutral-900 accent-amber-500"
                    />
                    Needs PT confirmation
                  </label>

                  {edited && (
                    <button type="button" onClick={() => reset(key)} className="text-xs text-neutral-500 hover:underline">
                      Reset to defaults
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-xs text-neutral-500">No exercises match.</p>}
      </div>
    </div>
  );
}
