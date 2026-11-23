import { describe, expect, it } from "vitest";
import { computeMuscleEngine } from "./muscleEngine";
import { shiftDateKey } from "./date";
import { DECAY_FLOOR_RATIO } from "./muscleScoreConfig";
import { WorkoutEntry } from "./types";

const LAST_WORK = "2026-09-01";
const plank = (i: number, daysBeforeLast: number): WorkoutEntry => {
  const dateKey = shiftDateKey(LAST_WORK, -daysBeforeLast);
  return {
    id: `p${i}`,
    dateKey,
    timestamp: new Date(`${dateKey}T12:00:00`).getTime(),
    exerciseName: "Side Plank",
    muscleGroups: [],
    sets: [{ reps: 0, weight: 0, durationSec: 40 }, { reps: 0, weight: 0, durationSec: 40 }],
    timed: true,
  };
};
// Four sessions over the two weeks up to the last one.
const log = [plank(1, 12), plank(2, 8), plank(3, 4), plank(4, 0)];
const at = (daysAfter: number) => computeMuscleEngine(log, 180, shiftDateKey(LAST_WORK, daysAfter)).statsByGroup.obliques;

describe("consistency-only muscles (obliques via planks)", () => {
  it("scores the earlier peak right after work, with decay only after the grace period", () => {
    const now = at(1);
    expect(now.scoringBasis).toBe("reps-time");
    expect(now.peak!).toBeGreaterThan(20);
    expect(now.effective!).toBeCloseTo(now.peak!, 6);
    expect(now.isStale).toBe(false);
    expect(at(14).effective!).toBeLessThanOrEqual(now.effective!);
  });

  it("keeps most of its score 29+ days later instead of dropping to 0, and never below the decay floor", () => {
    const peak = at(1).peak!;
    for (const days of [29, 45, 120]) {
      const later = at(days);
      expect(later.peak!).toBeCloseTo(peak, 6);
      expect(later.effective!).toBeGreaterThan(0);
      expect(later.effective!).toBeGreaterThanOrEqual(peak * DECAY_FLOOR_RATIO - 1e-6);
      expect(later.effective!).toBeLessThan(peak);
    }
  });

  it("stays flagged stale, and decay neither resets the stale clock nor counts as new work", () => {
    const early = at(11);
    const late = at(29);
    expect(late.isStale).toBe(true);
    expect(late.lastTrainedDateKey).toBe(LAST_WORK);
    expect(late.daysStale).toBe(29);
    expect(late.daysStale!).toBeGreaterThan(early.daysStale!);
    expect(late.effective!).toBeLessThan(early.effective!);
  });

  it("a long gap before the window opens doesn't lift the peak: it is the best window reached, not an accumulation", () => {
    const sparse = [plank(1, 400), plank(2, 200), plank(3, 0)];
    const stats = computeMuscleEngine(sparse, 180, shiftDateKey(LAST_WORK, 1)).statsByGroup.obliques;
    expect(stats.peak!).toBeLessThan(at(1).peak!);
  });
});
