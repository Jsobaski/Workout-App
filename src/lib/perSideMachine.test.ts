// A one-arm-at-a-time machine: weight logged per arm, one logged set trains both arms.
import { describe, expect, it } from "vitest";
import { canonicalExerciseKey, lookupExerciseMapping } from "./exerciseMuscleMap";
import { resolveExerciseConfig } from "./exerciseSettings";
import { areSameLift, liftGroupMap } from "./liftGroups";
import { computeMuscleEngine } from "./muscleEngine";
import { entryVolume, workoutSummary } from "./aggregate";
import { COMMON_EXERCISES } from "./commonExercises";
import { WorkoutEntry } from "./types";

const KEY = "single arm biceps curl machine";
const TODAY = "2026-11-26";
const sessions = (name: string, weight: number, reps = 12): WorkoutEntry[] =>
  ["2026-11-16", "2026-11-19", "2026-11-22"].map((dateKey, i) => ({
    id: `${name}${i}`, dateKey, timestamp: Date.parse(`${dateKey}T12:00:00`), exerciseName: name, muscleGroups: [],
    sets: [1, 2, 3].map(() => ({ reps, weight })),
  }));
const biceps = (entries: WorkoutEntry[], bw = 205) => computeMuscleEngine(entries, bw, TODAY).statsByGroup.biceps;

describe("aliases", () => {
  it("every Nautilus / unilateral name resolves to the one-arm curl machine", () => {
    for (const name of [
      "Nautilus Inspiration Biceps Curl (Unilateral)",
      "Inspiration Biceps Curl",
      "Nautilus Biceps Curl Unilateral",
      "Single Arm Biceps Curl Machine",
      "single arm biceps curl machine",
    ]) {
      expect(canonicalExerciseKey(name), name).toBe(KEY);
    }
  });

  it("it is in the exercise list, with biceps primary and forearms minor like the other curl machines", () => {
    expect(COMMON_EXERCISES).toContain("Single Arm Biceps Curl Machine");
    const m = lookupExerciseMapping("Nautilus Inspiration Biceps Curl (Unilateral)")!;
    const bilateral = lookupExerciseMapping("Bicep Curl Machine")!;
    expect(m.muscles).toEqual(bilateral.muscles);
    expect(m.muscles.find((x) => x.group === "biceps")!.weight).toBe(1);
    expect(m.muscles.find((x) => x.group === "forearms")!.weight).toBeLessThan(1);
  });

  it("the existing names still go where they did (Impact biceps curl is the both-arms machine)", () => {
    expect(canonicalExerciseKey("Nautilus Impact Bicep Curl")).toBe("bicep curl machine");
    expect(canonicalExerciseKey("Hoist Preacher Curl Machine")).toBe("preacher curl machine");
  });
});

describe("volume counts both arms", () => {
  it("one logged set of 30 lb x 12 is 30 x 12 x 2 = 720 lb of volume", () => {
    const e = sessions("Nautilus Inspiration Biceps Curl (Unilateral)", 30)[0];
    expect(resolveExerciseConfig(e.exerciseName)!.sides).toBe(2);
    expect(entryVolume({ ...e, sets: [{ reps: 12, weight: 30 }] })).toBe(720);
    expect(workoutSummary([{ ...e, sets: [{ reps: 12, weight: 30 }] }]).totalVolume).toBe(720);
    // The both-arms machine at the equivalent stack weight has the same volume.
    expect(entryVolume({ ...e, exerciseName: "Nautilus Impact Bicep Curl", sets: [{ reps: 12, weight: 60 }] })).toBe(720);
  });

  it("the load multiplier a user can set is separate and still defaults to 1", () => {
    expect(resolveExerciseConfig("Single Arm Biceps Curl Machine")!.loadMultiplier).toBe(1);
    expect(resolveExerciseConfig("Bicep Curl Machine")!.sides).toBe(1);
  });
});

describe("scoring matches the both-arms machine at double the per-arm weight", () => {
  it.each([[30, 60], [20, 40], [45, 90]])("%i lb per arm scores like %i lb on the Nautilus Impact curl", (perArm, both) => {
    const unilateral = biceps(sessions("Nautilus Inspiration Biceps Curl (Unilateral)", perArm));
    const bilateral = biceps(sessions("Nautilus Impact Bicep Curl", both));
    expect(unilateral.effective).toBeCloseTo(bilateral.effective!, 9);
    expect(unilateral.peak).toBeCloseTo(bilateral.peak!, 9);
    expect(unilateral.bestLift!.e1RM).toBeCloseTo(bilateral.bestLift!.e1RM, 9);
  });

  it("30 lb per arm is NOT scored as 30 lb on the both-arms machine", () => {
    expect(biceps(sessions("Single Arm Biceps Curl Machine", 30)).effective!).toBeGreaterThan(
      biceps(sessions("Nautilus Impact Bicep Curl", 30)).effective!
    );
  });

  it("the same equivalence holds with the sex setting and at other bodyweights", () => {
    for (const bw of [150, 250]) {
      expect(biceps(sessions("Inspiration Biceps Curl", 25), bw).effective).toBeCloseTo(biceps(sessions("Bicep Curl Machine", 50), bw).effective!, 9);
    }
  });
});

describe("it is not grouped with the both-arms curl machines", () => {
  it("is not the same lift as the Bicep Curl Machine or the Preacher Curl Machine", () => {
    expect(areSameLift(KEY, "bicep curl machine")).toBe(false);
    expect(areSameLift("bicep curl machine", KEY)).toBe(false);
    expect(areSameLift(KEY, "preacher curl machine")).toBe(false);
    const groups = liftGroupMap();
    expect(groups.get(KEY)).toBe(KEY);
    expect(groups.get("bicep curl machine")).toBe(groups.get("preacher curl machine")); // the both-arms machines still group together
    expect(groups.get("bicep curl machine")).not.toBe(groups.get(KEY));
  });

  it("is not grouped with free-weight curls either", () => {
    for (const other of ["bicep curl", "db bicep curl", "hammer curl", "barbell curl", "ez-bar curl"]) {
      expect(areSameLift(KEY, other), other).toBe(false);
    }
  });
});
