// Audit of the strength standards. Synthetic beginner / intermediate / advanced
// lifters are run through the real engine at several bodyweights. Reference
// ratios are approximate, commonly cited 1RM-to-bodyweight figures (dumbbell
// lifts are per hand, stack machines are the stack number). The point isn't
// precision — it's that no isolation or machine lift can reach Elite at a
// trivially low ratio, and that the tiers sit in a sensible order.
import { describe, expect, it } from "vitest";
import { EXERCISE_MUSCLE_MAP } from "./exerciseMuscleMap";
import { computeMuscleEngine, tierForScore } from "./muscleEngine";
import { LIFT_FAMILY_STANDARDS } from "./muscleScoreConfig";
import { ratioForScore, ratioToUncappedScore, softCapScore } from "./muscleScoring";
import { WorkoutEntry } from "./types";

type Category = "isolation" | "machine" | "compound";
type Profile = [beginner: number, intermediate: number, advanced: number];

// 1RM / bodyweight.
const REFERENCE: Record<string, { category: Category; ratios: Profile }> = {
  // machines & cable stacks
  "leg press": { category: "machine", ratios: [1.0, 2.0, 3.2] },
  "leg extension": { category: "machine", ratios: [0.4, 0.9, 1.5] },
  "lying leg curl": { category: "machine", ratios: [0.3, 0.55, 0.9] },
  "seated leg curl": { category: "machine", ratios: [0.3, 0.55, 0.9] },
  "standing leg curl": { category: "machine", ratios: [0.15, 0.3, 0.5] },
  "hack squat": { category: "machine", ratios: [0.6, 1.2, 2.0] },
  "hip abduction machine": { category: "machine", ratios: [0.35, 0.8, 1.3] },
  "hip adduction machine": { category: "machine", ratios: [0.35, 0.8, 1.3] },
  "cable glute kickback": { category: "machine", ratios: [0.1, 0.25, 0.5] },
  "pec deck": { category: "machine", ratios: [0.25, 0.5, 0.8] },
  "cable fly": { category: "machine", ratios: [0.1, 0.2, 0.35] },
  "cable curl": { category: "machine", ratios: [0.15, 0.3, 0.55] },
  "rope overhead tricep extension": { category: "machine", ratios: [0.25, 0.5, 0.85] },
  "lat pulldown": { category: "machine", ratios: [0.6, 1.0, 1.5] },
  "cable row": { category: "machine", ratios: [0.5, 0.9, 1.4] },
  "cable face pulls": { category: "machine", ratios: [0.25, 0.45, 0.75] },
  "rear delt machine": { category: "machine", ratios: [0.25, 0.5, 0.8] },
  "chest press machine": { category: "machine", ratios: [0.4, 0.8, 1.3] },
  "incline chest press machine": { category: "machine", ratios: [0.3, 0.65, 1.1] },
  "shoulder press machine": { category: "machine", ratios: [0.3, 0.55, 0.9] },
  "lateral raise machine": { category: "machine", ratios: [0.1, 0.25, 0.45] },
  "bicep curl machine": { category: "machine", ratios: [0.25, 0.5, 0.8] },
  "preacher curl machine": { category: "machine", ratios: [0.25, 0.5, 0.8] },
  "tricep pushdown": { category: "machine", ratios: [0.3, 0.6, 1.0] },
  "tricep extension machine": { category: "machine", ratios: [0.3, 0.6, 1.0] },
  "single arm cable tricep extension": { category: "machine", ratios: [0.1, 0.25, 0.4] },
  "cable hip abduction": { category: "machine", ratios: [0.1, 0.25, 0.5] },
  // isolation
  "lateral raise": { category: "isolation", ratios: [0.05, 0.12, 0.22] },
  "bicep curl": { category: "isolation", ratios: [0.1, 0.22, 0.38] },
  "db bicep curl": { category: "isolation", ratios: [0.1, 0.22, 0.38] },
  "hammer curl": { category: "isolation", ratios: [0.12, 0.25, 0.4] },
  "skull crusher": { category: "isolation", ratios: [0.2, 0.45, 0.75] },
  "db overhead tricep extension": { category: "isolation", ratios: [0.15, 0.35, 0.6] },
  // Dumbbell wrist curl (per hand): published intermediate ~0.34-0.36x, advanced ~0.60x bodyweight (Strength Level, FitnessVolt).
  "wrist curl": { category: "isolation", ratios: [0.12, 0.34, 0.6] },
  // Extensors are ~0.57x the flexors (isokinetic study; Strength Level dumbbell reverse vs. normal wrist curl).
  "reverse wrist curl": { category: "isolation", ratios: [0.07, 0.19, 0.34] },
  "reverse curl": { category: "isolation", ratios: [0.2, 0.4, 0.65] },
  "calf raise": { category: "isolation", ratios: [0.8, 1.5, 2.2] },
  "seated calf raise": { category: "isolation", ratios: [0.6, 1.1, 1.7] },
  "dumbbell fly": { category: "isolation", ratios: [0.1, 0.2, 0.35] },
  "shrugs": { category: "isolation", ratios: [0.5, 1.0, 1.7] },
  "rear delt fly": { category: "isolation", ratios: [0.05, 0.12, 0.22] },
  "ez-bar curl": { category: "isolation", ratios: [0.2, 0.45, 0.75] },
  "barbell curl": { category: "isolation", ratios: [0.2, 0.45, 0.75] },
  "concentration curl": { category: "isolation", ratios: [0.08, 0.18, 0.3] },
  "tricep kickback": { category: "isolation", ratios: [0.06, 0.14, 0.25] },
  "pullover": { category: "isolation", ratios: [0.15, 0.3, 0.5] },
  // compounds (strict checks limited to "never Elite before advanced")
  "trap bar deadlift": { category: "compound", ratios: [0.9, 1.5, 2.2] },
  "barbell deadlift": { category: "compound", ratios: [0.85, 1.4, 2.1] },
  "romanian deadlift": { category: "compound", ratios: [0.65, 1.1, 1.7] },
  "db romanian deadlift": { category: "compound", ratios: [0.2, 0.4, 0.7] },
  "back squat": { category: "compound", ratios: [0.7, 1.2, 1.8] },
  "front squat": { category: "compound", ratios: [0.55, 0.95, 1.45] },
  "goblet squat": { category: "compound", ratios: [0.25, 0.5, 0.85] },
  "hip thrust": { category: "compound", ratios: [0.8, 1.5, 2.3] },
  "bench press": { category: "compound", ratios: [0.5, 0.9, 1.4] },
  "db bench press": { category: "compound", ratios: [0.3, 0.55, 0.85] },
  "incline db press": { category: "compound", ratios: [0.25, 0.45, 0.7] },
  "overhead press": { category: "compound", ratios: [0.35, 0.6, 0.9] },
  "db shoulder press": { category: "compound", ratios: [0.15, 0.3, 0.5] },
  "barbell row": { category: "compound", ratios: [0.45, 0.8, 1.2] },
  "farmer carry": { category: "compound", ratios: [0.3, 0.5, 0.8] },
  "step-ups": { category: "compound", ratios: [0.15, 0.35, 0.6] },
  "good morning": { category: "compound", ratios: [0.35, 0.65, 1.0] },
  "forward lunge": { category: "compound", ratios: [0.15, 0.3, 0.5] },
  "incline barbell bench": { category: "compound", ratios: [0.4, 0.75, 1.15] },
  "decline bench": { category: "compound", ratios: [0.55, 1.0, 1.5] },
  "close-grip bench": { category: "compound", ratios: [0.45, 0.8, 1.25] },
  "t-bar row": { category: "compound", ratios: [0.4, 0.75, 1.15] },
  "one-arm dumbbell row": { category: "compound", ratios: [0.25, 0.45, 0.75] },
  "chest-supported row": { category: "compound", ratios: [0.35, 0.65, 1.0] },
  "arnold press": { category: "compound", ratios: [0.15, 0.3, 0.5] },
  "kettlebell swing": { category: "compound", ratios: [0.12, 0.25, 0.45] },
  "walking lunge": { category: "compound", ratios: [0.15, 0.3, 0.5] },
  "db reverse lunge": { category: "compound", ratios: [0.15, 0.3, 0.5] },
  "db bulgarian split squat": { category: "compound", ratios: [0.15, 0.3, 0.5] },
  "single-leg romanian deadlift": { category: "compound", ratios: [0.15, 0.3, 0.5] },
};

// Bodyweight-logged lifts are profiled by reps instead of a 1RM ratio.
const BODYWEIGHT_REPS: Record<string, Profile> = {
  "pull up": [2, 8, 16],
  "chin up": [3, 10, 18],
  dip: [4, 12, 25],
  "push up": [10, 30, 50],
  "glute bridge": [15, 30, 50],
  "single leg bridge": [8, 15, 25],
  "back extension": [10, 20, 30],
  "bench dips": [5, 15, 30],
  "close-grip push-up": [8, 25, 40],
};

const BODYWEIGHTS = [130, 165, 200, 250];
const LEVELS = ["beginner", "intermediate", "advanced"] as const;
const TODAY = "2026-10-17";

function standardsFor(key: string): [number, number, number, number, number] {
  const m = EXERCISE_MUSCLE_MAP[key].scoring;
  if (m.method === "standard") return LIFT_FAMILY_STANDARDS[m.family];
  if (m.method === "proxy") return LIFT_FAMILY_STANDARDS[m.family].map((v) => v * m.factor) as [number, number, number, number, number];
  throw new Error(`${key} is not load-scored`);
}

function entryFor(key: string, bodyweightLb: number, level: number): WorkoutEntry {
  const reps = 5;
  const bodyweightReps = BODYWEIGHT_REPS[key];
  return {
    id: `${key}-${level}`,
    dateKey: "2026-10-15",
    timestamp: Date.parse("2026-10-15T12:00:00"),
    exerciseName: key,
    muscleGroups: [],
    bodyweight: bodyweightReps ? true : undefined,
    sets: bodyweightReps
      ? [{ reps: bodyweightReps[level], weight: 0 }]
      : // choose the weight so the set's e1RM equals the profile's 1RM
        [{ reps, weight: (REFERENCE[key].ratios[level] * bodyweightLb) / (1 + reps / 30) }],
  };
}

/** Score of the exercise at a profile level, through the real engine, for its primary (or best) muscle. */
function engineScore(key: string, bodyweightLb: number, level: number): number {
  const mapping = EXERCISE_MUSCLE_MAP[key];
  // Exercises that only give secondary credit (e.g. hip adduction machine) are scored on the table itself.
  if (!mapping.muscles.some((m) => m.weight >= 1) && REFERENCE[key]) {
    return softCapScore(ratioToUncappedScore(REFERENCE[key].ratios[level], standardsFor(key)));
  }
  const group = (mapping.muscles.find((m) => m.weight >= 1) ?? mapping.muscles[0]).group;
  const { statsByGroup } = computeMuscleEngine([entryFor(key, bodyweightLb, level)], bodyweightLb, TODAY);
  return statsByGroup[group].exerciseScores.find((e) => e.key === key)!.peakScore;
}

describe("strength standards audit", () => {
  const loadScored = Object.entries(EXERCISE_MUSCLE_MAP)
    .filter(([, m]) => m.scoring.method !== "volumeOnly" && !m.hidden)
    .map(([k]) => k);

  it("has a synthetic profile for every load-scored exercise in the library (add one when you add an exercise)", () => {
    const missing = loadScored.filter((k) => !REFERENCE[k] && !BODYWEIGHT_REPS[k]);
    expect(missing).toEqual([]);
  });

  it("tiers come out the same at every bodyweight (scoring is bodyweight-relative)", () => {
    for (const key of Object.keys(REFERENCE)) {
      for (let level = 0; level < 3; level++) {
        const tiers = BODYWEIGHTS.map((bw) => tierForScore(engineScore(key, bw, level)).id);
        expect(new Set(tiers).size, `${key} ${LEVELS[level]}`).toBe(1);
      }
    }
  });

  it("no isolation or machine lift is Elite for a beginner or intermediate, and advanced lifters clear Strong", () => {
    for (const [key, { category, ratios }] of Object.entries(REFERENCE)) {
      if (category === "compound") continue;
      const [beg, int, adv] = ratios.map((_, level) => engineScore(key, 165, level));
      expect(beg, `${key} beginner`).toBeLessThan(40);
      expect(int, `${key} intermediate`).toBeGreaterThanOrEqual(20);
      expect(int, `${key} intermediate`).toBeLessThan(80);
      expect(adv, `${key} advanced`).toBeGreaterThanOrEqual(55);
    }
  });

  it("Elite takes a clearly-above-intermediate ratio on every isolation/machine lift", () => {
    for (const [key, { category, ratios }] of Object.entries(REFERENCE)) {
      if (category === "compound") continue;
      const eliteRatio = ratioForScore(80, standardsFor(key));
      expect(eliteRatio, `${key} elite ratio ${eliteRatio.toFixed(2)}`).toBeGreaterThanOrEqual(ratios[1] * 1.2);
    }
  });

  it("compounds are never Elite for a beginner or intermediate lifter", () => {
    for (const [key, { ratios }] of Object.entries(REFERENCE)) {
      expect(engineScore(key, 165, 0), `${key} beginner`).toBeLessThan(80);
      expect(engineScore(key, 165, 1), `${key} intermediate`).toBeLessThan(80);
      void ratios;
    }
  });

  it("scores rise with level for every profiled lift", () => {
    for (const key of [...Object.keys(REFERENCE), ...Object.keys(BODYWEIGHT_REPS)]) {
      const [a, b, c] = [0, 1, 2].map((l) => engineScore(key, 165, l));
      expect(b, key).toBeGreaterThanOrEqual(a);
      expect(c, key).toBeGreaterThanOrEqual(b);
    }
  });

  describe("forearm wrist curls scale with bodyweight", () => {
    const sets = (weight: number, reps: number) => [{ reps, weight }];
    const lift = (key: string, bw: number, weight: number, reps: number) => {
      const entry: WorkoutEntry = { id: "w", dateKey: "2026-10-15", timestamp: Date.parse("2026-10-15T12:00:00"), exerciseName: key, muscleGroups: [], sets: sets(weight, reps) };
      const score = computeMuscleEngine([entry], bw, TODAY).statsByGroup.forearms.exerciseScores.find((e) => e.key === key)!.peakScore;
      return { score, tier: tierForScore(score).id };
    };
    // Loads from ratios of 1RM to bodyweight, as the profiles above, so the same relative strength is tested at each weight.
    const loadFor = (ratio: number, bw: number, reps: number) => (ratio * bw) / (1 + reps / 30);

    for (const bw of [150, 205]) {
      it(`${bw} lb: a returning lifter's 15 lb x 15 wrist curl is Developing, not Needs Work`, () => {
        expect(lift("wrist curl", bw, 15, 15).tier).toBe("developing");
      });

      it(`${bw} lb: an intermediate wrist curl (0.34x bodyweight) is Solid, an advanced one Strong or better`, () => {
        expect(lift("wrist curl", bw, loadFor(0.34, bw, 10), 10).tier).toBe("solid");
        expect(["strong", "elite"]).toContain(lift("wrist curl", bw, loadFor(0.6, bw, 10), 10).tier);
      });

      it(`${bw} lb: reverse wrist curls are calibrated lower (a lighter load earns the same tier)`, () => {
        const wrist = lift("wrist curl", bw, loadFor(0.34, bw, 10), 10);
        const reverseSameRelativeLoad = lift("reverse wrist curl", bw, loadFor(0.34 * 0.57, bw, 10), 10);
        expect(reverseSameRelativeLoad.tier).toBe(wrist.tier);
        expect(lift("reverse wrist curl", bw, loadFor(0.19, bw, 10), 10).tier).toBe("solid");
      });
    }

    it("a heavier lifter needs a heavier absolute load for the same score, and the two lifts keep separate standards", () => {
      expect(lift("wrist curl", 150, 15, 15).score).toBeGreaterThan(lift("wrist curl", 205, 15, 15).score);
      const wrist = standardsFor("wrist curl");
      const reverse = standardsFor("reverse wrist curl");
      reverse.forEach((v, i) => expect(v).toBeLessThan(wrist[i]));
      expect(EXERCISE_MUSCLE_MAP["wrist curl"].scoring).not.toEqual(EXERCISE_MUSCLE_MAP["reverse wrist curl"].scoring);
    });

    it("does not score against a deadlift-sized benchmark", () => {
      for (const key of ["wrist curl", "reverse wrist curl"]) {
        const scoring = EXERCISE_MUSCLE_MAP[key].scoring;
        expect(scoring.method === "standard" || scoring.method === "proxy" ? scoring.family : null).toBe("wristCurl");
      }
    });
  });

  it("prints the tier table (score and tier per profile)", () => {
    const rows = [`${"exercise".padEnd(34)} ${"kind".padEnd(9)} beginner        intermediate    advanced`];
    const cell = (score: number) => `${tierForScore(score).label.padEnd(10)}${String(Math.round(score)).padStart(3)}`;
    for (const key of [...Object.keys(REFERENCE), ...Object.keys(BODYWEIGHT_REPS)].sort()) {
      const kind = REFERENCE[key]?.category ?? "bodyweight";
      rows.push(`${key.padEnd(34)} ${kind.padEnd(9)} ${[0, 1, 2].map((l) => cell(engineScore(key, 165, l)).padEnd(15)).join(" ")}`);
    }
    rows.push("", `(checked at bodyweights ${BODYWEIGHTS.join(", ")} lb — tiers identical at each)`);
    console.log(rows.join("\n"));
  });
});
