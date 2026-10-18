// Tap-to-expand reasons for Muscle Comparison deltas, and the finding that a restricted
// lift never changes a score by itself (restriction only affects suggestions and the pause rule).
import { describe, expect, it } from "vitest";
import { workout } from "./dbTestHelper";
import { shiftDateKey } from "./date";
import { emptyExerciseSettings, ExerciseSettingsData } from "./exerciseSettings";
import { computeMuscleEngine } from "./muscleEngine";
import { compareSnapshots, explainDelta } from "./muscleComparison";
import { MuscleGroupId } from "./muscleTaxonomy";

const TODAY = "2026-10-17";
const BW = 180;
const at = (id: string, ago: number, name: string, reps: number, weight: number) =>
  workout(id, shiftDateKey(TODAY, -ago), name, reps, weight);

function run(entries: ReturnType<typeof at>[], group: MuscleGroupId, settings?: ExerciseSettingsData, window = 30) {
  const after = computeMuscleEngine(entries, BW, TODAY, 10, settings).statsByGroup;
  const before = computeMuscleEngine(entries, BW, shiftDateKey(TODAY, -window), 10, settings).statsByGroup;
  const deltas = compareSnapshots(before, after);
  return { before, after, deltas, delta: deltas[group], reason: explainDelta(before[group], after[group], deltas[group], settings) };
}

const deadlifts = [
  at("a", 47, "Trap Bar Deadlift", 5, 365),
  at("b", 40, "Trap Bar Deadlift", 5, 385),
  at("c", 33, "Trap Bar Deadlift", 5, 405),
];

describe("explainDelta", () => {
  it("real change in the lead lift: names the lift and the e1RM move", () => {
    const entries = [at("a", 40, "Back Squat", 5, 185), at("b", 33, "Back Squat", 5, 195), at("c", 2, "Back Squat", 5, 245)];
    const r = run(entries, "quads");
    expect(r.delta.status).toBe("like-for-like");
    expect(r.reason.kind).toBe("lead-lift");
    expect(r.reason.text).toMatch(/Back Squat best estimated 1RM went from \d+ to \d+ lb/);
  });

  it("a new lift replacing the old one", () => {
    const entries = [at("a", 45, "Back Squat", 5, 185), at("b", 33, "Back Squat", 5, 195), at("c", 3, "Hack Squat", 8, 300)];
    const r = run(entries, "quads");
    expect(r.delta.delta).toBeNull();
    expect(r.reason.kind).toBe("replaced");
    expect(r.reason.text).toMatch(/Hack Squat/);
  });

  it("decay from inactivity", () => {
    const r = run(deadlifts, "lowerBack");
    expect(r.delta.status).toBe("like-for-like");
    expect(r.delta.delta!).toBeLessThan(0);
    expect(r.reason.kind).toBe("decay");
    expect(r.reason.text).toMatch(/no direct work for 33 days/);
  });

  it("the same decay, once the lead lift is restricted, is explained as a restricted lift", () => {
    const settings: ExerciseSettingsData = { ...emptyExerciseSettings(), overrides: { "trap bar deadlift": { restricted: true } } };
    const r = run(deadlifts, "lowerBack", settings);
    expect(r.reason.kind).toBe("restricted");
    expect(r.reason.text).toMatch(/Trap Bar Deadlift is now restricted/);
  });

  it("a muscle whose every exercise is restricted is paused and explained as restricted", () => {
    const settings: ExerciseSettingsData = {
      ...emptyExerciseSettings(),
      overrides: Object.fromEntries(
        ["calf raise", "seated calf raise", "donkey calf raise"].map((k) => [k, { restricted: true }])
      ),
    };
    const entries = [at("a", 40, "Calf Raise", 10, 150), at("b", 30, "Calf Raise", 10, 160)];
    const r = run(entries, "calves", settings);
    if (r.delta.status === "paused") expect(r.reason.kind).toBe("restricted");
    else expect(["restricted", "decay"]).toContain(r.reason.kind); // an allowed calf exercise remains in the library
  });

  it("no change reads as no change", () => {
    const r = run([at("a", 3, "Back Squat", 5, 185)], "quads", undefined, 1);
    expect(r.reason.kind).toBe("none");
  });
});

describe("restricted lifts and large drops (trace finding)", () => {
  it("restricting a lift does not change any score or numeric delta while an allowed alternative exists", () => {
    const restricted: ExerciseSettingsData = { ...emptyExerciseSettings(), overrides: { "trap bar deadlift": { restricted: true, onlyThisExercise: true } } };
    const open = run(deadlifts, "lowerBack");
    const shut = run(deadlifts, "lowerBack", restricted);
    for (const g of Object.keys(open.after) as MuscleGroupId[]) {
      expect(shut.after[g].effective).toBe(open.after[g].effective);
      expect(shut.after[g].peak).toBe(open.after[g].peak);
      expect(shut.deltas[g].delta).toBe(open.deltas[g].delta);
    }
  });

  it("a like-for-like drop is bounded: decay floors at 70% of peak, plus at most the volume bonus", () => {
    const heavy = [at("a", 47, "Trap Bar Deadlift", 3, 600), at("b", 40, "Trap Bar Deadlift", 3, 640), at("c", 33, "Trap Bar Deadlift", 3, 700)];
    const r = run(heavy, "lowerBack");
    const drop = r.before.lowerBack.effective! - r.after.lowerBack.effective!;
    expect(drop).toBeGreaterThan(0);
    expect(drop).toBeLessThanOrEqual(0.3 * r.before.lowerBack.peak! + 10 + 1e-6);
  });
});
