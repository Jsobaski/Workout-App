// Defaults that earlier releases shipped for everyone. They are NOT applied
// anywhere any more — the shared library and coaching context are neutral. This
// module exists only so the one-time "neutral defaults" notice (see
// neutralMigration.ts) can show an existing device what used to be on by default
// and let its owner keep them as local settings. Safe to delete once enough
// releases have passed.
import type { MuscleGroupId } from "./muscleTaxonomy";
import type { CoachingContext } from "./types";

/** Canonical exercise keys that used to be restricted by default, with the note that was shown. */
export const LEGACY_RESTRICTED_DEFAULTS: { key: string; note: string }[] = [
  { key: "trap bar deadlift", note: "PT: no hip hinge" },
  { key: "romanian deadlift", note: "PT: no hip hinge" },
  { key: "db romanian deadlift", note: "PT: no hip hinge" },
  { key: "db bulgarian split squat", note: "PT restricted" },
  { key: "standing cable woodchopper (high-to-low)", note: "PT restricted" },
  { key: "standing cable woodchopper (low-to-high)", note: "PT restricted" },
  { key: "landmine rotational press", note: "PT restricted" },
  { key: "goblet squat", note: "Self-restricted" },
];

/** Exercises that used to carry a "needs confirmation" flag by default. */
export const LEGACY_CONFIRMATION_DEFAULTS: string[] = ["pallof press", "back extension"];

/** Muscles that used to get a sport-specific focus bonus by default. */
export const LEGACY_PRIORITY_MUSCLES: MuscleGroupId[] = ["forearms", "abs", "obliques", "glutes", "lats"];

/** The coaching context a device showed when the user had never saved one. */
export const LEGACY_COACHING_CONTEXT: CoachingContext = {
  key: "coachingContext",
  goals:
    "Body recomposition (build muscle, lose fat). Improve rotational/hip power for golf swing. Improve hip internal rotation to fix early extension in swing.",
  ageRange: "",
  heightIn: null,
  currentWeightLb: null,
  activityLevel: "",
  trainingFrequencyTarget: null,
  calorieTargetLow: 2100,
  calorieTargetHigh: 2300,
  proteinTargetG: 175,
  injuryNotes:
    "Neck sensitivity during Pallof press and other anti-rotation core work — watch shoulder/neck tension cues.",
};
