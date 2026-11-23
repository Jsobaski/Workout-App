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

import { formatWorkoutText } from "./shareText";
import { STANDARDS_VERSION } from "./muscleScoreConfig";
const sets = (n: number, reps: number, weight: number) => Array.from({ length: n }, () => ({ reps, weight }));
const make = (id: string, dateKey: string, exerciseName: string, s: WorkoutEntry["sets"], extra: Partial<WorkoutEntry> = {}): WorkoutEntry => ({
  id, dateKey, timestamp: Date.parse(`${dateKey}T12:00:00`), exerciseName, muscleGroups: [], sets: s, ...extra,
});

describe("export explains itself", () => {
  const ASOF = "2026-11-20";
  const entries = [
    make("a", "2026-09-14", "Trap Bar Deadlift", sets(3, 5, 245)),
    make("b", "2026-09-21", "Trap Bar Deadlift", sets(3, 5, 245)),
    make("c", "2026-11-12", "Back Extension", sets(3, 10, 150)),
    make("d", "2026-11-17", "Back Extension", sets(3, 10, 150)),
  ];
  const result = computeMuscleEngine(entries, 205, ASOF);
  const text = formatMuscleSummaryText({
    asOfDateKey: ASOF, bodyweightLb: 205, result,
    deltaByGroup: compareSnapshots(computeMuscleEngine(entries, 205, "2026-10-20").statsByGroup, result.statsByGroup), entries,
  });

  it("has a scoring rules block with the taper, decay, floor and standards version", () => {
    expect(text).toContain("Scoring rules");
    expect(text).toContain(`standards version ${STANDARDS_VERSION}`);
    expect(text).toMatch(/reps 11-12 count 50% each, reps above 12 add nothing/);
    expect(text).toMatch(/after the work that earned it, then fades toward a floor of 70% of its peak/);
  });

  it("says when each muscle's best lift was last done, and names the decayed lift when another now leads", () => {
    const lowerBack = text.split("\n").find((l) => l.startsWith("- Lower Back"))!;
    expect(lowerBack).toMatch(/best: Back Extension ~\d+ lb e1RM \(last done Nov 17\); Trap Bar Deadlift last done Sep 21, decayed/);
    const chest = formatMuscleSummaryText({
      asOfDateKey: ASOF, bodyweightLb: 205,
      result: computeMuscleEngine([make("x", "2026-11-18", "Bench Press", sets(3, 5, 185))], 205, ASOF),
      deltaByGroup: compareSnapshots(computeMuscleEngine([], 205, "2026-10-20").statsByGroup, computeMuscleEngine([make("x", "2026-11-18", "Bench Press", sets(3, 5, 185))], 205, ASOF).statsByGroup),
      entries: [],
    });
    expect(chest).toMatch(/best: Bench Press ~\d+ lb e1RM \(last done Nov 18\)(,|$)/m);
    expect(chest).not.toMatch(/Bench Press[^\n]*decayed/);
  });

  it("splits workout totals into loaded volume and bodyweight credit", () => {
    const day = [
      make("p", "2026-11-18", "Bench Press", sets(3, 10, 100)),
      make("q", "2026-11-18", "Pull-Up", sets(3, 8, 0), { bodyweight: true }),
    ];
    const t = formatWorkoutText("2026-11-18", day, { bodyweightLb: 200 });
    expect(t).toMatch(/Total volume: 3,000 lb loaded \+ [\d,]+ lb bodyweight credit/);
    const plain = formatWorkoutText("2026-11-18", [day[0]], { bodyweightLb: 200 });
    expect(plain).toContain("Total volume: 3,000 lb");
    expect(plain).not.toContain("bodyweight credit");
  });
});
