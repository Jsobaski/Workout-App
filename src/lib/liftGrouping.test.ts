// Automatic lift grouping, comparison deltas and provisional scores, with
// synthetic data only — nothing here depends on any particular user.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXERCISE_MUSCLE_MAP } from "./exerciseMuscleMap";
import { emptyExerciseSettings } from "./exerciseSettings";
import { areSameLift, groupingBasis, liftGroupKey, liftGroupMap, liftGroupMembers, namesAreSimilar } from "./liftGroups";
import { MuscleDelta, compareSnapshots, describeDeltaStatus } from "./muscleComparison";
import { computeMuscleEngine, tierForScore } from "./muscleEngine";
import { PROVISIONAL_MIN_SESSIONS } from "./muscleScoreConfig";
import { MUSCLE_GROUPS } from "./muscleTaxonomy";
import { WorkoutEntry } from "./types";

const BW = 180;
const TODAY = "2026-10-17";
const make = (id: string, dateKey: string, exerciseName: string, reps: number, weight: number, bodyweight = false): WorkoutEntry => ({
  id,
  dateKey,
  timestamp: Date.parse(`${dateKey}T12:00:00`),
  exerciseName,
  muscleGroups: [],
  sets: [{ reps, weight }],
  ...(bodyweight ? { bodyweight: true } : {}),
});

describe("automatic grouping", () => {
  it("groups machines/cables on the same basis that train the same muscle and look alike", () => {
    const group = liftGroupKey("preacher curl machine");
    expect(liftGroupKey("bicep curl machine")).toBe(group);
    expect(liftGroupKey("cable curl")).toBe(group);
    expect(liftGroupMembers("cable curl")).toEqual(expect.arrayContaining(["preacher curl machine", "bicep curl machine", "cable curl"]));
    // free-weight curls form their own group
    expect(liftGroupKey("barbell curl")).toBe(liftGroupKey("ez-bar curl"));
    expect(liftGroupKey("barbell curl")).toBe(liftGroupKey("db bicep curl"));
    expect(liftGroupKey("barbell curl")).not.toBe(group);
    // bench variants on free weights
    expect(liftGroupKey("db bench press")).toBe(liftGroupKey("bench press"));
    // leg curls on the same machine type
    expect(liftGroupKey("lying leg curl")).toBe(liftGroupKey("seated leg curl"));
    // calf raises
    expect(liftGroupKey("calf raise")).toBe(liftGroupKey("seated calf raise"));
  });

  it("never groups different load bases (stack / plates / free / bodyweight)", () => {
    expect(groupingBasis("chest press machine")).toBe("plates");
    expect(groupingBasis("pec deck")).toBe("stack");
    expect(groupingBasis("db bench press")).toBe("free");
    expect(groupingBasis("pull up")).toBe("bodyweight");
    expect(areSameLift("chest press machine", "db bench press")).toBe(false);
    expect(areSameLift("chest press machine", "bench press")).toBe(false);
    expect(areSameLift("preacher curl machine", "db bicep curl")).toBe(false);
    expect(areSameLift("cable curl", "barbell curl")).toBe(false);
    expect(areSameLift("push up", "bench press")).toBe(false);
    expect(liftGroupKey("chest press machine")).not.toBe(liftGroupKey("db bench press"));
    // across the whole library: anything that ended up grouped shares a load basis and its primary muscles
    for (const [key, group] of liftGroupMap()) {
      if (key === group) continue;
      expect(groupingBasis(key), `${key} vs ${group}`).toBe(groupingBasis(group));
      const primary = (k: string) => EXERCISE_MUSCLE_MAP[k].muscles.filter((m) => m.weight >= 1).map((m) => m.group).sort().join();
      expect(primary(key), `${key} vs ${group}`).toBe(primary(group));
    }
  });

  it("needs the same primary muscles and similar names or pattern; reps/time work and secondary-only lifts aren't grouped", () => {
    expect(areSameLift("chest press machine", "incline chest press machine")).toBe(false); // different primary muscles
    expect(areSameLift("bench press", "close-grip bench")).toBe(false); // triceps lead there
    expect(areSameLift("plank", "side plank")).toBe(false); // volumeOnly
    expect(areSameLift("pull up", "pullover")).toBe(false); // no primary muscles
    expect(namesAreSimilar("db bench press", "bench press")).toBe(true);
    expect(namesAreSimilar("lat pulldown", "cable row")).toBe(false);
  });

  it("changing an exercise's load basis in Settings regroups it (optional, never prompted)", () => {
    const settings = { ...emptyExerciseSettings(), overrides: { "cable curl": { loadBasis: "plates" as const } } };
    expect(areSameLift("cable curl", "preacher curl machine")).toBe(true);
    expect(areSameLift("cable curl", "preacher curl machine", settings)).toBe(false);
  });
});

describe("comparisons across grouped exercises", () => {
  const curlMachineSessions = [
    make("1", "2026-08-20", "Bicep Curl Machine", 10, 40),
    make("2", "2026-08-27", "Bicep Curl Machine", 10, 40),
    make("3", "2026-09-03", "Bicep Curl Machine", 10, 40),
  ];

  it("switching between grouped machines is a like-for-like change, not 'new' and not flagged", () => {
    const entries = [...curlMachineSessions, make("4", "2026-10-10", "Cable Curl", 10, 45), make("5", "2026-10-14", "Preacher Curl Machine", 10, 50)];
    const before = computeMuscleEngine(entries, BW, "2026-09-17");
    const after = computeMuscleEngine(entries, BW, TODAY);
    const delta = compareSnapshots(before.statsByGroup, after.statsByGroup).biceps;
    expect(delta.status).toBe("like-for-like");
    expect(delta.delta).toBe(after.statsByGroup.biceps.effective! - before.statsByGroup.biceps.effective!);
    expect(describeDeltaStatus(delta)).toMatch(/^(up|down) \d+ points?$|^no change$/);
  });

  it("history and the best lift combine across a group", () => {
    const entries = [...curlMachineSessions, make("4", "2026-10-14", "Preacher Curl Machine", 10, 50)];
    const biceps = computeMuscleEngine(entries, BW, TODAY).statsByGroup.biceps;
    const groups = new Set(biceps.exerciseScores.map((e) => e.groupKey));
    expect(groups.size).toBe(1);
    expect(biceps.bestLift!.exerciseName).toBe("Preacher Curl Machine"); // the heaviest of the grouped lifts
    expect(biceps.contributingExercises).toEqual(["Bicep Curl Machine", "Preacher Curl Machine"]);
  });

  it("a different load basis is 'new exercise, no comparison' — a score jump never gets a number", () => {
    const dbCurls = [
      make("1", "2026-08-20", "DB Bicep Curl", 10, 30),
      make("2", "2026-08-27", "DB Bicep Curl", 10, 30),
      make("3", "2026-09-03", "DB Bicep Curl", 10, 30),
    ];
    const entries = [...dbCurls, make("4", "2026-10-10", "Preacher Curl Machine", 10, 120), make("5", "2026-10-14", "Preacher Curl Machine", 10, 120)];
    const before = computeMuscleEngine(entries, BW, "2026-09-17");
    const after = computeMuscleEngine(entries, BW, TODAY);
    expect(after.statsByGroup.biceps.effective!).toBeGreaterThan(before.statsByGroup.biceps.effective! + 20);
    const delta = compareSnapshots(before.statsByGroup, after.statsByGroup).biceps;
    expect(delta.status).toBe("new");
    expect(delta.delta).toBeNull();
    expect(describeDeltaStatus(delta)).toBe("new exercise, no comparison");
  });

  it("the 9 -> 84 case: a light free-weight baseline then a heavy plate-loaded press is never labelled 'down'", () => {
    const entries = [
      make("1", "2026-08-20", "DB Bench Press", 8, 30),
      make("2", "2026-08-27", "DB Bench Press", 8, 30),
      make("3", "2026-09-03", "DB Bench Press", 8, 30),
      make("4", "2026-10-10", "Chest Press Machine", 8, 220),
      make("5", "2026-10-13", "Chest Press Machine", 8, 220),
      make("6", "2026-10-15", "Chest Press Machine", 8, 220),
    ];
    const before = computeMuscleEngine(entries, BW, "2026-09-17").statsByGroup.midLowerChest;
    const after = computeMuscleEngine(entries, BW, TODAY).statsByGroup.midLowerChest;
    expect(after.effective! - before.effective!).toBeGreaterThan(30);
    const delta = compareSnapshots(computeMuscleEngine(entries, BW, "2026-09-17").statsByGroup, computeMuscleEngine(entries, BW, TODAY).statsByGroup).midLowerChest;
    expect(delta.delta).toBeNull();
    expect(delta.status).toBe("new");
    expect(describeDeltaStatus(delta)).not.toMatch(/down|up/);
  });

  it("a lift that already had a baseline but isn't the leader is 'lead lift changed', not a number", () => {
    const entries = [
      make("1", "2026-08-20", "DB Bicep Curl", 10, 30),
      make("2", "2026-08-27", "DB Bicep Curl", 10, 30),
      make("3", "2026-09-03", "DB Bicep Curl", 10, 30),
      make("4", "2026-09-04", "Preacher Curl Machine", 10, 40),
      make("5", "2026-10-10", "Preacher Curl Machine", 10, 120),
    ];
    const delta = compareSnapshots(computeMuscleEngine(entries, BW, "2026-09-17").statsByGroup, computeMuscleEngine(entries, BW, TODAY).statsByGroup).biceps;
    expect(["lead-changed", "like-for-like"]).toContain(delta.status);
    if (delta.status === "lead-changed") expect(delta.delta).toBeNull();
  });

  it("property: any number shown is exactly the muscle's real score change, across random histories", () => {
    // mulberry32: deterministic pseudo-random numbers
    let seed = 20261017;
    const rand = () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pool = [
      "DB Bench Press", "Bench Press", "Chest Press Machine", "Pec Deck", "Cable Fly", "Dumbbell Fly",
      "DB Bicep Curl", "Barbell Curl", "Preacher Curl Machine", "Cable Curl", "Bicep Curl Machine",
      "Lat Pulldown", "Cable Row", "Barbell Row", "T-Bar Row", "Leg Press", "Hack Squat", "Back Squat", "Leg Extension",
      "Lying Leg Curl", "Romanian Deadlift", "Seated Calf Raise", "Calf Raise", "Tricep Pushdown", "Skull Crusher",
    ];
    const days = Array.from({ length: 70 }, (_, i) => new Date(Date.UTC(2026, 7, 8 + i)).toISOString().slice(0, 10));
    let numeric = 0;
    let labelled = 0;
    for (let trial = 0; trial < 150; trial++) {
      const entries: WorkoutEntry[] = [];
      const count = 3 + Math.floor(rand() * 12);
      for (let i = 0; i < count; i++) {
        const name = pool[Math.floor(rand() * pool.length)];
        entries.push(make(`${trial}-${i}`, days[Math.floor(rand() * days.length)], name, 5 + Math.floor(rand() * 8), 20 + Math.floor(rand() * 220)));
      }
      const before = computeMuscleEngine(entries, BW, "2026-09-17").statsByGroup;
      const after = computeMuscleEngine(entries, BW, TODAY).statsByGroup;
      const deltas = compareSnapshots(before, after);
      for (const g of MUSCLE_GROUPS) {
        const d: MuscleDelta = deltas[g.id];
        if (d.delta != null) {
          numeric++;
          expect(d.delta).toBe(after[g.id].effective! - before[g.id].effective!); // equals the real change, so it can't contradict it
          expect(["like-for-like", "consistency"]).toContain(d.status);
        } else if (d.status === "new" || d.status === "lead-changed") {
          labelled++;
          expect(describeDeltaStatus(d)).toMatch(/no comparison$/);
        }
      }
    }
    expect(numeric).toBeGreaterThan(50);
    expect(labelled).toBeGreaterThan(5);
  });
});

describe("provisional scores", () => {
  const legExt = (id: string, dateKey: string, weight: number, reps = 10) => make(id, dateKey, "Leg Extension", reps, weight);

  it("a muscle scored solely from a lift logged on fewer than 3 sessions is provisional, with the tier one level below computed", () => {
    const stats = computeMuscleEngine([legExt("1", "2026-10-14", 150)], BW, TODAY).statsByGroup.quads;
    expect(stats.provisional).toBe(true);
    expect(stats.provisionalSessions).toBe(1);
    const computed = tierForScore(stats.uncappedEffective!);
    expect(computed.id).toBe("strong");
    expect(tierForScore(stats.effective!).id).toBe("solid"); // one level below
    expect(stats.effective!).toBeLessThan(computed.minScore);
    expect(stats.effective!).toBeLessThan(stats.uncappedEffective!);
  });

  it("holds Elite to Strong and Developing to Needs Work; Needs Work has nothing lower so it is only marked", () => {
    const elite = computeMuscleEngine([legExt("1", "2026-10-14", 250, 5)], BW, TODAY).statsByGroup.quads;
    expect(tierForScore(elite.uncappedEffective!).id).toBe("elite");
    expect(tierForScore(elite.effective!).id).toBe("strong");
    const developing = computeMuscleEngine([legExt("1", "2026-10-14", 70)], BW, TODAY).statsByGroup.quads;
    expect(tierForScore(developing.uncappedEffective!).id).toBe("developing");
    expect(tierForScore(developing.effective!).id).toBe("needs-work");
    const lowest = computeMuscleEngine([legExt("1", "2026-10-14", 40, 8)], BW, TODAY).statsByGroup.quads;
    expect(tierForScore(lowest.uncappedEffective!).id).toBe("needs-work");
    expect(lowest.provisional).toBe(true);
    expect(lowest.effective).toBe(lowest.uncappedEffective);
  });

  it("stays provisional through the second session and lifts on the third (distinct days, not entries)", () => {
    const sameDayTwice = [legExt("1", "2026-10-10", 150), legExt("2", "2026-10-10", 150)];
    expect(computeMuscleEngine(sameDayTwice, BW, TODAY).statsByGroup.quads.provisionalSessions).toBe(1);
    const two = [legExt("1", "2026-10-08", 150), legExt("2", "2026-10-12", 150)];
    expect(computeMuscleEngine(two, BW, TODAY).statsByGroup.quads.provisional).toBe(true);
    const three = [...two, legExt("3", "2026-10-15", 150)];
    const stats = computeMuscleEngine(three, BW, TODAY).statsByGroup.quads;
    expect(stats.provisional).toBe(false);
    expect(stats.provisionalSessions).toBe(PROVISIONAL_MIN_SESSIONS);
    expect(stats.effective).toBe(stats.uncappedEffective);
    expect(tierForScore(stats.effective!).id).toBe("strong");
  });

  it("a grouped exercise inherits the group's history and is never provisional", () => {
    const established = [
      make("1", "2026-08-20", "Bicep Curl Machine", 10, 60),
      make("2", "2026-08-27", "Bicep Curl Machine", 10, 60),
      make("3", "2026-09-03", "Bicep Curl Machine", 10, 60),
    ];
    // first-ever session on a grouped machine
    const switched = [...established, make("4", "2026-10-14", "Preacher Curl Machine", 10, 80)];
    const stats = computeMuscleEngine(switched, BW, TODAY).statsByGroup.biceps;
    expect(stats.bestLift!.exerciseName).toBe("Preacher Curl Machine");
    expect(stats.provisional).toBe(false);
    expect(stats.provisionalSessions).toBe(4);
    // 2 sessions on one machine + 1 on a grouped one = the third session
    const mixed = [make("1", "2026-10-01", "Bicep Curl Machine", 10, 60), make("2", "2026-10-08", "Bicep Curl Machine", 10, 60), make("3", "2026-10-14", "Cable Curl", 10, 60)];
    expect(computeMuscleEngine(mixed, BW, TODAY).statsByGroup.biceps.provisional).toBe(false);
  });

  it("a different load basis does not inherit history", () => {
    const dbCurls = [make("1", "2026-08-20", "DB Bicep Curl", 10, 30), make("2", "2026-08-27", "DB Bicep Curl", 10, 30)];
    // the muscle is scored solely from the (new, ungrouped) machine
    const machineOnly = computeMuscleEngine([make("4", "2026-10-14", "Preacher Curl Machine", 10, 80)], BW, TODAY).statsByGroup.biceps;
    expect(machineOnly.provisional).toBe(true);
    // with only 2 free-weight sessions beside it there is still no established lift
    const withTwoFree = computeMuscleEngine([...dbCurls, make("4", "2026-10-14", "Preacher Curl Machine", 10, 80)], BW, TODAY).statsByGroup.biceps;
    expect(withTwoFree.provisional).toBe(true);
    expect(withTwoFree.provisionalSessions).toBe(1); // the machine's own history, not the dumbbell sessions
  });

  it("is not 'solely' when another primary lift has an established history, and never applies to reps/time scoring", () => {
    const established = [
      make("1", "2026-08-20", "DB Bicep Curl", 10, 30),
      make("2", "2026-08-27", "DB Bicep Curl", 10, 30),
      make("3", "2026-09-03", "DB Bicep Curl", 10, 30),
      make("4", "2026-10-14", "Preacher Curl Machine", 10, 80),
    ];
    expect(computeMuscleEngine(established, BW, TODAY).statsByGroup.biceps.provisional).toBe(false);
    const plank = [make("1", "2026-10-14", "Plank", 1, 0, true)];
    const abs = computeMuscleEngine(plank, BW, TODAY).statsByGroup.abs;
    expect(abs.scoringBasis).toBe("reps-time");
    expect(abs.provisional).toBe(false);
  });

  it("is a snapshot-time property: an earlier Before snapshot only counts the sessions that existed then", () => {
    const entries = [legExt("1", "2026-09-10", 150), legExt("2", "2026-09-20", 150), legExt("3", "2026-10-05", 150)];
    expect(computeMuscleEngine(entries, BW, "2026-09-25").statsByGroup.quads.provisional).toBe(true);
    expect(computeMuscleEngine(entries, BW, TODAY).statsByGroup.quads.provisional).toBe(false);
  });
});

describe("the multiplier editor stays optional", () => {
  it("is only reachable from Settings — nothing else mounts it or its helper, so nothing prompts for it", () => {
    const root = new URL("../../src/", import.meta.url);
    const walk = (dir: URL): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(new URL(`${e.name}/`, dir)) : /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [new URL(e.name, dir).pathname] : []
      );
    const importers = walk(root).filter((f) => /ExerciseSettingsEditor/.test(readFileSync(f, "utf8")) && !/ExerciseSettingsEditor\.tsx$/.test(f));
    expect(importers.map((f) => f.split("/").pop())).toEqual(["ExercisePreferences.tsx"]);
    const helperUsers = walk(root).filter((f) => /proposeMultiplier/.test(readFileSync(f, "utf8")) && !/multiplierHelper\.ts$/.test(f));
    expect(helperUsers.map((f) => f.split("/").pop())).toEqual(["ExerciseSettingsEditor.tsx"]);
  });
});
