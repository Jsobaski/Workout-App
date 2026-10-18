import { describe, expect, it } from "vitest";
import { proposeMultiplier } from "./multiplierHelper";
import { emptyExerciseSettings } from "./exerciseSettings";
import { WorkoutEntry } from "./types";

const make = (id: string, dateKey: string, exerciseName: string, reps: number, weight: number): WorkoutEntry => ({
  id,
  dateKey,
  timestamp: Date.parse(`${dateKey}T12:00:00`),
  exerciseName,
  muscleGroups: [],
  sets: [{ reps, weight }],
});

describe("multiplier helper (proposal only — never applied automatically)", () => {
  // Mon 2026-10-05 week and Mon 2026-10-12 week
  const entries = [
    make("1", "2026-10-06", "Chest Press Machine", 8, 100),
    make("2", "2026-10-08", "DB Bench Press", 8, 40),
    make("3", "2026-10-13", "Chest Press Machine", 8, 120),
    make("4", "2026-10-15", "DB Bench Press", 8, 60),
  ];

  it("proposes the median ratio of reference to target across same-week pairs", () => {
    const proposal = proposeMultiplier(entries, "chest press machine", "db bench press", { bodyweightLb: 180 })!;
    expect(proposal.weeks).toHaveLength(2);
    expect(proposal.weeks.map((w) => w.weekStart)).toEqual(["2026-10-05", "2026-10-12"]);
    expect(proposal.weeks[0].ratio).toBeCloseTo(40 / 100, 5);
    expect(proposal.weeks[1].ratio).toBeCloseTo(60 / 120, 5);
    expect(proposal.multiplier).toBe(0.45); // median of 0.40 and 0.50
  });

  it("returns null when the two were never logged in the same week", () => {
    const apart = [make("1", "2026-10-06", "Chest Press Machine", 8, 100), make("2", "2026-10-15", "DB Bench Press", 8, 40)];
    expect(proposeMultiplier(apart, "chest press machine", "db bench press")).toBeNull();
    expect(proposeMultiplier([], "chest press machine", "db bench press")).toBeNull();
  });

  it("matches logs under alias names, and uses the reference's own current multiplier", () => {
    const branded = [make("1", "2026-10-06", "Nautilus Leverage Chest Press", 8, 100), make("2", "2026-10-08", "DB Bench Press", 8, 40)];
    expect(proposeMultiplier(branded, "chest press machine", "db bench press")!.multiplier).toBe(0.4);
    const settings = { ...emptyExerciseSettings(), overrides: { "db bench press": { loadMultiplier: 2 } } };
    expect(proposeMultiplier(branded, "chest press machine", "db bench press", { settings })!.multiplier).toBe(0.8);
  });

  it("does nothing by itself: scoring is unchanged until the user accepts", async () => {
    const { computeMuscleEngine } = await import("./muscleEngine");
    const before = computeMuscleEngine(entries, 180, "2026-10-17").statsByGroup.midLowerChest.peak;
    proposeMultiplier(entries, "chest press machine", "db bench press", { bodyweightLb: 180 });
    expect(computeMuscleEngine(entries, 180, "2026-10-17").statsByGroup.midLowerChest.peak).toBe(before);
  });
});
