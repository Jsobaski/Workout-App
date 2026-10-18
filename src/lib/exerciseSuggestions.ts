// Exercise suggestions for a muscle (Focus This Week). Restricted exercises are
// never suggested; the user's per-exercise limits and "confirm first" flags
// travel with each suggestion. With no restrictions set, nothing is filtered or flagged.
import { EXERCISE_MUSCLE_MAP, MuscleContribution, exerciseDisplayName } from "./exerciseMuscleMap";
import { ExerciseSettingsData, resolveConfigForKey } from "./exerciseSettings";
import { SECONDARY_MUSCLE_WEIGHT } from "./muscleScoreConfig";
import { MuscleGroupId } from "./muscleTaxonomy";

export interface SuggestionItem {
  name: string;
  /** User's limit for this exercise, e.g. "2x10". */
  limit?: string;
  needsConfirmation: boolean;
}

export interface MuscleExerciseSuggestions {
  items: SuggestionItem[];
  /** Names only (same order as `items`). */
  suggestions: string[];
  /** Exercises that would have been suggested but are restricted. */
  skippedRestricted: { name: string; note?: string }[];
}

/** Suggested exercises for a muscle — primary contributions first, one entry per canonical movement. */
export function suggestExercisesForMuscle(
  group: MuscleGroupId,
  limit = 3,
  settings?: ExerciseSettingsData
): MuscleExerciseSuggestions {
  const candidates = Object.entries(EXERCISE_MUSCLE_MAP)
    .filter(([, mapping]) => !mapping.hidden)
    .map(([key, mapping]) => ({ key, contribution: mapping.muscles.find((m) => m.group === group) }))
    .filter((c): c is typeof c & { contribution: MuscleContribution } => c.contribution != null && c.contribution.weight >= SECONDARY_MUSCLE_WEIGHT)
    .sort((a, b) => b.contribution.weight - a.contribution.weight);

  const items: SuggestionItem[] = [];
  const skippedRestricted: { name: string; note?: string }[] = [];
  for (const c of candidates) {
    const cfg = resolveConfigForKey(c.key, settings);
    if (!cfg) continue;
    if (cfg.restricted) {
      skippedRestricted.push({ name: exerciseDisplayName(c.key), note: cfg.restrictionNote });
      continue;
    }
    if (items.length < limit) {
      items.push({ name: cfg.displayName, limit: cfg.limit, needsConfirmation: cfg.needsConfirmation });
    }
  }
  return { items, suggestions: items.map((i) => i.name), skippedRestricted };
}

export function exercisesForMuscle(group: MuscleGroupId, limit = 3, settings?: ExerciseSettingsData): string[] {
  return suggestExercisesForMuscle(group, limit, settings).suggestions;
}
