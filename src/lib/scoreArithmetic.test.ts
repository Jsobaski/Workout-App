// Incidental-only muscles are capped, every score can be reproduced from the export's arithmetic line, and the
// provisional note always agrees with the tier and score shown.
import { describe, expect, it } from "vitest";
import { computeMuscleEngine, tierForScore } from "./muscleEngine";
import { compareSnapshots } from "./muscleComparison";
import { formatMuscleSummaryText } from "./muscleShareText";
import { SECONDARY_ONLY_CAP } from "./muscleScoreConfig";
import { shiftDateKey } from "./date";
import { WorkoutEntry } from "./types";

const ASOF = "2026-11-26";
const entry = (id: string, ago: number, name: string, reps: number, weight: number): WorkoutEntry => {
  const dateKey = shiftDateKey(ASOF, -ago);
  return { id, dateKey, timestamp: Date.parse(`${dateKey}T12:00:00`), exerciseName: name, muscleGroups: [], sets: Array.from({ length: 3 }, () => ({ reps, weight })) };
};
const helpers = () => {
  const out: WorkoutEntry[] = [];
  [26, 24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4].forEach((a, i) => out.push(entry(`f${i}`, a, "Cable Face Pulls", 12, 40)));
  [25, 18, 11, 4].forEach((a, i) => out.push(entry(`d${i}`, a, "Trap Bar Deadlift", 5, 245)));
  return out;
};
const run = (entries: WorkoutEntry[]) => computeMuscleEngine(entries, 205, ASOF);
const exportText = (entries: WorkoutEntry[]) => {
  const result = run(entries);
  return formatMuscleSummaryText({
    asOfDateKey: ASOF, bodyweightLb: 205, result,
    deltaByGroup: compareSnapshots(run([]).statsByGroup, result.statsByGroup), entries,
  });
};

describe("a muscle with only incidental exposure is capped", () => {
  it("16 sessions of helper work (face pulls, trap bar deadlift) never score above the incidental cap", () => {
    const s = run(helpers()).statsByGroup.traps;
    expect(s.effective!).toBeLessThanOrEqual(SECONDARY_ONLY_CAP + 1e-9); // was 57.5 (Solid) before the cap
    expect(s.arithmetic!.incidentalOnly).toBe(true);
    expect(s.peakRaw!).toBeLessThanOrEqual(SECONDARY_ONLY_CAP + 1e-9);
  });

  it("a muscle with a real primary exercise (planks for obliques) is not capped", () => {
    const planks = [3, 6, 9, 12, 15, 18, 21, 24].map((a, i): WorkoutEntry => {
      const dateKey = shiftDateKey(ASOF, -a);
      return { id: `p${i}`, dateKey, timestamp: Date.parse(`${dateKey}T12:00:00`), exerciseName: "Side Plank", muscleGroups: [], timed: true, sets: [{ reps: 0, weight: 0, durationSec: 40 }] };
    });
    const s = run(planks).statsByGroup.obliques;
    expect(s.arithmetic!.incidentalOnly).toBe(false);
    expect(s.effective!).toBeGreaterThan(SECONDARY_ONLY_CAP);
  });

  it("the first direct lift keeps at most that capped score (no 31 appearing from helper exposure)", () => {
    const s = run([...helpers(), entry("s1", 2, "DB Shrugs", 12, 25)]).statsByGroup.traps;
    expect(s.scoringBasis).toBe("load");
    expect(s.peakRaw!).toBeLessThanOrEqual(SECONDARY_ONLY_CAP + 1e-9);
  });
});

describe("the export prints the arithmetic behind every score", () => {
  const entries = [...helpers(), entry("s1", 2, "DB Shrugs", 12, 25)];
  const stats = run(entries).statsByGroup;

  it("the terms add up to the raw sum, and the chain ends at the displayed score", () => {
    for (const s of Object.values(stats)) {
      const a = s.arithmetic;
      if (!a) continue;
      expect(a.rawSum).toBeCloseTo(Math.max(a.primary.peak, Math.max(a.primary.peak, a.secondary.credited)) + a.consistency.points, 6);
      expect(a.peakRaw).toBeLessThanOrEqual(a.rawSum + (a.basisFloor ?? 0) + 1e-9);
      expect(a.effectiveBeforeHold).toBeGreaterThanOrEqual((s.effective ?? 0) - 1e-9);
    }
  });

  it("Traps shows primary, capped secondary, consistency, the floor or incidental cap, and the final chain", () => {
    const lines = exportText(entries).split("\n");
    const line = lines.slice(lines.findIndex((l) => l.startsWith("- Traps"))).find((l) => l.startsWith("    = primary"))!;
    expect(line).toMatch(/primary [\d.]+ \(DB Shrugs\) \+ secondary [\d.]+ \(best Trap Bar Deadlift [\d.]+, capped at [\d.]+\) \+ consistency [\d.]+ \([\d.]+ weighted days, max 10.0\) = [\d.]+/);
    expect(line).toContain("basis-change floor keeps the earlier score 20.0"); // the capped incidental score before the first shrug session
    const before = exportText(helpers()).split("\n");
    const incidental = before.slice(before.findIndex((l) => l.startsWith("- Traps"))).find((l) => l.startsWith("    = primary"))!;
    expect(incidental).toContain("incidental exposure only, capped at 20.0");
    expect(line).toMatch(/→ raw [\d.]+ → soft cap → peak [\d.]+ → decay ×[\d.]+ → [\d.]+/);
  });
});

describe("the provisional note agrees with the tier and score shown", () => {
  const oneHeavySession = [entry("a", 3, "Back Squat", 5, 365)];

  it("held: states the computed tier and that the shown tier is one lower", () => {
    const s = run(oneHeavySession).statsByGroup.quads;
    expect(s.provisional).toBe(true);
    expect(s.arithmetic!.provisionalHeld).toBe(true);
    const shown = tierForScore(s.effective!);
    expect(shown.minScore).toBeLessThan(tierForScore(s.uncappedEffective!).minScore); // one level below
    const line = exportText(oneHeavySession).split("\n").find((l) => l.startsWith("- Quads"))!;
    expect(line).toContain(`${shown.label} (`);
    expect(line).toContain(`computed ${tierForScore(s.uncappedEffective!).label}`);
    expect(line).toContain("shown one tier lower");
  });

  it("not held (the lowest tier, or an earlier score is kept): says the tier was not lowered", () => {
    const low = run([entry("a", 3, "Back Squat", 5, 95)]).statsByGroup.quads;
    expect(low.arithmetic!.provisionalHeld).toBe(false);
    const line = exportText([entry("a", 3, "Back Squat", 5, 95)]).split("\n").find((l) => l.startsWith("- Quads"))!;
    expect(line).toContain("tier not lowered");
    expect(line).not.toContain("held one level below");
  });
});
