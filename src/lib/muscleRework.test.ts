import { describe, expect, it } from "vitest";
import { computeMuscleEngine, tierForScore } from "./muscleEngine";
import { compareSnapshots, describeDelta, pluralize } from "./muscleComparison";
import { buildFocusList } from "./muscleFocus";
import { EXERCISE_ALIASES, EXERCISE_MUSCLE_MAP, canonicalExerciseKey } from "./exerciseMuscleMap";
import { exercisesForMuscle } from "./exerciseSuggestions";
import { emptyExerciseSettings, resolveExerciseConfig } from "./exerciseSettings";
import { entryVolume, workoutSummary } from "./aggregate";
import { ratioToUncappedScore, softCapScore } from "./muscleScoring";
import { LIFT_FAMILY_STANDARDS } from "./muscleScoreConfig";
import { WorkoutEntry } from "./types";

const BW = 205;
const TODAY = "2026-10-17";

function make(
  id: string,
  dateKey: string,
  exerciseName: string,
  sets: { reps: number; weight: number; durationSec?: number }[],
  flags: { bodyweight?: boolean; timed?: boolean } = {}
): WorkoutEntry {
  return {
    id,
    dateKey,
    timestamp: new Date(`${dateKey}T12:00:00`).getTime(),
    exerciseName,
    muscleGroups: [],
    sets,
    ...flags,
  };
}

describe("scoring scale", () => {
  it("keeps climbing past 100 internally while the displayed score never reaches 100", () => {
    const standards = LIFT_FAMILY_STANDARDS.bench;
    const raw = ratioToUncappedScore(standards[4] * 1.4, standards);
    expect(raw).toBeGreaterThan(100);
    expect(softCapScore(raw)).toBeLessThan(100);
    expect(softCapScore(raw)).toBeGreaterThan(softCapScore(100));
    expect(softCapScore(50)).toBe(50);
  });

  it("a huge lift shows an uncapped raw value above the displayed score", () => {
    const { statsByGroup } = computeMuscleEngine([make("1", "2026-10-15", "Lateral Raise", [{ reps: 12, weight: 60 }])], BW, TODAY);
    const s = statsByGroup.sideRearDelts;
    expect(s.effectiveRaw!).toBeGreaterThan(100);
    expect(s.effective!).toBeLessThan(100);
  });
});

describe("bodyweight credit", () => {
  it("single leg bridge at 205 lb x 12 no longer pins glutes at Elite/100", () => {
    const { statsByGroup } = computeMuscleEngine(
      [make("1", "2026-10-16", "Single Leg Bridge", [{ reps: 12, weight: 0 }], { bodyweight: true })],
      BW,
      TODAY
    );
    const glutes = statsByGroup.glutes;
    expect(glutes.bestLift!.e1RM).toBeCloseTo(BW * 0.5 * (1 + 12 / 30), 5); // 143.5, not ~287
    expect(glutes.effective!).toBeLessThan(60);
    expect(tierForScore(glutes.effective!).id).not.toBe("elite");
  });

  it("bodyweight moves with fraction 0 (planks, clamshells, lateral walks) don't feed strength tiers", () => {
    const { statsByGroup } = computeMuscleEngine(
      [
        make("1", "2026-10-15", "Clamshells with Band", [{ reps: 15, weight: 0 }], { bodyweight: true }),
        make("2", "2026-10-16", "Standing Hip Abduction", [{ reps: 15, weight: 0 }], { bodyweight: true }),
      ],
      BW,
      TODAY
    );
    expect(statsByGroup.glutes.scoringBasis).toBe("reps-time");
    expect(statsByGroup.glutes.bestLift).toBeNull();
    expect(statsByGroup.glutes.exerciseScores).toHaveLength(0);
  });

  it("workout total volume uses the same bodyweight logic as scoring", () => {
    const bridge = make("1", "2026-10-16", "Single Leg Bridge", [{ reps: 12, weight: 0 }], { bodyweight: true });
    const plank = make("2", "2026-10-16", "Plank", [{ reps: 1, weight: 0 }], { bodyweight: true });
    const clam = make("3", "2026-10-16", "Clamshells with Band", [{ reps: 15, weight: 0 }], { bodyweight: true });
    expect(entryVolume(bridge, { bodyweightLb: BW })).toBeCloseTo(12 * BW * 0.5, 5);
    expect(entryVolume(plank, { bodyweightLb: BW })).toBe(0);
    expect(entryVolume(clam, { bodyweightLb: BW })).toBe(0);
    expect(workoutSummary([bridge, plank, clam], { bodyweightLb: BW }).totalVolume).toBe(1230);
  });
});

const withOverrides = (overrides: Record<string, object>) => ({ ...emptyExerciseSettings(), overrides });

describe("load multiplier (manual only)", () => {
  const press = [make("1", "2026-10-15", "Chest Press Machine", [{ reps: 8, weight: 100 }])];

  it("defaults to 1.0 for every exercise in the shared library", () => {
    for (const key of Object.keys(EXERCISE_MUSCLE_MAP)) {
      expect(resolveExerciseConfig(key)!.loadMultiplier, key).toBe(1);
    }
  });

  it("a manual multiplier converts logged weight to an effective load before scoring", () => {
    const base = computeMuscleEngine(press, BW, TODAY);
    const scaled = computeMuscleEngine(press, BW, TODAY, undefined, withOverrides({ "chest press machine": { loadMultiplier: 1.5 } }));
    expect(scaled.statsByGroup.midLowerChest.bestLift!.e1RM).toBeCloseTo(base.statsByGroup.midLowerChest.bestLift!.e1RM * 1.5, 5);
  });

  it("flows into total volume", () => {
    const settings = withOverrides({ "chest press machine": { loadMultiplier: 2 } });
    expect(entryVolume(press[0], { bodyweightLb: BW, settings })).toBe(8 * 100 * 2);
    expect(entryVolume(press[0], { bodyweightLb: BW })).toBe(8 * 100);
  });

  it("branded machine names resolve to generic exercises, with no brand-specific adjustment", () => {
    for (const [brand, generic] of [
      ["Nautilus Leverage Chest Press", "chest press machine"],
      ["Hoist preacher curl machine", "preacher curl machine"],
      ["Nautilus Impact Tricep Extension", "tricep extension machine"],
      ["Deltoid raise machine", "lateral raise machine"],
    ]) {
      expect(canonicalExerciseKey(brand), brand).toBe(generic);
      expect(resolveExerciseConfig(brand)!.loadMultiplier, brand).toBe(1);
    }
    expect(Object.keys(EXERCISE_MUSCLE_MAP).filter((k) => /nautilus|hoist/.test(k))).toEqual([]);
  });

  it("stored overrides keep applying after a brand name became an alias", async () => {
    const { normalizeExerciseSettings } = await import("./exerciseSettings");
    const normalized = normalizeExerciseSettings({ key: "exerciseSettings", overrides: { "nautilus leverage chest press": { loadMultiplier: 1.3 } } });
    expect(normalized.overrides["chest press machine"]?.loadMultiplier).toBe(1.3);
  });
});

describe("isolation/machine standards", () => {
  it("no longer pin biceps, delts, triceps or rear delts at huge raw scores", () => {
    const { statsByGroup } = computeMuscleEngine(
      [
        make("1", "2026-10-15", "Hoist preacher curl machine", [{ reps: 10, weight: 80 }]),
        make("2", "2026-10-15", "Lateral Raise", [{ reps: 12, weight: 20 }]),
        make("3", "2026-10-15", "Nautilus Impact Tricep Extension", [{ reps: 10, weight: 80 }]),
        make("4", "2026-10-15", "Cable Face Pulls", [{ reps: 15, weight: 40 }]),
      ],
      BW,
      TODAY
    );
    expect(statsByGroup.biceps.effectiveRaw!).toBeLessThan(100);
    expect(statsByGroup.sideRearDelts.effectiveRaw!).toBeLessThan(100);
    expect(statsByGroup.triceps.effectiveRaw!).toBeLessThan(100);
    // a 20 lb x 12 lateral raise should land mid-pack, not Elite
    expect(tierForScore(statsByGroup.sideRearDelts.effective!).id).not.toBe("elite");
  });
});

describe("like-for-like deltas", () => {
  it("a lead lift on a different load basis is 'new exercise, no comparison' — never a number", () => {
    const entries = [
      make("1", "2026-09-17", "DB Bench Press", [{ reps: 8, weight: 40 }]),
      make("2", "2026-10-15", "Chest Press Machine", [{ reps: 8, weight: 110 }]), // plates, not free weight
    ];
    const before = computeMuscleEngine(entries, BW, "2026-09-18");
    const after = computeMuscleEngine(entries, BW, TODAY);
    expect(after.statsByGroup.midLowerChest.effective!).toBeGreaterThan(before.statsByGroup.midLowerChest.effective! + 10);
    const delta = compareSnapshots(before.statsByGroup, after.statsByGroup).midLowerChest;
    expect(delta.status).toBe("new");
    expect(delta.delta).toBeNull();
  });

  it("measures real progress on the same exercise", () => {
    const entries = [
      make("1", "2026-09-17", "DB Bench Press", [{ reps: 8, weight: 40 }]),
      make("2", "2026-10-15", "DB Bench Press", [{ reps: 8, weight: 55 }]),
    ];
    const before = computeMuscleEngine(entries, BW, "2026-09-18");
    const after = computeMuscleEngine(entries, BW, TODAY);
    const delta = compareSnapshots(before.statsByGroup, after.statsByGroup).midLowerChest;
    expect(delta.status).toBe("like-for-like");
    expect(delta.delta!).toBeGreaterThan(0);
    expect(delta.anchorExercise).toBe("DB Bench Press");
  });

  it("reports new muscles as new, not as a jump", () => {
    const after = computeMuscleEngine([make("1", "2026-10-15", "Back Squat", [{ reps: 5, weight: 185 }])], BW, TODAY);
    const before = computeMuscleEngine([], BW, "2026-09-18");
    expect(compareSnapshots(before.statsByGroup, after.statsByGroup).quads.status).toBe("new");
  });
});

describe("shared sources", () => {
  it("forearms have their own sources; curls only give minor credit and never reset the clock", () => {
    const curlsOnly = computeMuscleEngine([make("1", "2026-10-16", "DB Bicep Curl", [{ reps: 10, weight: 30 }])], BW, TODAY);
    expect(curlsOnly.statsByGroup.forearms.lastTrainedDateKey).toBeNull();
    expect(curlsOnly.statsByGroup.forearms.isStale).toBe(true);
    expect(curlsOnly.statsByGroup.biceps.lastTrainedDateKey).toBe("2026-10-16");

    const withWrist = computeMuscleEngine(
      [
        make("1", "2026-10-16", "DB Bicep Curl", [{ reps: 10, weight: 30 }]),
        make("2", "2026-10-15", "Wrist Curl", [{ reps: 12, weight: 30 }]),
      ],
      BW,
      TODAY
    );
    expect(withWrist.statsByGroup.forearms.bestLift!.exerciseName).toBe("Wrist Curl");
    expect(withWrist.statsByGroup.biceps.bestLift!.exerciseName).toBe("DB Bicep Curl");
    expect(withWrist.statsByGroup.forearms.lastTrainedDateKey).toBe("2026-10-15");
  });

  it("abs and obliques are scored from separate exercise sets", () => {
    const { statsByGroup } = computeMuscleEngine(
      [
        make("1", "2026-10-10", "Plank", [{ reps: 1, weight: 0 }], { bodyweight: true }),
        make("2", "2026-10-12", "Dead Bug", [{ reps: 10, weight: 0 }], { bodyweight: true }),
        make("3", "2026-10-14", "Pallof Press", [{ reps: 10, weight: 25 }]),
      ],
      BW,
      TODAY
    );
    expect(statsByGroup.abs.contributingExercises).toEqual(["Dead Bug", "Plank"]);
    expect(statsByGroup.obliques.contributingExercises).toEqual(["Pallof Press"]);
    expect(statsByGroup.abs.effective).not.toBe(statsByGroup.obliques.effective);
  });
});

describe("secondary credit is capped by the muscle's own primary lift", () => {
  it("triceps are scored from tricep lifts, not the chest press", () => {
    const benchOnly = computeMuscleEngine([make("1", "2026-10-15", "Bench Press", [{ reps: 5, weight: 225 }])], BW, TODAY).statsByGroup.triceps;
    expect(benchOnly.scoringBasis).toBe("reps-time"); // no tricep lift logged
    expect(benchOnly.bestLift).toBeNull();
    expect(benchOnly.lastTrainedDateKey).toBeNull();
    expect(benchOnly.peak!).toBeLessThanOrEqual(25);

    const withPushdown = computeMuscleEngine(
      [
        make("1", "2026-10-15", "Bench Press", [{ reps: 5, weight: 225 }]),
        make("2", "2026-10-15", "Tricep Pushdown", [{ reps: 10, weight: 50 }]),
      ],
      BW,
      TODAY
    ).statsByGroup.triceps;
    const pushdownOnly = computeMuscleEngine([make("2", "2026-10-15", "Tricep Pushdown", [{ reps: 10, weight: 50 }])], BW, TODAY).statsByGroup.triceps;
    expect(withPushdown.bestLift!.exerciseName).toBe("Tricep Pushdown");
    expect(withPushdown.peak!).toBeCloseTo(pushdownOnly.peak!, 5);
  });

  it("secondary credit never exceeds half of the muscle's best primary lift", () => {
    const { statsByGroup } = computeMuscleEngine(
      [
        make("1", "2026-10-15", "Wrist Curl", [{ reps: 10, weight: 10 }]), // weak primary forearm lift
        make("2", "2026-10-15", "Barbell Deadlift", [{ reps: 5, weight: 405 }]), // huge secondary forearm credit
      ],
      BW,
      TODAY
    );
    const forearms = statsByGroup.forearms;
    const primary = forearms.exerciseScores.find((e) => e.key === "wrist curl")!;
    expect(forearms.bestLift!.exerciseName).toBe("Wrist Curl");
    // score is the primary lift's (+ consistency), not inflated by the deadlift
    expect(forearms.peakRaw!).toBeLessThan(primary.peakScore + 11);
  });
});

describe("lat pulldown is the primary lat lift", () => {
  it("pull-ups only credit lats as secondary; pulldowns drive the lat score and clock", () => {
    const pullUpOnly = computeMuscleEngine([make("1", "2026-10-15", "Pull Up", [{ reps: 8, weight: 0 }], { bodyweight: true })], BW, TODAY).statsByGroup.lats;
    expect(pullUpOnly.lastTrainedDateKey).toBeNull();
    expect(pullUpOnly.bestLift).toBeNull();
    const withPulldown = computeMuscleEngine(
      [
        make("1", "2026-10-15", "Pull Up", [{ reps: 8, weight: 0 }], { bodyweight: true }),
        make("2", "2026-10-14", "Lat Pulldown", [{ reps: 10, weight: 140 }]),
      ],
      BW,
      TODAY
    ).statsByGroup.lats;
    expect(withPulldown.bestLift!.exerciseName).toBe("Lat Pulldown");
    expect(withPulldown.lastTrainedDateKey).toBe("2026-10-14");
  });
});

describe("secondary credit", () => {
  it("lateral walks and back extensions don't make quads 'trained 1 day ago'", () => {
    const { statsByGroup } = computeMuscleEngine(
      [
        make("1", "2026-09-05", "Back Squat", [{ reps: 5, weight: 185 }]),
        make("2", "2026-10-16", "Banded Lateral Walks", [{ reps: 12, weight: 0 }], { bodyweight: true }),
        make("3", "2026-10-16", "Back Extension", [{ reps: 12, weight: 0 }], { bodyweight: true }),
        make("4", "2026-10-16", "Step-Ups", [{ reps: 10, weight: 20 }]),
      ],
      BW,
      TODAY
    );
    // Step-ups are primary quad work and DO count; lateral walks (secondary) alone must not.
    expect(statsByGroup.quads.lastTrainedDateKey).toBe("2026-10-16");
    const withoutStepUps = computeMuscleEngine(
      [
        make("1", "2026-09-05", "Back Squat", [{ reps: 5, weight: 185 }]),
        make("2", "2026-10-16", "Banded Lateral Walks", [{ reps: 12, weight: 0 }], { bodyweight: true }),
        make("3", "2026-10-16", "Back Extension", [{ reps: 12, weight: 0 }], { bodyweight: true }),
      ],
      BW,
      TODAY
    ).statsByGroup.quads;
    expect(withoutStepUps.lastTrainedDateKey).toBe("2026-09-05");
    expect(withoutStepUps.daysStale).toBe(42);
    expect(withoutStepUps.isStale).toBe(true);
    expect(withoutStepUps.lastSecondaryDateKey).toBe("2026-10-16");
  });

  it("a huge number on an easy-to-max lift can't make a secondary-only muscle look strong", () => {
    const { statsByGroup } = computeMuscleEngine([make("1", "2026-10-15", "Lateral Raise", [{ reps: 12, weight: 40 }])], BW, TODAY);
    // Front delts only get secondary credit from lateral raises.
    expect(statsByGroup.frontDelts.lastTrainedDateKey).toBeNull();
    expect(statsByGroup.frontDelts.peak!).toBeLessThanOrEqual(45); // <= 0.4 * 100 + a small consistency bonus
    const before = computeMuscleEngine([], BW, "2026-09-17");
    expect(compareSnapshots(before.statsByGroup, statsByGroup).frontDelts.status).toBe("incidental");
  });

  it("secondary credit still counts at a reduced weight toward the score", () => {
    const { statsByGroup } = computeMuscleEngine([make("1", "2026-10-16", "Bench Press", [{ reps: 5, weight: 185 }])], BW, TODAY);
    expect(statsByGroup.frontDelts.peak!).toBeGreaterThan(0);
    expect(statsByGroup.frontDelts.peak!).toBeLessThan(statsByGroup.midLowerChest.peak!);
  });
});

describe("alias merging", () => {
  it("combines Calf Raise / Standing Calf Raise / Standing Calf into one exercise", () => {
    for (const name of ["Calf Raise", "Standing Calf Raise", "standing calf"]) {
      expect(canonicalExerciseKey(name)).toBe("calf raise");
    }
    const { statsByGroup } = computeMuscleEngine(
      [
        make("1", "2026-10-01", "Calf Raise", [{ reps: 10, weight: 100 }]),
        make("2", "2026-10-10", "Standing Calf Raise", [{ reps: 10, weight: 120 }]),
        make("3", "2026-10-15", "Standing Calf", [{ reps: 10, weight: 120 }]),
      ],
      BW,
      TODAY
    );
    expect(statsByGroup.calves.contributingExercises).toEqual(["Calf Raise"]);
    expect(statsByGroup.calves.exerciseScores).toHaveLength(1);
    expect(statsByGroup.calves.lastTrainedDateKey).toBe("2026-10-15");
  });

  it("suggestion chips show one name per movement", () => {
    const names = exercisesForMuscle("calves", 10);
    expect(names.filter((n) => /calf/i.test(n))).toEqual(["Calf Raise", "Seated Calf Raise"]); // "Standing Calf" etc. don't appear separately
  });

  it("every alias points at a real, non-hidden canonical entry", () => {
    for (const [alias, target] of Object.entries(EXERCISE_ALIASES)) {
      expect(EXERCISE_MUSCLE_MAP[target], `${alias} -> ${target}`).toBeDefined();
      expect(EXERCISE_MUSCLE_MAP[alias], `${alias} must not also be a map key`).toBeUndefined();
    }
  });
});

describe("Focus This Week", () => {
  it("pluralizes correctly and labels one consistent window", () => {
    expect(pluralize(1, "point")).toBe("1 point");
    expect(pluralize(4, "point")).toBe("4 points");
    expect(describeDelta(-1)).toBe("down 1 point");
    expect(describeDelta(-4)).toBe("down 4 points");
    expect(describeDelta(0.2)).toBe("no change");
    const entries = [make("1", "2026-09-25", "Calf Raise", [{ reps: 10, weight: 100 }])];
    const before = computeMuscleEngine(entries, BW, "2026-09-17");
    const now = computeMuscleEngine(entries, BW, TODAY);
    const deltas = compareSnapshots(before.statsByGroup, now.statsByGroup);
    const calves = buildFocusList(now.statsByGroup, deltas, undefined, 17).find((f) => f.group === "calves")!;
    expect(calves.reason).not.toMatch(/\b1 points\b/);
  });

  it("ranks the lowest-scoring muscle above a merely stale one", () => {
    const entries = [
      // quads: low score, fresh
      make("1", "2026-10-15", "Back Squat", [{ reps: 3, weight: 60 }]),
      // lats: decent but stale 20 days
      make("2", "2026-09-27", "Lat Pulldown", [{ reps: 10, weight: 160 }]),
    ];
    const { statsByGroup } = computeMuscleEngine(entries, BW, TODAY);
    const order = buildFocusList(statsByGroup, undefined, undefined, 17).map((f) => f.group);
    expect(order.indexOf("quads")).toBeLessThan(order.indexOf("lats"));
  });
});

describe("Elite visibility", () => {
  it("Elite is the brightest tier color, distinct from unrated and every other tier", async () => {
    const { MUSCLE_TIERS, UNRATED_COLOR } = await import("./muscleScoreConfig");
    const elite = MUSCLE_TIERS.find((t) => t.id === "elite")!;
    const luminance = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
    };
    expect(elite.outline).toBeDefined();
    for (const t of MUSCLE_TIERS.filter((x) => x.id !== "elite")) {
      expect(luminance(elite.color)).toBeGreaterThan(luminance(t.color));
      expect(elite.color).not.toBe(t.color);
    }
    expect(luminance(elite.color)).toBeGreaterThan(luminance(UNRATED_COLOR) + 100);
  });
});
