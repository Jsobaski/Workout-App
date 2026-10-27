// Suggestions that adapt to the user's own history, equipment and limits.
import { describe, expect, it } from "vitest";
import { workout } from "./dbTestHelper";
import { shiftDateKey } from "./date";
import { emptyExerciseSettings, ExerciseSettingsData } from "./exerciseSettings";
import { buildExerciseHistory } from "./exerciseHistory";
import {
  DEFAULT_REP_CEILING,
  inferIncrement,
  inferRepCeiling,
  loggedWeightsForGroup,
  suggestNextSets,
} from "./setSuggestions";
import { WorkoutEntry } from "./types";

const TODAY = "2026-10-27";
const session = (id: string, ago: number, name: string, setList: [number, number][]): WorkoutEntry => ({
  ...workout(id, shiftDateKey(TODAY, -ago), name, 1, 1),
  sets: setList.map(([reps, weight]) => ({ reps, weight })),
});
const run = (entries: WorkoutEntry[], name: string, settings?: ExerciseSettingsData) =>
  suggestNextSets(buildExerciseHistory(entries, name), TODAY, { settings, loggedWeights: loggedWeightsForGroup(entries, name, settings) });
const shape = (s: ReturnType<typeof run>) => s!.sets.map((x) => [x.reps, x.weight]);

describe("A. rep ceiling from the user's own history", () => {
  const legExt = (n: number, weight = 90) =>
    Array.from({ length: n }, (_, i) => session(`l${i}`, 4 + (n - 1 - i) * 3, "Leg Extension", [[15, weight], [15, weight], [15, weight]]));

  it("a lift consistently done at 15 reps is not told to drop to 8 reps", () => {
    const s = run(legExt(4), "Leg Extension")!;
    expect(inferRepCeiling(buildExerciseHistory(legExt(4), "Leg Extension")!.sessions)).toEqual({ ceiling: 15, learned: true });
    expect(s.kind).toBe("add-weight");
    expect(s.sets.every((x) => x.reps === 10)).toBe(true); // two-thirds of 15, not 8
    expect(s.sets.every((x) => x.reps !== 8)).toBe(true);
  });

  it("below the learned ceiling it adds a rep, even past the old 12 cap", () => {
    const entries = [...legExt(3), session("n", 1, "Leg Extension", [[14, 90], [14, 90], [14, 90]])];
    // plateau at 15 for three sessions then a lighter 14: still learned ceiling 15
    const s = run(entries, "Leg Extension")!;
    expect(s.kind).toBe("add-rep");
    expect(shape(s)).toEqual([[15, 90], [15, 90], [15, 90]]);
  });

  it("a lift with no (or too little) history behaves as before: ceiling 12, restart at 8", () => {
    expect(inferRepCeiling([])).toEqual({ ceiling: DEFAULT_REP_CEILING, learned: false });
    const one = run([session("a", 3, "Lat Pulldown", [[12, 100], [12, 100], [12, 100]])], "Lat Pulldown")!;
    expect(one.kind).toBe("add-weight");
    expect(shape(one)).toEqual([[8, 105], [8, 105], [8, 105]]);
    const two = run([session("a", 8, "Lat Pulldown", [[12, 100]]), session("b", 3, "Lat Pulldown", [[10, 100], [10, 100]])], "Lat Pulldown")!;
    expect(two.kind).toBe("add-rep");
    expect(shape(two)).toEqual([[11, 100], [11, 100]]);
  });

  it("a user climbing 8, 9, 10 at one weight is not given a premature ceiling", () => {
    const climbing = [8, 9, 10].map((r, i) => session(`c${i}`, 12 - i * 4, "Cable Row", [[r, 100], [r, 100]]));
    expect(inferRepCeiling(buildExerciseHistory(climbing, "Cable Row")!.sessions).ceiling).toBe(DEFAULT_REP_CEILING);
  });

  it("learns a low ceiling from where they actually add weight (5x5), restarting at 5 at the least", () => {
    const strength = [
      session("a", 21, "Bench Press", [[5, 135], [5, 135], [5, 135]]),
      session("b", 14, "Bench Press", [[5, 140], [5, 140], [5, 140]]),
      session("c", 7, "Bench Press", [[5, 145], [5, 145], [5, 145]]),
    ];
    expect(inferRepCeiling(buildExerciseHistory(strength, "Bench Press")!.sessions)).toEqual({ ceiling: 5, learned: true });
    const s = run(strength, "Bench Press")!;
    expect(s.kind).toBe("add-weight");
    expect(shape(s)).toEqual([[5, 150], [5, 150], [5, 150]]);
  });

  it("learns 12 from a classic cycle (adds weight right after reaching 12)", () => {
    const cycle = [
      session("a", 40, "Cable Curl", [[8, 20], [8, 20]]),
      session("b", 33, "Cable Curl", [[10, 20], [10, 20]]),
      session("c", 26, "Cable Curl", [[12, 20], [12, 20]]),
      session("d", 19, "Cable Curl", [[8, 25], [8, 25]]),
      session("e", 12, "Cable Curl", [[10, 25], [10, 25]]),
    ];
    expect(inferRepCeiling(buildExerciseHistory(cycle, "Cable Curl")!.sessions).ceiling).toBe(12);
  });
});

describe("B. weight increments from the user's own history", () => {
  const stepHistory = (name: string, weights: number[], reps = 12) =>
    weights.map((w, i) => session(`${name}${i}`, 3 + (weights.length - 1 - i) * 7, name, [[reps, w], [reps, w]]));

  it("a plate-loaded lift logged in 20 lb steps suggests +20 lb", () => {
    const entries = stepHistory("Hack Squat", [100, 120, 140, 160]);
    expect(inferIncrement([100, 120, 140, 160])).toBe(20);
    const s = run(entries, "Hack Squat")!;
    expect(s.kind).toBe("add-weight");
    expect(s.sets[0].weight).toBe(180);
  });

  it("a stack logged in 5 lb steps suggests +5 lb, and a 2.5 lb history still suggests +2.5", () => {
    expect(run(stepHistory("Leg Extension", [70, 75, 80, 85]), "Leg Extension")!.sets[0].weight).toBe(90);
    const light = run(stepHistory("Lateral Raise", [10, 12.5, 15, 17.5]), "Lateral Raise")!;
    expect(light.sets[0].weight).toBe(20);
  });

  it("falls back to the 2.5 / 5 lb rule with too little history, and ignores an odd one-off gap", () => {
    expect(inferIncrement([100, 120])).toBeNull();
    expect(inferIncrement([])).toBeNull();
    const single = run([session("a", 3, "Lateral Raise", [[12, 15], [12, 15]])], "Lateral Raise")!;
    expect(single.sets[0].weight).toBe(17.5);
    const heavy = run([session("a", 3, "Back Squat", [[12, 225], [12, 225]])], "Back Squat")!;
    expect(heavy.sets[0].weight).toBe(230);
    expect(inferIncrement([100, 120, 140, 160, 180, 187.5])).toBe(20); // 7.5 gap is 1 of 5 gaps
  });

  it("also learns from grouped variants of the same lift", () => {
    const entries = [
      ...stepHistory("Lying Leg Curl", [100, 120], 12),
      session("v", 2, "Seated Leg Curl", [[12, 140], [12, 140]]), // grouped variant (same primary muscle, stack-loaded)
    ];
    const weights = loggedWeightsForGroup(entries, "Lying Leg Curl");
    expect(new Set(weights)).toEqual(new Set([100, 120, 140]));
    expect(inferIncrement(weights)).toBe(20);
  });

  it("never suggests a lighter working weight than last time, except after a long break (which stays on the equipment's steps)", () => {
    const entries = stepHistory("Hack Squat", [100, 120, 140, 160], 9);
    const s = run(entries, "Hack Squat")!;
    expect(Math.min(...s.sets.map((x) => x.weight))).toBeGreaterThanOrEqual(160);
    const longAgo = stepHistory("Hack Squat", [100, 120, 140, 160], 9).map((e, i) => ({ ...e, dateKey: shiftDateKey(TODAY, -(60 + (3 - i) * 7)) }));
    const back = run(longAgo, "Hack Squat")!;
    expect(back.kind).toBe("ease-back");
    expect(back.sets[0].weight).toBe(140); // one 20 lb step down, not 144
  });
});

describe("C. restrictions and limits", () => {
  const entries = (name: string, setList: [number, number][]) => [session("a", 10, name, setList), session("b", 3, name, setList)];

  it("a restricted exercise (own restriction or pattern) shows no suggestion", () => {
    const own: ExerciseSettingsData = { ...emptyExerciseSettings(), overrides: { "leg extension": { restricted: true } } };
    expect(run(entries("Leg Extension", [[10, 90], [10, 90]]), "Leg Extension", own)).toBeNull();
    const pattern: ExerciseSettingsData = { ...emptyExerciseSettings(), patterns: { hip_hinge: {} } };
    expect(run(entries("Romanian Deadlift", [[8, 135]]), "Romanian Deadlift", pattern)).toBeNull();
    // Unrestricted: still suggests.
    expect(run(entries("Leg Extension", [[10, 90], [10, 90]]), "Leg Extension", emptyExerciseSettings())).not.toBeNull();
  });

  it("a 2x10 limit never suggests more than 2 sets or more than 10 reps", () => {
    const limited: ExerciseSettingsData = { ...emptyExerciseSettings(), overrides: { "leg extension": { limit: "2x10" } } };
    // Last session was 3 sets of 9: add-a-rep would be 3x10, but the limit allows 2 sets.
    const s1 = run(entries("Leg Extension", [[9, 90], [9, 90], [9, 90]]), "Leg Extension", limited)!;
    expect(s1.sets).toHaveLength(2);
    expect(Math.max(...s1.sets.map((x) => x.reps))).toBeLessThanOrEqual(10);
    // At the limit already (2x10): add weight (the limit is on sets and reps), restarting within the limit.
    const s2 = run(entries("Leg Extension", [[10, 90], [10, 90]]), "Leg Extension", limited)!;
    expect(s2.kind).toBe("add-weight");
    expect(s2.sets).toHaveLength(2);
    expect(s2.sets.every((x) => x.reps <= 10 && x.weight > 90)).toBe(true);
    // Never exceeds, whatever the last session looked like.
    const s3 = run(entries("Leg Extension", [[15, 90], [15, 90], [15, 90], [15, 90]]), "Leg Extension", limited)!;
    expect(s3.sets.length).toBeLessThanOrEqual(2);
    expect(Math.max(...s3.sets.map((x) => x.reps))).toBeLessThanOrEqual(10);
  });

  it("limits also cap the repeat and ease-back suggestions, and a restricted lift stays silent after a long break", () => {
    const limited: ExerciseSettingsData = { ...emptyExerciseSettings(), overrides: { "leg extension": { limit: "2x10" } } };
    const old = [session("a", 70, "Leg Extension", [[15, 90], [15, 90], [15, 90]])];
    const s = run(old, "Leg Extension", limited)!;
    expect(s.sets).toHaveLength(2);
    expect(Math.max(...s.sets.map((x) => x.reps))).toBeLessThanOrEqual(10);
    const restricted: ExerciseSettingsData = { ...emptyExerciseSettings(), overrides: { "leg extension": { restricted: true } } };
    expect(run(old, "Leg Extension", restricted)).toBeNull();
  });
});
