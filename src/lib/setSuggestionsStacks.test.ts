// Suggestions on stacks / add-on plates with uneven steps, and warm-up ramps not polluting increment learning.
import { describe, expect, it } from "vitest";
import { workout } from "./dbTestHelper";
import { shiftDateKey } from "./date";
import { buildExerciseHistory } from "./exerciseHistory";
import { inferIncrement, loggedWeightsForGroup, suggestNextSets } from "./setSuggestions";
import { WorkoutEntry } from "./types";

const TODAY = "2026-10-27";
const session = (id: string, ago: number, name: string, setList: [number, number][]): WorkoutEntry => ({
  ...workout(id, shiftDateKey(TODAY, -ago), name, 1, 1),
  sets: setList.map(([reps, weight]) => ({ reps, weight })),
});
const run = (entries: WorkoutEntry[], name: string) =>
  suggestNextSets(buildExerciseHistory(entries, name), TODAY, { loggedWeights: loggedWeightsForGroup(entries, name) });
const x3 = (reps: number, w: number): [number, number][] => [[reps, w], [reps, w], [reps, w]];

describe("weight stacks with uneven steps", () => {
  it("moves to the next weight previously logged on that lift, not a formula step", () => {
    const entries = [
      session("a", 40, "Seated Row", x3(12, 121)),
      session("b", 33, "Seated Row", x3(12, 127)),
      session("c", 26, "Seated Row", x3(8, 143)), // tried once, too heavy
      session("d", 12, "Seated Row", x3(10, 121)),
      session("e", 5, "Seated Row", x3(12, 127)),
    ];
    const s = run(entries, "Seated Row")!;
    expect(s.kind).toBe("try-heavier");
    // 127 -> 143 is a 16 lb (12.6%) jump: keep 127 for the working sets and try 143 for one set.
    expect(s.sets.map((x) => x.weight)).toEqual([127, 127, 127, 143]);
    expect(s.reason).toContain("143");
  });

  it("a small step to the next logged weight is just added (121 -> 127 is under 10%)", () => {
    const entries = [
      session("a", 40, "Seated Row", x3(12, 121)),
      session("b", 33, "Seated Row", x3(12, 127)),
      session("d", 12, "Seated Row", x3(12, 121)),
    ];
    const s = run(entries, "Seated Row")!;
    expect(s.kind).toBe("add-weight");
    expect(s.sets.every((x) => x.weight === 127)).toBe(true);
  });

  it("with nothing heavier logged, uses the smallest step seen between sessions (a plain add when it's under 10%)", () => {
    const entries = [
      session("a", 30, "Seated Row", x3(12, 100)),
      session("b", 20, "Seated Row", x3(12, 107)),
      session("c", 10, "Seated Row", x3(12, 127)),
    ];
    const s = run(entries, "Seated Row")!;
    expect(s.kind).toBe("add-weight");
    expect(s.sets[0].weight).toBe(134); // the smallest step seen is 7 lb (100 -> 107): 5.5% above 127, a plain add
  });

  it("a regular equipment step (20 lb plate pairs) stays a normal add-weight", () => {
    const entries = [100, 120, 140, 160].map((w, i) => session(`h${i}`, 30 - i * 7, "Hack Squat", x3(12, w)));
    expect(run(entries, "Hack Squat")!.kind).toBe("add-weight");
  });

  it("respects a set limit when it adds the trial set", () => {
    const entries = [
      session("a", 40, "Seated Row", x3(12, 121)),
      session("b", 33, "Seated Row", x3(12, 127)),
      session("c", 26, "Seated Row", x3(8, 143)),
      session("e", 5, "Seated Row", x3(12, 127)),
    ];
    const history = buildExerciseHistory(entries, "Seated Row");
    const s = suggestNextSets(history, TODAY, { loggedWeights: loggedWeightsForGroup(entries, "Seated Row") })!;
    expect(s.sets.length).toBe(4);
  });
});

describe("warm-up ramps don't pollute increment detection", () => {
  const ramp = (id: string, ago: number, top: number): WorkoutEntry =>
    session(id, ago, "Hack Squat", [[10, 45], [8, 95], [5, 135], [12, top], [12, top]]);
  const entries = [ramp("a", 21, 180), ramp("b", 14, 180), ramp("c", 7, 200)];

  it("only working-set weights are collected", () => {
    expect(new Set(loggedWeightsForGroup(entries, "Hack Squat"))).toEqual(new Set([180, 200]));
  });

  it("a 45 / 95 / 135 ramp doesn't make the step 50 or 40", () => {
    expect(inferIncrement(loggedWeightsForGroup(entries, "Hack Squat"))).toBeNull(); // too little real history: fallback
    const s = run(entries, "Hack Squat")!;
    // The smallest real progression (180 -> 200) is 20 lb; warm-up gaps of 50 or 40 never enter into it.
    expect(s.sets.filter((x) => x.weight > 200).map((x) => x.weight)).toEqual([220, 220]);
  });
});
