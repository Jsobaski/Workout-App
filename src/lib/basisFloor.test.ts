// A muscle that was scored from incidental credit and gets its first direct lift must not drop
// just because the scoring basis changed.
import { describe, expect, it } from "vitest";
import { workout } from "./dbTestHelper";
import { shiftDateKey } from "./date";
import { computeMuscleEngine, tierForScore } from "./muscleEngine";
import { compareSnapshots, explainDelta } from "./muscleComparison";
import { PROVISIONAL_MIN_SESSIONS } from "./muscleScoreConfig";

const TODAY = "2026-10-21";
const at = (id: string, ago: number, name: string, reps: number, weight: number) => workout(id, shiftDateKey(TODAY, -ago), name, reps, weight);
// Forearms only ever get minor credit from curls, rows and pull-ups.
const incidental = [
  at("c1", 20, "DB Bicep Curl", 10, 35),
  at("c2", 13, "DB Bicep Curl", 10, 40),
  at("c3", 6, "Hammer Curl", 10, 40),
  at("r1", 18, "Seated Cable Row", 10, 120),
  at("r2", 8, "Barbell Row", 8, 135),
  at("p1", 15, "Pull Up", 8, 0),
];
const forearms = (entries: ReturnType<typeof at>[], bw: number, asOf = TODAY) => computeMuscleEngine(entries, bw, asOf).statsByGroup.forearms;

describe("basis-change floor", () => {
  for (const bw of [150, 205]) {
    it(`${bw} lb: a first, low direct lift keeps the score the muscle already had`, () => {
      const before = forearms(incidental, bw);
      expect(before.scoringBasis).toBe("reps-time");
      const after = forearms([...incidental, at("w", 0, "Wrist Curl", 15, 15)], bw);
      expect(after.scoringBasis).toBe("load");
      expect(after.effective!).toBeGreaterThanOrEqual(before.effective!);
      expect(after.peak!).toBeGreaterThanOrEqual(before.peak!);
    });
  }

  it("a direct lift that beats the earlier score takes the higher score", () => {
    const before = forearms(incidental, 150);
    const solid = forearms([...incidental, at("w", 0, "Wrist Curl", 10, 40)], 150);
    const lowOnly = forearms([...incidental, at("w", 0, "Wrist Curl", 15, 15)], 150);
    // Sessions beyond the provisional window so the tier cap isn't in play.
    const many = [...incidental, at("w1", 0, "Wrist Curl", 10, 40), at("w2", 2, "Wrist Curl", 10, 40), at("w3", 4, "Wrist Curl", 10, 40)];
    const established = forearms(many, 150);
    expect(established.provisional).toBe(false);
    expect(established.effective!).toBeGreaterThan(before.effective!);
    expect(established.effective!).toBeGreaterThan(lowOnly.effective!);
    const direct = established.exerciseScores.find((e) => e.key === "wrist curl")!.peakScore;
    expect(established.peak!).toBeGreaterThanOrEqual(direct - 1e-9); // the direct lift (plus its small consistency bonus) leads
    expect(solid.effective!).toBeGreaterThanOrEqual(before.effective!);
  });

  it("the floor is not applied to a muscle that already had a direct lift, or that never had incidental credit", () => {
    const direct = [at("a", 30, "Wrist Curl", 10, 25), at("b", 20, "Wrist Curl", 10, 25), at("c", 10, "Wrist Curl", 10, 25)];
    const withMore = forearms([...direct, at("d", 1, "Reverse Wrist Curl", 15, 5)], 180);
    const alone = forearms(direct, 180);
    expect(withMore.peak!).toBeGreaterThanOrEqual(alone.peak! - 1e-9);
    // No earlier incidental data: nothing to floor, and the first-ever direct lift scores as it is.
    const first = forearms([at("w", 0, "Wrist Curl", 15, 15)], 205);
    expect(first.uncappedEffective!).toBeLessThan(40);
    expect(first.uncappedEffective!).toBeGreaterThan(5);
  });

  it("the provisional tier cap never pushes a muscle below the score it already had", () => {
    // Build incidental history that already scores Developing-or-better via consistency, then a first low direct lift.
    const consistent = Array.from({ length: 8 }, (_, i) => at(`k${i}`, 2 + i * 3, "Pull Up", 10, 0));
    const strong = [...consistent, ...Array.from({ length: 8 }, (_, i) => at(`h${i}`, 1 + i * 3, "Hammer Curl", 10, 45))];
    const before = forearms(strong, 180);
    const after = forearms([...strong, at("w", 0, "Wrist Curl", 15, 15)], 180);
    expect(after.provisional).toBe(true);
    expect(after.provisionalSessions!).toBeLessThan(PROVISIONAL_MIN_SESSIONS);
    expect(after.effective!).toBeGreaterThanOrEqual(before.effective! - 1e-9);
    expect(tierForScore(after.effective!).minScore).toBeLessThanOrEqual(tierForScore(before.effective!).minScore + 20);
  });

  it("the provisional cap still holds one tier below for a muscle with no earlier score to protect", () => {
    const first = forearms([at("w", 0, "Wrist Curl", 15, 15)], 150);
    expect(first.provisional).toBe(true);
    expect(first.effective!).toBeLessThan(first.uncappedEffective!);
    expect(first.effective!).toBeLessThan(20);
  });
});

describe("comparison reason for a basis change", () => {
  it("says the muscle is now scored from the direct lift, never a drop", () => {
    const entries = [...incidental, at("w", 0, "Wrist Curl", 15, 15)];
    const after = computeMuscleEngine(entries, 205, TODAY).statsByGroup;
    const before = computeMuscleEngine(entries, 205, shiftDateKey(TODAY, -3)).statsByGroup;
    const deltas = compareSnapshots(before, after);
    expect(deltas.forearms.delta).toBeNull();
    const reason = explainDelta(before.forearms, after.forearms, deltas.forearms);
    expect(reason.kind).toBe("basis");
    expect(reason.text).toContain("Now scored from Wrist Curl instead of incidental credit");
  });
});

describe("the floor protects every muscle with the same pattern (incidental source, then a direct isolation lift)", () => {
  const cases: [string, ReturnType<typeof at>[], ReturnType<typeof at>, "calves" | "traps" | "abs" | "triceps"][] = [
    ["calves", [at("a", 12, "Standing Leg Curl", 10, 60), at("b", 5, "Standing Leg Curl", 10, 70)], at("n", 0, "Calf Raise", 15, 40), "calves"],
    ["traps", [at("a", 12, "Trap Bar Deadlift", 5, 225), at("b", 5, "Trap Bar Deadlift", 5, 245)], at("n", 0, "Shrugs", 12, 40), "traps"],
    ["triceps", [at("a", 12, "Pullover", 10, 40), at("b", 5, "Pullover", 10, 45)], at("n", 0, "Tricep Kickback", 12, 5), "triceps"],
  ];
  for (const [label, history, firstDirect, group] of cases) {
    it(`${label}: a first low direct lift never lowers the score`, () => {
      for (const bw of [150, 205]) {
        const before = computeMuscleEngine(history, bw, TODAY).statsByGroup[group];
        const after = computeMuscleEngine([...history, firstDirect], bw, TODAY).statsByGroup[group];
        if (before.scoringBasis === "load") continue; // already direct-scored: not a basis change
        expect(after.effective!, `${label} @${bw}`).toBeGreaterThanOrEqual(before.effective! - 1e-9);
      }
    });
  }
});
