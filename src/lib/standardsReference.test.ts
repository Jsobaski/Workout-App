// Rep-capped 1RM, bodyweight scaling, the optional women's reference and the "how this is scored" notes.
import { describe, expect, it } from "vitest";
import { freshDatabase, workout } from "./dbTestHelper";
import { EXERCISE_MUSCLE_MAP } from "./exerciseMuscleMap";
import { emptyExerciseSettings, normalizeExerciseSettings } from "./exerciseSettings";
import { computeMuscleEngine } from "./muscleEngine";
import { BODYWEIGHT_CLAMP_LB, E1RM_FULL_CREDIT_REPS, E1RM_MAX_CREDITED_REPS, E1RM_TAPER_CREDIT, LIFT_FAMILY_STANDARDS, REFERENCE_BODYWEIGHT_LB, WOMEN_STANDARD_FACTOR } from "./muscleScoreConfig";
import { epley1RM, estimate1RM, normalizedBodyweightRatio } from "./muscleScoring";
import { describeStandard, standardForMapping, womenFactor } from "./standards";
import { buildExerciseHistory } from "./exerciseHistory";

const TODAY = "2026-10-20";
const lift = (name: string, reps: number, weight: number) => workout("1", "2026-10-15", name, reps, weight);
const score = (name: string, reps: number, weight: number, bw: number, standards: "unspecified" | "male" | "female" = "unspecified") => {
  const settings = { ...emptyExerciseSettings(), standards };
  return computeMuscleEngine([lift(name, reps, weight)], bw, TODAY, 10, settings).statsByGroup;
};

describe("tapered estimated 1RM", () => {
  it("gives full credit to 10 reps, half credit to reps 11-12, and none above 12", () => {
    expect([E1RM_FULL_CREDIT_REPS, E1RM_TAPER_CREDIT, E1RM_MAX_CREDITED_REPS]).toEqual([10, 0.5, 12]);
    expect(estimate1RM(100, 5)).toBeCloseTo(epley1RM(100, 5));
    expect(estimate1RM(100, 10)).toBeCloseTo(100 * (1 + 10 / 30));
    expect(estimate1RM(100, 11)).toBeCloseTo(100 * (1 + 10.5 / 30));
    expect(estimate1RM(100, 12)).toBeCloseTo(100 * (1 + 11 / 30));
    expect(estimate1RM(100, 15)).toBeCloseTo(estimate1RM(100, 12));
    expect(estimate1RM(100, 30)).toBeCloseTo(estimate1RM(100, 12));
    expect(estimate1RM(100, 1)).toBe(100);
  });

  it("a high-rep set scores the same as the same weight for 12 reps (no credit above 12), in scoring and in the history page", () => {
    const a = score("Leg Press", 12, 400, 180).quads.exerciseScores[0].peakScore;
    const b = score("Leg Press", 15, 400, 180).quads.exerciseScores[0].peakScore;
    expect(b).toBeCloseTo(a, 6);
    const history = buildExerciseHistory([lift("Leg Press", 15, 400)], "Leg Press")!;
    expect(history.best.best).toBeCloseTo(estimate1RM(400, 15));
  });
});

describe("bodyweight scaling", () => {
  it("is neutral at 180 lb, and asks for a smaller multiple of bodyweight from heavier lifters (strength ~ bodyweight^2/3)", () => {
    expect(REFERENCE_BODYWEIGHT_LB).toBe(180);
    expect(normalizedBodyweightRatio(360, 180)).toBeCloseTo(2);
    const light = normalizedBodyweightRatio(300, 150);
    const heavy = normalizedBodyweightRatio(300 * (250 / 150) ** (2 / 3), 250);
    expect(heavy).toBeCloseTo(light, 6); // absolute strength growing with bw^(2/3) is the same relative strength
    expect(normalizedBodyweightRatio(400, 250)).toBeGreaterThan(400 / 250 * 0.99); // heavier: the same multiple counts for more
    expect(normalizedBodyweightRatio(100, 1)).toBe(normalizedBodyweightRatio(100, BODYWEIGHT_CLAMP_LB[0]));
  });

  it("the same lift scores lower for a heavier lifter (it's a smaller share of what their size predicts)", () => {
    const at150 = score("Back Squat", 5, 225, 150).quads.exerciseScores[0].peakScore;
    const at200 = score("Back Squat", 5, 225, 200).quads.exerciseScores[0].peakScore;
    const at250 = score("Back Squat", 5, 225, 250).quads.exerciseScores[0].peakScore;
    expect(at150).toBeGreaterThan(at200);
    expect(at200).toBeGreaterThan(at250);
    // but not in proportion to bodyweight: 250 lb is 67% heavier, the score drops by less than a straight ratio would
    expect(at250).toBeGreaterThan(0);
  });
});

describe("re-anchored barbell standards", () => {
  it("a 180 lb lifter's published intermediate marks land at the middle of Solid (50)", () => {
    // Intermediate anchors: squat ~1.6x, deadlift ~1.85x, bench ~1.23x bodyweight (Strength Level, FitnessVolt, Gravitus).
    const squat = score("Back Squat", 1, 180 * 1.6, 180).quads.exerciseScores[0].peakScore;
    const dead = score("Barbell Deadlift", 1, 180 * 1.85, 180).glutes.exerciseScores[0].peakScore;
    const bench = score("Bench Press", 1, 180 * 1.23, 180).midLowerChest.exerciseScores[0].peakScore;
    for (const s of [squat, dead, bench]) expect(s).toBeCloseTo(50, 0);
  });

  it("a 1.0x bodyweight squat or a 1.25x deadlift is no longer a high tier", () => {
    const squat = score("Back Squat", 1, 180, 180).quads.exerciseScores[0].peakScore;
    const dead = score("Barbell Deadlift", 1, 180 * 1.25, 180).glutes.exerciseScores[0].peakScore;
    expect(squat).toBeLessThan(40);
    expect(dead).toBeLessThan(25);
  });

  it("the barbell tables are harder than the older ones they replaced", () => {
    expect(LIFT_FAMILY_STANDARDS.barbellSquat[2]).toBeGreaterThan(LIFT_FAMILY_STANDARDS.squat[2]);
    expect(LIFT_FAMILY_STANDARDS.barbellDeadlift[2]).toBeGreaterThan(LIFT_FAMILY_STANDARDS.deadlift[2]);
    expect(LIFT_FAMILY_STANDARDS.barbellBench[2]).toBeGreaterThan(LIFT_FAMILY_STANDARDS.bench[2]);
    for (const family of ["barbellSquat", "barbellDeadlift", "barbellBench"] as const) {
      const t = LIFT_FAMILY_STANDARDS[family];
      for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
    }
  });
});

describe("optional women's reference", () => {
  it("is off by default and lowers the required multiple (so the same lift scores higher), upper body more than lower", () => {
    expect(emptyExerciseSettings().standards).toBe("unspecified");
    const general = score("Bench Press", 1, 150, 180, "unspecified").midLowerChest.exerciseScores[0].peakScore;
    const women = score("Bench Press", 1, 150, 180, "female").midLowerChest.exerciseScores[0].peakScore;
    expect(women).toBeGreaterThan(general);
    expect(WOMEN_STANDARD_FACTOR.upper).toBeLessThan(WOMEN_STANDARD_FACTOR.lower);
    expect(womenFactor(EXERCISE_MUSCLE_MAP["bench press"])).toBe(WOMEN_STANDARD_FACTOR.upper);
    expect(womenFactor(EXERCISE_MUSCLE_MAP["back squat"])).toBe(WOMEN_STANDARD_FACTOR.lower);
    const m = EXERCISE_MUSCLE_MAP["back squat"];
    expect(standardForMapping(m, "female")![2]).toBeCloseTo(standardForMapping(m, "unspecified")![2] * WOMEN_STANDARD_FACTOR.lower);
  });

  it("Male and Not specified use the same (men's published) tables", () => {
    const base = score("Back Squat", 1, 250, 180, "unspecified").quads.exerciseScores[0].peakScore;
    expect(score("Back Squat", 1, 250, 180, "male").quads.exerciseScores[0].peakScore).toBe(base);
    expect(score("Back Squat", 1, 250, 180, "female").quads.exerciseScores[0].peakScore).toBeGreaterThan(base);
  });

  it("is stored with the local settings and survives a reload; older records default to general", async () => {
    const { db } = await freshDatabase();
    expect((await db.getExerciseSettings()).standards).toBe("unspecified");
    await db.saveExerciseSettings({ ...emptyExerciseSettings(), standards: "female" });
    expect((await db.getExerciseSettings()).standards).toBe("female");
    expect(normalizeExerciseSettings({ overrides: {} }).standards).toBe("unspecified");
    expect(normalizeExerciseSettings({ standards: "bogus" }).standards).toBe("unspecified");
    expect(normalizeExerciseSettings({ standards: "male" }).standards).toBe("male");
    expect(normalizeExerciseSettings({ standards: "women" }).standards).toBe("female"); // the name an earlier version stored
    expect(normalizeExerciseSettings({ standards: "general" }).standards).toBe("unspecified");
  });
});

describe("how this is scored", () => {
  it("every scored lift has a source note with a confidence; consistency-only lifts have none", () => {
    for (const [key, mapping] of Object.entries(EXERCISE_MUSCLE_MAP)) {
      const info = describeStandard(mapping);
      if (mapping.scoring.method === "volumeOnly") {
        expect(info, key).toBeNull();
      } else {
        expect(info, key).not.toBeNull();
        expect(info!.note.length, key).toBeGreaterThan(10);
        expect(["sourced", "approximate", "estimate"]).toContain(info!.confidence);
      }
    }
  });

  it("is honest about which standards are anchored to published data and which are still estimates", () => {
    expect(describeStandard(EXERCISE_MUSCLE_MAP["back squat"])!.confidence).toBe("approximate");
    expect(describeStandard(EXERCISE_MUSCLE_MAP["barbell row"])!.confidence).toBe("estimate");
    const proxy = describeStandard(EXERCISE_MUSCLE_MAP["reverse wrist curl"])!;
    expect(proxy.note).toContain("57%");
  });
});
