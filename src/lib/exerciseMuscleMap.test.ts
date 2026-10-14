import { describe, expect, it } from "vitest";
import { exercisesForMuscle, lookupExerciseMapping } from "./exerciseMuscleMap";

// Exact exercise names from a real user bug report: these showed up in the
// "needs mapping" banner despite representing real training — either the
// old generic split placeholder names (Core/Curls/Woodchopper/Cable Tricep
// Work, from before the split was renamed to specific exercises) or real
// gym equipment/variant names that were never in the mapping table.
const userLoggedNames = [
  "Cable Face pulls",
  "Cable Tricep Work",
  "Captain chair knee raises",
  "Chest Press - Nautilus Machine",
  "Core",
  "Curls",
  "DB Overhead Tricep extension",
  "Deltoid raise machine",
  "Face Pulls",
  "Landmine Rotational Press",
  "Nautilus Impact Tricep Extension",
  "Nautilus Leverage Chest press",
  "Nautilus Leverage Incline Chest press",
  "Nautilus impact bicep curl",
  "Nautilus impact rear deltoid machine",
  "Romanian Deadlift straight bar",
  "Shoulder Press machine",
  "Single Arm Cable Tricep Extension",
  "Standing Cable Woodchoppers (high to low)",
  "Standing Calf",
  "Woodchopper",
];

describe("real-world unmapped names from user report", () => {
  for (const name of userLoggedNames) {
    it(`resolves "${name}"`, () => {
      expect(lookupExerciseMapping(name)).not.toBeNull();
    });
  }
});

describe("legacy split placeholder names", () => {
  it("scores but never gets suggested as a new exercise to do", () => {
    const suggestions = exercisesForMuscle("abs", 10);
    expect(suggestions).not.toContain("Core");
    expect(suggestions).not.toContain("Woodchopper");
  });

  it("the apostrophe-free and apostrophe'd Captain's Chair variants both resolve", () => {
    expect(lookupExerciseMapping("Captain's Chair Knee Raises")).not.toBeNull();
    expect(lookupExerciseMapping("Captain chair knee raises")).not.toBeNull();
  });
});
