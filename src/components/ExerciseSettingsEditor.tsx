"use client";

import { useMemo, useState } from "react";
import { EXERCISE_MUSCLE_MAP, LOAD_BASIS_LABELS, LoadBasis, canonicalExerciseKey } from "@/lib/exerciseMuscleMap";
import {
  ExerciseSettingOverride,
  ExerciseSettingsData,
  resolveConfigForKey,
} from "@/lib/exerciseSettings";
import { MultiplierProposal, describePairedWeek, displayNameForKey, proposeMultiplier } from "@/lib/multiplierHelper";
import { parseLimit } from "@/lib/limits";
import { WorkoutEntry } from "@/lib/types";

const BASIS_KEYS = Object.keys(LOAD_BASIS_LABELS) as LoadBasis[];

type RestrictionChoice = "inherit" | "restricted" | "allowed";

// Editable per-exercise settings: manual load multiplier (+ an optional helper
// that proposes one from same-week paired logs), informational load basis,
// bodyweight fraction, restriction (follow default / restricted / allowed
// anyway), a limit like "2x10", and a "confirm first" flag. Overrides are
// stored sparsely — only what differs from the neutral defaults — and saved
// immediately to this device.
export default function ExerciseSettingsEditor({
  settings,
  onChange,
  entries,
  bodyweightLb,
}: {
  settings: ExerciseSettingsData;
  onChange: (next: ExerciseSettingsData) => void;
  entries: WorkoutEntry[];
  bodyweightLb: number | null;
}) {
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [referenceKey, setReferenceKey] = useState("");
  const [proposal, setProposal] = useState<{ forKey: string; result: MultiplierProposal | null } | null>(null);

  const keys = useMemo(
    () =>
      Object.keys(EXERCISE_MUSCLE_MAP)
        .filter((k) => !EXERCISE_MUSCLE_MAP[k].hidden)
        .sort((a, b) => a.localeCompare(b)),
    []
  );
  const loggedKeys = useMemo(() => {
    const seen = new Set<string>();
    for (const e of entries) {
      const k = canonicalExerciseKey(e.exerciseName);
      if (k) seen.add(k);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const filtered = keys.filter((k) => k.includes(query.trim().toLowerCase()));

  function update(key: string, patch: Partial<Record<keyof ExerciseSettingOverride, unknown>>) {
    const merged: Record<string, unknown> = { ...settings.overrides[key], ...patch };
    for (const field of Object.keys(merged)) {
      const v = merged[field];
      if (v === undefined || v === "" || v === null) delete merged[field];
    }
    // Sparse: drop values equal to the neutral defaults.
    const defaults = resolveConfigForKey(key);
    if (defaults) {
      if (merged.loadMultiplier === defaults.loadMultiplier) delete merged.loadMultiplier;
      if (merged.bodyweightFraction === defaults.bodyweightFraction) delete merged.bodyweightFraction;
      if (merged.loadBasis === defaults.loadBasis) delete merged.loadBasis;
      if (merged.needsConfirmation === false) delete merged.needsConfirmation;
    }
    const overrides = { ...settings.overrides };
    if (Object.keys(merged).length === 0) delete overrides[key];
    else overrides[key] = merged as ExerciseSettingOverride;
    onChange({ ...settings, overrides });
  }

  function reset(key: string) {
    const overrides = { ...settings.overrides };
    delete overrides[key];
    onChange({ ...settings, overrides });
    setProposal(null);
  }

  function setRestriction(key: string, choice: RestrictionChoice) {
    if (choice === "inherit") update(key, { restricted: undefined, restrictionNote: undefined });
    else if (choice === "restricted") update(key, { restricted: true });
    else update(key, { restricted: false, restrictionNote: undefined });
  }

  function runHelper(key: string) {
    if (!referenceKey) return;
    setProposal({ forKey: key, result: proposeMultiplier(entries, key, referenceKey, { bodyweightLb, settings }) });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">
        Everything here is optional and stored only on this device. Effective load = logged weight × multiplier
        (default 1.0 for every exercise; nothing adjusts it automatically). Restricted exercises are never suggested,
        and a limit like 2x10 caps suggested sets and reps.
      </p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search exercises"
        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
      />
      <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
        {filtered.map((key) => {
          const cfg = resolveConfigForKey(key, settings)!;
          const override = settings.overrides[key];
          const isOpen = openKey === key;
          const edited = override != null;
          const choice: RestrictionChoice = override?.restricted === true ? "restricted" : override?.restricted === false ? "allowed" : "inherit";
          return (
            <div key={key} className="rounded-lg border border-neutral-800 bg-neutral-900/50">
              <button
                type="button"
                onClick={() => {
                  setOpenKey(isOpen ? null : key);
                  setProposal(null);
                  setReferenceKey("");
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-neutral-200">{cfg.displayName}</span>
                <span className="flex shrink-0 items-center gap-1.5 text-[10px]">
                  {cfg.restricted && (
                    <span className="rounded-full bg-sky-950 px-2 py-0.5 text-sky-300">
                      restricted{cfg.restrictionSource === "pattern" ? " (pattern)" : ""}
                    </span>
                  )}
                  {!cfg.restricted && cfg.limit && (
                    <span className="rounded-full bg-violet-950 px-2 py-0.5 text-violet-300">limit {cfg.limit}</span>
                  )}
                  {!cfg.restricted && cfg.needsConfirmation && (
                    <span className="rounded-full bg-amber-950 px-2 py-0.5 text-amber-300">confirm</span>
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
                      <span className="mb-1 block text-xs text-neutral-500">Logged weight is… (label only)</span>
                      <select
                        value={cfg.loadBasis}
                        onChange={(e) => update(key, { loadBasis: e.target.value })}
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

                  <div className="space-y-2 rounded-md bg-neutral-900 p-2">
                    <p className="text-xs font-medium text-neutral-400">Suggest a multiplier from paired logs (optional)</p>
                    <p className="text-[11px] text-neutral-500">
                      Pick an exercise you logged in the same weeks. The helper compares best estimated 1RMs per week and
                      proposes a multiplier for this one — you decide whether to use it.
                    </p>
                    <div className="flex gap-2">
                      <select
                        value={referenceKey}
                        onChange={(e) => {
                          setReferenceKey(e.target.value);
                          setProposal(null);
                        }}
                        className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-100"
                      >
                        <option value="">Compare with…</option>
                        {loggedKeys
                          .filter((k) => k !== key)
                          .map((k) => (
                            <option key={k} value={k}>
                              {displayNameForKey(k)}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        disabled={!referenceKey}
                        onClick={() => runHelper(key)}
                        className="shrink-0 rounded-md border border-emerald-700 px-3 py-1.5 text-xs text-emerald-400 disabled:opacity-40"
                      >
                        Suggest
                      </button>
                    </div>
                    {proposal?.forKey === key && proposal.result == null && (
                      <p className="text-xs text-amber-300">
                        No weeks where both were logged, so there&apos;s nothing to compare yet.
                      </p>
                    )}
                    {proposal?.forKey === key && proposal.result && (
                      <div className="space-y-1.5 text-xs text-neutral-300">
                        <p>
                          Proposed multiplier{" "}
                          <span className="font-semibold text-emerald-400">×{proposal.result.multiplier}</span> from{" "}
                          {proposal.result.weeks.length} paired week{proposal.result.weeks.length === 1 ? "" : "s"}:
                        </p>
                        <ul className="space-y-0.5 text-[11px] text-neutral-500">
                          {proposal.result.weeks.map((w) => (
                            <li key={w.weekStart}>
                              {describePairedWeek(w)}: this {Math.round(w.targetE1RM)} vs {displayNameForKey(referenceKey)}{" "}
                              {Math.round(w.referenceE1RM)} → ×{w.ratio.toFixed(2)}
                            </li>
                          ))}
                        </ul>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              update(key, { loadMultiplier: proposal.result!.multiplier });
                              setProposal(null);
                            }}
                            className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => setProposal(null)}
                            className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-300"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-xs text-neutral-500">Restriction</span>
                    <select
                      value={choice}
                      onChange={(e) => setRestriction(key, e.target.value as RestrictionChoice)}
                      className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100"
                    >
                      <option value="inherit">
                        Follow my settings{cfg.restrictionSource === "pattern" ? " (restricted by pattern)" : " (not restricted)"}
                      </option>
                      <option value="restricted">Restricted — never suggest</option>
                      <option value="allowed">Allowed anyway (overrides a restricted pattern)</option>
                    </select>
                  </label>
                  {(choice === "restricted" || cfg.restrictionSource === "pattern") && (
                    <input
                      key={`n-${cfg.restrictionNote ?? ""}`}
                      defaultValue={override?.restrictionNote ?? ""}
                      onBlur={(e) => update(key, { restrictionNote: e.target.value.trim() })}
                      placeholder="Note (optional)"
                      className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100"
                    />
                  )}
                  {!cfg.restricted && (
                    <label className="block">
                      <span className="mb-1 block text-xs text-neutral-500">Limit (optional, e.g. 2x10 — sets × reps)</span>
                      <input
                        key={`l-${override?.limit ?? ""}`}
                        defaultValue={override?.limit ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          update(key, { limit: v === "" || parseLimit(v) ? v : override?.limit });
                        }}
                        placeholder="e.g. 2x10"
                        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100"
                      />
                    </label>
                  )}
                  <label className="flex items-center gap-2 text-sm text-neutral-300">
                    <input
                      type="checkbox"
                      checked={cfg.needsConfirmation}
                      onChange={(e) => update(key, { needsConfirmation: e.target.checked })}
                      className="h-4 w-4 rounded border-neutral-700 bg-neutral-900 accent-amber-500"
                    />
                    Flag as &quot;confirm first&quot; when suggested
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
