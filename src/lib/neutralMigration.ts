// One-time migration for devices that installed an earlier release: those
// releases shipped personal defaults (restricted exercises, "needs
// confirmation" flags, sport-specific priority muscles, a pre-filled coaching
// context). The library is neutral now, so an existing device (one with logged
// data) is shown what used to be on and chooses to keep it as LOCAL settings or
// clear it. New installs see nothing. The choice is remembered. Pure logic only —
// the DB-facing wrapper is in migrationService.ts.
import { exerciseDisplayName } from "./exerciseMuscleMap";
import { ExerciseSettingsData } from "./exerciseSettings";
import {
  LEGACY_CONFIRMATION_DEFAULTS,
  LEGACY_COACHING_CONTEXT,
  LEGACY_PRIORITY_MUSCLES,
  LEGACY_RESTRICTED_DEFAULTS,
} from "./legacyDefaults";
import { MUSCLE_GROUPS } from "./muscleTaxonomy";

export type MigrationChoice = "kept" | "cleared" | "not-needed";

/** Persisted in the settings store; one field per migration. */
export interface MigrationsRecord {
  key: "migrations";
  neutralDefaultsV1?: MigrationChoice;
}

export type MigrationDecision = "done" | "mark-not-needed" | "prompt";

export function decideNeutralMigration(state: { recorded?: MigrationChoice; hasLoggedData: boolean }): MigrationDecision {
  if (state.recorded) return "done";
  return state.hasLoggedData ? "prompt" : "mark-not-needed";
}

export interface LegacyDefaultsSummary {
  restrictedExercises: { name: string; note: string }[];
  confirmationExercises: string[];
  priorityMuscles: string[];
  /** Present only when this device never saved a coaching context (it was showing the old pre-filled one). */
  coaching?: { goals: string; injuryNotes: string; nutrition: string };
}

export function describeLegacyDefaults(opts: { coachingContextStored: boolean }): LegacyDefaultsSummary {
  const ctx = LEGACY_COACHING_CONTEXT;
  return {
    restrictedExercises: LEGACY_RESTRICTED_DEFAULTS.map((d) => ({ name: exerciseDisplayName(d.key), note: d.note })),
    confirmationExercises: LEGACY_CONFIRMATION_DEFAULTS.map(exerciseDisplayName),
    priorityMuscles: LEGACY_PRIORITY_MUSCLES.map((id) => MUSCLE_GROUPS.find((g) => g.id === id)!.label),
    coaching: opts.coachingContextStored
      ? undefined
      : {
          goals: ctx.goals,
          injuryNotes: ctx.injuryNotes,
          nutrition: `${ctx.calorieTargetLow}-${ctx.calorieTargetHigh} kcal, ${ctx.proteinTargetG} g protein`,
        },
  };
}

/**
 * "Keep these": writes the old defaults into this device's local settings. Anything the
 * user already set on this device wins — an explicit override, including an
 * explicit "allowed", is never replaced.
 */
export function applyKeepLegacyDefaults(current: ExerciseSettingsData): ExerciseSettingsData {
  const overrides = { ...current.overrides };
  for (const d of LEGACY_RESTRICTED_DEFAULTS) {
    const existing = overrides[d.key] ?? {};
    if (existing.restricted !== undefined) continue;
    overrides[d.key] = { ...existing, restricted: true, restrictionNote: existing.restrictionNote ?? d.note };
  }
  for (const key of LEGACY_CONFIRMATION_DEFAULTS) {
    const existing = overrides[key] ?? {};
    if (existing.needsConfirmation !== undefined) continue;
    overrides[key] = { ...existing, needsConfirmation: true };
  }
  const focus = new Set(current.focusMuscles);
  for (const id of LEGACY_PRIORITY_MUSCLES) focus.add(id);
  return { overrides, patterns: current.patterns, focusMuscles: Array.from(focus) };
}
