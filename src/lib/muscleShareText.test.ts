import { describe, expect, it } from "vitest";
import { computeMuscleEngine } from "./muscleEngine";
import { compareSnapshots } from "./muscleComparison";
import { formatMuscleSummaryText } from "./muscleShareText";
import { WorkoutEntry } from "./types";

const entry = (id: string, dateKey: string, exerciseName: string, weight: number): WorkoutEntry => ({
  id,
  dateKey,
  timestamp: Date.parse(dateKey),
  exerciseName,
  muscleGroups: [],
  sets: [{ reps: 5, weight }],
});

describe("formatMuscleSummaryText", () => {
  const entries = [entry("1", "2026-10-10", "Bench Press", 135), entry("2", "2026-10-12", "Mystery Machine", 50)];
  const result = computeMuscleEngine(entries, 180, "2026-10-14");
  const earlier = computeMuscleEngine(entries, 180, "2026-09-14");
  const text = formatMuscleSummaryText({
    asOfDateKey: "2026-10-14",
    bodyweightLb: 180,
    result,
    deltaByGroup: compareSnapshots(earlier.statsByGroup, result.statsByGroup),
    entries,
  });

  it("lists scored muscles with tier and score, and untrained ones as no data", () => {
    expect(text).toMatch(/- Mid\/Lower Chest: \w[\w ]* \(\d+(\.\d)?\)/);
    expect(text).toContain("- Calves: no data logged");
  });

  it("calls out unmapped exercises and includes recent workouts", () => {
    expect(text).toContain("unmapped exercises): Mystery Machine");
    expect(text).toContain("Bench Press: 5×135lb");
  });
});

import { formatNutritionText } from "./shareText";
describe("formatNutritionText", () => {
  it("lists entries, totals and targets", () => {
    const text = formatNutritionText(
      "2026-10-19",
      [{ id: "1", dateKey: "2026-10-19", timestamp: Date.parse("2026-10-19T12:00:00"), itemName: "Chicken bowl", calories: 650, proteinG: 45, source: "typed" }],
      { calories: 650, proteinG: 45 },
      { calories: [2000, 2200], proteinG: 150 }
    );
    expect(text).toContain("Chicken bowl: 650 kcal, 45g protein");
    expect(text).toContain("Total: 650 kcal, 45g protein");
    expect(text).toContain("Calorie target: 2000-2200 kcal");
    expect(text).toContain("Protein target: 150g");
    expect(formatNutritionText("2026-10-19", [], { calories: 0, proteinG: 0 })).toContain("No food logged.");
  });
});
