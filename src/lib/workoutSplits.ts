// The user's fixed 4-day training split. Used to drive the "choose today's
// workout" picker — exercise names here should match what gets logged so
// "last time" lookups (exact-name match against workout history) find them.
export interface SplitExercise {
  name: string;
  bodyweight?: boolean;
  suggestedWeight?: number; // prefill when there's no history for this exercise yet
  weightHint?: string; // shown next to the weight input, e.g. "35-40 lb"
}

export interface WorkoutSplitDay {
  id: string;
  label: string;
  exercises: SplitExercise[];
}

export const WORKOUT_SPLITS: WorkoutSplitDay[] = [
  {
    id: "day1",
    label: "Day 1 — Posterior Chain",
    exercises: [
      { name: "Trap Bar Deadlift" },
      { name: "Lunges / Split Squats" },
      { name: "Woodchopper" },
      { name: "Core" },
    ],
  },
  {
    id: "day2",
    label: "Day 2 — Upper Pull",
    exercises: [
      { name: "Lat Pulldown" },
      { name: "Cable Row" },
      { name: "Face Pulls" },
      { name: "Curls" },
    ],
  },
  {
    id: "day3",
    label: "Day 3 — Legs/Rotational",
    exercises: [
      { name: "Goblet Squat / Split Squats" },
      { name: "Woodchopper" },
      { name: "Core" },
    ],
  },
  {
    id: "day4",
    label: "Day 4 — Upper Push",
    exercises: [
      { name: "DB Bench Press", suggestedWeight: 35, weightHint: "35-40 lb" },
      { name: "DB Shoulder Press", suggestedWeight: 25, weightHint: "25 lb" },
      { name: "Cable Tricep Work" },
      { name: "Pallof Press" },
    ],
  },
];

// Best-effort "what's next in the rotation" default: find the most recently
// logged exercise, see which split day it belongs to, and suggest the day
// after it. Falls back to Day 1 when history doesn't line up with the split
// (e.g. nothing logged yet, or exercises logged under different names).
export function guessNextSplitDayId(mostRecentExerciseName: string | null): string {
  if (!mostRecentExerciseName) return WORKOUT_SPLITS[0].id;
  const target = mostRecentExerciseName.trim().toLowerCase();
  const lastIndex = WORKOUT_SPLITS.findIndex((day) =>
    day.exercises.some((ex) => ex.name.toLowerCase() === target)
  );
  if (lastIndex === -1) return WORKOUT_SPLITS[0].id;
  return WORKOUT_SPLITS[(lastIndex + 1) % WORKOUT_SPLITS.length].id;
}
