import { describe, expect, it } from "vitest";
import { computeMuscleEngine } from "./muscleEngine";
import { WorkoutEntry } from "./types";

function makeEntry(
  id: string,
  dateKey: string,
  exerciseName: string,
  sets: { reps: number; weight: number }[],
  bodyweight?: boolean
): WorkoutEntry {
  return {
    id,
    dateKey,
    timestamp: new Date(`${dateKey}T12:00:00`).getTime(),
    exerciseName,
    muscleGroups: [],
    sets,
    bodyweight,
  };
}

function makeTimedEntry(
  id: string,
  dateKey: string,
  exerciseName: string,
  sets: { reps: number; weight: number; durationSec: number }[],
  bodyweight?: boolean
): WorkoutEntry {
  return {
    id,
    dateKey,
    timestamp: new Date(`${dateKey}T12:00:00`).getTime(),
    exerciseName,
    muscleGroups: [],
    sets,
    bodyweight,
    timed: true,
  };
}

describe("computeMuscleEngine", () => {
  it("leaves an untouched muscle unrated (hasAnyData=false), not scored at 0", () => {
    const { statsByGroup } = computeMuscleEngine([], 180, "2026-10-14");
    expect(statsByGroup.calves.hasAnyData).toBe(false);
    expect(statsByGroup.calves.peak).toBeNull();
    expect(statsByGroup.calves.effective).toBeNull();
  });

  it("surfaces an unmapped exercise in needsMapping without crashing or silently dropping it", () => {
    const entries = [makeEntry("1", "2026-10-01", "Some Made Up Machine Thing", [{ reps: 8, weight: 50 }])];
    const { needsMapping, statsByGroup } = computeMuscleEngine(entries, 180, "2026-10-14");
    expect(needsMapping).toContain("Some Made Up Machine Thing");
    // and it must not have contributed to any muscle
    expect(Object.values(statsByGroup).every((s) => !s.contributingExercises.includes("Some Made Up Machine Thing"))).toBe(true);
  });

  it("scores a primary contribution higher than the same lift's secondary contribution", () => {
    const entries = [makeEntry("1", "2026-10-10", "Bench Press", [{ reps: 5, weight: 185 }])];
    const { statsByGroup } = computeMuscleEngine(entries, 180, "2026-10-14");
    // Mid/Lower Chest is primary (weight 1.0), Triceps primary too, Front Delts is secondary (0.4)
    expect(statsByGroup.midLowerChest.peak!).toBeGreaterThan(statsByGroup.frontDelts.peak!);
  });

  it("does not reset the freshness clock on a warm-up set under 60% of the lift's peak", () => {
    const entries = [
      makeEntry("1", "2026-09-01", "Back Squat", [{ reps: 5, weight: 200 }]), // sets the peak
      makeEntry("2", "2026-10-13", "Back Squat", [{ reps: 10, weight: 95 }]), // ~47% of peak e1RM, a warm-up
    ];
    const { statsByGroup } = computeMuscleEngine(entries, 180, "2026-10-14");
    // Last meaningful date should still be 2026-09-01, not the recent warm-up.
    expect(statsByGroup.quads.lastTrainedDateKey).toBe("2026-09-01");
    expect(statsByGroup.quads.isStale).toBe(true);
  });

  it("does reset the freshness clock on a working set at/above 60% of peak", () => {
    const entries = [
      makeEntry("1", "2026-09-01", "Back Squat", [{ reps: 5, weight: 200 }]),
      makeEntry("2", "2026-10-13", "Back Squat", [{ reps: 5, weight: 190 }]), // well above 60%
    ];
    const { statsByGroup } = computeMuscleEngine(entries, 180, "2026-10-14");
    expect(statsByGroup.quads.lastTrainedDateKey).toBe("2026-10-13");
    expect(statsByGroup.quads.isStale).toBe(false);
  });

  it("applies no decay within the 14-day grace period", () => {
    const entries = [makeEntry("1", "2026-10-05", "DB Bench Press", [{ reps: 5, weight: 100 }])]; // 9 days before asOf
    const { statsByGroup } = computeMuscleEngine(entries, 180, "2026-10-14");
    expect(statsByGroup.midLowerChest.effective).toBe(statsByGroup.midLowerChest.peak);
  });

  it("decays effective below peak once past the grace period", () => {
    const entries = [makeEntry("1", "2026-08-01", "DB Bench Press", [{ reps: 5, weight: 100 }])]; // well past grace
    const { statsByGroup } = computeMuscleEngine(entries, 180, "2026-10-14");
    expect(statsByGroup.midLowerChest.effective!).toBeLessThan(statsByGroup.midLowerChest.peak!);
  });

  it("scores a volumeOnly-only muscle from consistency rather than leaving it at 0", () => {
    const entries = [
      makeEntry("1", "2026-10-01", "Plank", [{ reps: 1, weight: 0 }], true),
      makeEntry("2", "2026-10-05", "Plank", [{ reps: 1, weight: 0 }], true),
      makeEntry("3", "2026-10-09", "Plank", [{ reps: 1, weight: 0 }], true),
      makeEntry("4", "2026-10-13", "Plank", [{ reps: 1, weight: 0 }], true),
    ];
    const { statsByGroup } = computeMuscleEngine(entries, 180, "2026-10-14");
    expect(statsByGroup.abs.hasAnyData).toBe(true);
    expect(statsByGroup.abs.peak!).toBeGreaterThan(0);
  });

  it("doesn't let a minor secondary loadable lift suppress a mostly-volumeOnly muscle's score", () => {
    // Abs is trained consistently (4x in the window) entirely via volumeOnly
    // exercises (primary contributor), but Farmer Carry also touches Abs as
    // a small secondary (0.4-weight) loadable contributor. That secondary
    // touch shouldn't reclassify Abs into the small 10-point load-standard
    // branch instead of the 70-point consistency branch core work needs.
    const entries = [
      makeEntry("1", "2026-09-22", "Plank", [{ reps: 1, weight: 0 }], true),
      makeEntry("2", "2026-09-29", "Dead Bug", [{ reps: 10, weight: 0 }], true),
      makeEntry("3", "2026-10-06", "Captain's Chair Knee Raises", [{ reps: 12, weight: 0 }], true),
      makeEntry("4", "2026-10-12", "Plank", [{ reps: 1, weight: 0 }], true),
      makeEntry("5", "2026-09-18", "Farmer Carry", [{ reps: 1, weight: 60 }]),
    ];
    const withFarmerCarry = computeMuscleEngine(entries, 180, "2026-10-14");
    const withoutFarmerCarry = computeMuscleEngine(entries.slice(0, 4), 180, "2026-10-14");
    // The incidental secondary contributor shouldn't tank the score relative
    // to the same muscle trained the exact same way minus that one lift.
    expect(withFarmerCarry.statsByGroup.abs.peak!).toBeGreaterThan(
      withoutFarmerCarry.statsByGroup.abs.peak! - 5
    );
    expect(withFarmerCarry.statsByGroup.abs.peak!).toBeGreaterThan(20);
  });

  it("scores a timed (duration-based) exercise using seconds in place of reps", () => {
    const entries = [
      makeTimedEntry("1", "2026-09-01", "Plank", [{ reps: 0, weight: 0, durationSec: 30 }], true),
      makeTimedEntry("2", "2026-10-13", "Plank", [{ reps: 0, weight: 0, durationSec: 60 }], true),
    ];
    const { statsByGroup } = computeMuscleEngine(entries, 180, "2026-10-14");
    // A 60s hold is well above 60% of the 30s-then-60s lifetime peak (60s
    // itself), so it should count as fresh/meaningful.
    expect(statsByGroup.abs.lastTrainedDateKey).toBe("2026-10-13");
    expect(statsByGroup.abs.isStale).toBe(false);
  });

  it("a timed set under 60% of that lift's own best duration doesn't reset freshness", () => {
    const entries = [
      makeTimedEntry("1", "2026-09-01", "Plank", [{ reps: 0, weight: 0, durationSec: 90 }], true), // sets the peak
      makeTimedEntry("2", "2026-10-13", "Plank", [{ reps: 0, weight: 0, durationSec: 20 }], true), // ~22% of peak
    ];
    const { statsByGroup } = computeMuscleEngine(entries, 180, "2026-10-14");
    expect(statsByGroup.abs.lastTrainedDateKey).toBe("2026-09-01");
    expect(statsByGroup.abs.isStale).toBe(true);
  });

  it("respects the asOfDateKey — later entries don't affect an earlier snapshot", () => {
    const entries = [
      makeEntry("1", "2026-09-01", "DB Bench Press", [{ reps: 5, weight: 100 }]),
      makeEntry("2", "2026-10-13", "DB Bench Press", [{ reps: 5, weight: 150 }]),
    ];
    const before = computeMuscleEngine(entries, 180, "2026-09-15");
    const after = computeMuscleEngine(entries, 180, "2026-10-14");
    expect(before.statsByGroup.midLowerChest.peak!).toBeLessThan(after.statsByGroup.midLowerChest.peak!);
  });

  it("is case-insensitive and tolerates the known Day1/common-list naming drift", () => {
    const a = computeMuscleEngine(
      [makeEntry("1", "2026-10-01", "db bulgarian split squat", [{ reps: 8, weight: 40 }])],
      180,
      "2026-10-14"
    );
    const b = computeMuscleEngine(
      [makeEntry("1", "2026-10-01", "DB Bulgarian Split Squats", [{ reps: 8, weight: 40 }])],
      180,
      "2026-10-14"
    );
    expect(a.needsMapping).toHaveLength(0);
    expect(b.needsMapping).toHaveLength(0);
    expect(a.statsByGroup.quads.peak).toBeCloseTo(b.statsByGroup.quads.peak!, 5);
  });
});
