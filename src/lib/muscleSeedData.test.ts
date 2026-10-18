import { describe, expect, it } from "vitest";
import { buildMuscleSeedData } from "./muscleSeedData";
import { computeMuscleEngine } from "./muscleEngine";
import { compareSnapshots } from "./muscleComparison";
import { shiftDateKey } from "./date";
import { TREND_WINDOW_DAYS } from "./muscleScoreConfig";

const TODAY = "2026-10-17";

describe("sample data for the Muscles preview", () => {
  const entries = buildMuscleSeedData(TODAY);
  const after = computeMuscleEngine(entries, 180, TODAY).statsByGroup;
  const before = computeMuscleEngine(entries, 180, shiftDateKey(TODAY, -TREND_WINDOW_DAYS)).statsByGroup;
  const deltas = Object.values(compareSnapshots(before, after));

  it("gives real numeric deltas (not only 'new exercise'), in both directions", () => {
    const numeric = deltas.filter((d) => d.delta != null);
    expect(numeric.length).toBeGreaterThanOrEqual(6);
    expect(numeric.some((d) => d.delta! > 3)).toBe(true);
    expect(numeric.some((d) => d.delta! < -1)).toBe(true);
    expect(deltas.some((d) => d.status === "new")).toBe(true);
  });

  it("only uses logs from before today, with two blocks about 30 days apart", () => {
    expect(entries.every((e) => e.dateKey <= TODAY)).toBe(true);
    const cutoff = shiftDateKey(TODAY, -TREND_WINDOW_DAYS);
    expect(entries.filter((e) => e.dateKey <= cutoff).length).toBeGreaterThan(10);
    expect(entries.filter((e) => e.dateKey > cutoff).length).toBeGreaterThan(10);
  });
});
