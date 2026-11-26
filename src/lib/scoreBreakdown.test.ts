// One decay rule for every muscle, a recent lookback for consistency peaks, the per-lift breakdown in the export,
// and how per-hand dumbbell shrugs are compared with the barbell table.
import { describe, expect, it } from "vitest";
import { computeMuscleEngine } from "./muscleEngine";
import { compareSnapshots } from "./muscleComparison";
import { formatMuscleSummaryText } from "./muscleShareText";
import { emptyExerciseSettings } from "./exerciseSettings";
import { decayFactor } from "./muscleScoring";
import { CONSISTENCY_LOOKBACK_DAYS, LIFT_FAMILY_STANDARDS } from "./muscleScoreConfig";
import { shiftDateKey } from "./date";
import { WorkoutEntry } from "./types";

const ASOF = "2026-11-20";
const entry = (id: string, ago: number, name: string, sets: WorkoutEntry["sets"], extra: Partial<WorkoutEntry> = {}): WorkoutEntry => {
  const dateKey = shiftDateKey(ASOF, -ago);
  return { id, dateKey, timestamp: Date.parse(`${dateKey}T12:00:00`), exerciseName: name, muscleGroups: [], sets, ...extra };
};
const x3 = (reps: number, weight: number) => [{ reps, weight }, { reps, weight }, { reps, weight }];
const plank = (id: string, ago: number, name = "Side Plank") =>
  entry(id, ago, name, [{ reps: 0, weight: 0, durationSec: 40 }, { reps: 0, weight: 0, durationSec: 40 }], { timed: true });
const run = (entries: WorkoutEntry[], bw = 205, settings = emptyExerciseSettings()) => computeMuscleEngine(entries, bw, ASOF, 10, settings);

describe("consistency peaks use a recent lookback", () => {
  const eightPlanks = (agos: number[]) => agos.map((a, i) => plank(`p${i}`, a));

  it("a peak window older than the lookback is ignored (even when a thin recent session exists)", () => {
    const farBack = eightPlanks([150, 147, 144, 141, 138, 135, 132, 130]);
    expect(run(farBack).statsByGroup.obliques.effective!).toBe(0);
    const withRecent = run([...farBack, plank("r", 29)]).statsByGroup.obliques;
    expect(withRecent.effective!).toBeLessThan(10); // just the one recent session, not the 70-point peak from 5 months ago
    expect(withRecent.isStale).toBe(true);
  });

  it("an in-lookback (42 day) peak still counts, but decays from the day it was reached, not from the latest thin session", () => {
    const peakWindow = eightPlanks([41, 44, 47, 50, 53, 56, 59, 62]);
    const s = run([...peakWindow, plank("r", 29)]).statsByGroup.obliques;
    expect(s.peak!).toBeCloseTo(70, 0);
    // The peak window ended 41 days ago: it is worth 70 x decay(41), not 70 x decay(29).
    expect(s.effective!).toBeCloseTo(70 * decayFactor(41), 1);
    expect(s.effective!).toBeLessThan(70 * decayFactor(29));
  });

  it("reports the window and the exercises that produced the peak, flagging restricted ones (they still count)", () => {
    const settings = { ...emptyExerciseSettings(), overrides: { "side plank": { restricted: true } } } as ReturnType<typeof emptyExerciseSettings>;
    const entries = [...[20, 18, 16, 14].map((a, i) => plank(`a${i}`, a)), plank("b", 12, "Pallof Press")];
    const withRestriction = run(entries, 205, settings).statsByGroup.obliques;
    const without = run(entries).statsByGroup.obliques;
    const c = withRestriction.consistencyPeak!;
    expect(c.lookbackDays).toBe(CONSISTENCY_LOOKBACK_DAYS);
    expect(c.windowEnd >= c.windowStart).toBe(true);
    expect(c.exercises.find((x) => x.name.toLowerCase().includes("side plank"))).toMatchObject({ days: 4, restricted: true });
    expect(withRestriction.effective).toBeCloseTo(without.effective!, 6); // one rule: restrictions never change a score
    expect(run(entries).statsByGroup.lowerBack.consistencyPeak).toBeNull(); // strength-scored muscles don't have one
  });
});

describe("one decay rule: each piece of evidence decays from when it happened", () => {
  const entries = [
    entry("t1", 67, "Trap Bar Deadlift", x3(5, 245)),
    entry("t2", 60, "Trap Bar Deadlift", x3(5, 245)),
    entry("t3", 53, "Trap Bar Deadlift", x3(5, 245)),
    entry("b1", 14, "Back Extension", x3(10, 150)),
    entry("b2", 7, "Back Extension", x3(10, 150)),
    entry("b3", 3, "Back Extension", x3(10, 150)),
  ];

  it("training a different lift does not keep an old peak fresh (strength-scored)", () => {
    const s = run(entries).statsByGroup.lowerBack;
    const trap = s.exerciseScores.find((e) => e.name === "Trap Bar Deadlift")!;
    const ext = s.exerciseScores.find((e) => e.name === "Back Extension")!;
    expect(trap.effectiveScore).toBeLessThan(trap.peakScore);
    expect(ext.effectiveScore).toBeCloseTo(ext.peakScore, 6);
    // The muscle's score is its best decayed lift (plus the small consistency top-up), below its undecayed peak.
    expect(s.effective!).toBeLessThan(s.peak! - 1);
    expect(s.effective!).toBeGreaterThan(Math.max(trap.effectiveScore, ext.effectiveScore) - 1);
  });

  it("a lift and a consistency window of the same age lose the same share", () => {
    const lift = run([entry("x", 40, "Back Squat", x3(5, 225)), entry("y", 47, "Back Squat", x3(5, 225)), entry("z", 54, "Back Squat", x3(5, 225))]).statsByGroup.quads;
    expect(lift.effective! / lift.peak!).toBeCloseTo(decayFactor(40), 2);
    const planks = run(eightPlanksEndingAgo(40)).statsByGroup.obliques;
    expect(planks.effective! / planks.peak!).toBeCloseTo(decayFactor(40), 2);
  });

  it("the export shows each lift's credit and decay, and the consistency window", () => {
    const all = [...entries, ...eightPlanksEndingAgo(10)];
    const result = run(all);
    const text = formatMuscleSummaryText({
      asOfDateKey: ASOF, bodyweightLb: 205, result,
      deltaByGroup: compareSnapshots(run([]).statsByGroup, result.statsByGroup), entries: all,
    });
    expect(text).toMatch(/· Trap Bar Deadlift \(primary\): ~\d+ lb e1RM, credit [\d.]+ → [\d.]+, last done \w+ \d+ \(53d ago, decayed \d+%\)/);
    expect(text).toMatch(/· Back Extension \(primary\): [^\n]*\(3d ago\)/);
    expect(text).toMatch(/· consistency peak: [\d.]+ weighted training days in \w+ \d+–\w+ \d+ \(best window of the last 42 days\) = [\d.]+ pts; from Side Plank \d+d/);
    expect(text).toContain("one rule for every muscle");
    expect(text).not.toContain("Restricted exercises are scored"); // only mentioned when the user has restrictions
  });
});
function eightPlanksEndingAgo(endAgo: number) {
  return Array.from({ length: 8 }, (_, i) => plank(`w${i}`, endAgo + i * 3));
}

describe("DB shrugs are compared per hand against half of the barbell table", () => {
  const table = LIFT_FAMILY_STANDARDS.shrug;
  const trapsPeak = (name: string, weight: number) =>
    run([13, 9, 5].map((a, i) => entry(`s${i}`, a, name, x3(12, weight)))).statsByGroup.traps.exerciseScores.find((e) => e.name.toLowerCase().includes("shrug"))!.peakScore;

  it("the dumbbell table is the barbell table x 0.5 (weight is per hand)", () => {
    expect(table).toEqual([0.5, 1.0, 1.5, 2.25, 3.0]);
    // Same ratio of lift to table: a pair of 50s (100 lb total) scores like a 100 lb barbell shrug.
    expect(trapsPeak("DB Shrugs", 50)).toBeCloseTo(trapsPeak("Shrugs", 100), 6);
    expect(trapsPeak("DB Shrugs", 75)).toBeCloseTo(trapsPeak("Shrugs", 150), 6);
  });

  it("25 and 35 lb per hand earn no strength credit at 205 lb, 50 lb per hand a little", () => {
    const [a, b, c] = [25, 35, 50].map((w) => trapsPeak("DB Shrugs", w));
    // 25 and 35 lb per hand (e1RM 34 / 48 lb) are below the table's zero point, so they earn no strength credit;
    // what Traps shows for them is the small consistency bonus. 50 lb per hand is the first that scores.
    expect(a).toBe(0);
    expect(b).toBe(0);
    expect(c).toBeGreaterThan(0);
    expect(c).toBeLessThan(20);
  });

  it("the shrug table change did not raise any per-hand dumbbell shrug score", () => {
    // Before the change DB shrugs used 0.45 x the deadlift table; each tier of the new table is harder or equal.
    const oldTable = [0.225, 0.45, 0.675, 0.9, 1.125];
    expect(table.map((v) => v * 0.5).every((v, i) => v >= oldTable[i])).toBe(true);
  });
});
