import { describe, expect, it } from "vitest";
import {
  applyDecay,
  daysBetween,
  epley1RM,
  ratioToScore,
  volumeConsistencyBonus,
} from "./muscleScoring";

describe("epley1RM", () => {
  it("returns weight unchanged for a 1-rep set", () => {
    expect(epley1RM(225, 1)).toBe(225);
  });
  it("applies the Epley formula for multi-rep sets", () => {
    // 100 * (1 + 5/30) = 116.666...
    expect(epley1RM(100, 5)).toBeCloseTo(116.667, 2);
  });
  it("returns 0 for invalid inputs", () => {
    expect(epley1RM(100, 0)).toBe(0);
    expect(epley1RM(-10, 5)).toBe(0);
  });
});

describe("ratioToScore", () => {
  const breakpoints: [number, number, number, number, number] = [0.25, 0.5, 0.85, 1.2, 1.5];

  it("clamps to 0 at or below the lowest breakpoint", () => {
    expect(ratioToScore(0, breakpoints)).toBe(0);
    expect(ratioToScore(0.25, breakpoints)).toBe(0);
    expect(ratioToScore(0.1, breakpoints)).toBe(0);
  });
  it("clamps to 100 at or above the highest breakpoint", () => {
    expect(ratioToScore(1.5, breakpoints)).toBe(100);
    expect(ratioToScore(3, breakpoints)).toBe(100);
  });
  it("interpolates linearly within a segment", () => {
    // Halfway between 0.5 (score 25) and 0.85 (score 50) -> score 37.5
    expect(ratioToScore(0.675, breakpoints)).toBeCloseTo(37.5, 1);
  });
  it("hits exact breakpoint scores", () => {
    expect(ratioToScore(0.85, breakpoints)).toBeCloseTo(50, 5);
    expect(ratioToScore(1.2, breakpoints)).toBeCloseTo(75, 5);
  });
});

describe("applyDecay", () => {
  it("applies no loss within the grace period", () => {
    expect(applyDecay(80, 0, { graceDays: 14, halfLifeDays: 42, floorRatio: 0.7 })).toBe(80);
    expect(applyDecay(80, 14, { graceDays: 14, halfLifeDays: 42, floorRatio: 0.7 })).toBe(80);
  });
  it("decays toward the floor after the grace period", () => {
    const peak = 80;
    const floor = peak * 0.7; // 56
    const atOneHalfLife = applyDecay(peak, 14 + 42, { graceDays: 14, halfLifeDays: 42, floorRatio: 0.7 });
    // After exactly one half-life past grace, should be halfway between peak and floor.
    expect(atOneHalfLife).toBeCloseTo(floor + (peak - floor) * 0.5, 5);
  });
  it("never drops below the floor even with very large elapsed time", () => {
    const result = applyDecay(80, 10_000, { graceDays: 14, halfLifeDays: 42, floorRatio: 0.7 });
    expect(result).toBeCloseTo(56, 1);
    expect(result).toBeGreaterThanOrEqual(56 - 0.01);
  });
  it("clamps scores to the 0-100 range", () => {
    expect(applyDecay(100, 0)).toBeLessThanOrEqual(100);
    expect(applyDecay(0, 1000)).toBeGreaterThanOrEqual(0);
  });
});

describe("volumeConsistencyBonus", () => {
  it("gives the full bonus at or above the target session count", () => {
    expect(volumeConsistencyBonus(8, 8, 10)).toBe(10);
    expect(volumeConsistencyBonus(12, 8, 10)).toBe(10);
  });
  it("scales linearly below the target", () => {
    expect(volumeConsistencyBonus(4, 8, 10)).toBeCloseTo(5, 5);
    expect(volumeConsistencyBonus(0, 8, 10)).toBe(0);
  });
  it("returns 0 when the target is 0 or negative", () => {
    expect(volumeConsistencyBonus(5, 0, 10)).toBe(0);
  });
});

describe("daysBetween", () => {
  it("computes whole-day differences", () => {
    expect(daysBetween("2026-01-01", "2026-01-15")).toBe(14);
    expect(daysBetween("2026-01-15", "2026-01-01")).toBe(-14);
    expect(daysBetween("2026-01-01", "2026-01-01")).toBe(0);
  });
});
