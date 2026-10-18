// User-set restrictions: movement patterns, per-exercise overrides (which win),
// limits, flags — all local to the device and persisted in IndexedDB.
import { describe, expect, it } from "vitest";
import { freshDatabase, workout } from "./dbTestHelper";
import { EXERCISE_MUSCLE_MAP, canonicalExerciseKey } from "./exerciseMuscleMap";
import {
  ExerciseSettingsData,
  allowedPrimaryExercises,
  emptyExerciseSettings,
  groupHasAllowedExercise,
  hasAnyRestrictions,
  isExerciseRestricted,
  listLimitedExercises,
  listNeedsConfirmation,
  listRestrictedExercises,
  normalizeExerciseSettings,
  resolveExerciseConfig,
} from "./exerciseSettings";
import { suggestExercisesForMuscle } from "./exerciseSuggestions";
import { clampToLimit } from "./limits";
import { computeMuscleEngine } from "./muscleEngine";
import { buildFocusList } from "./muscleFocus";

const BW = 180;
const TODAY = "2026-10-17";
const make = (id: string, dateKey: string, exerciseName: string, reps: number, weight: number) => ({
  ...workout(id, dateKey, exerciseName, reps, weight),
});

const hingeRestricted = (note?: string): ExerciseSettingsData => ({
  ...emptyExerciseSettings(),
  patterns: { hip_hinge: note ? { note } : {} },
});

describe("movement-pattern restrictions", () => {
  it("apply to every tagged exercise and to its aliases", () => {
    const settings = hingeRestricted();
    for (const name of [
      "Trap Bar Deadlift",
      "Barbell Deadlift",
      "Romanian Deadlift",
      "Romanian Deadlift straight bar", // alias
      "DB Romanian Deadlift",
      "Single-Leg Romanian Deadlift",
      "Back Extension",
      "Back Extensions", // alias
    ]) {
      expect(isExerciseRestricted(name, settings), name).toBe(true);
      expect(resolveExerciseConfig(name, settings)!.restrictionSource, name).toBe("pattern");
    }
    for (const name of ["Back Squat", "Bench Press", "Leg Press", "Plank", "Cable Woodchop"]) {
      expect(isExerciseRestricted(name, settings), name).toBe(false);
    }
  });

  it("every tag in the library is a known pattern, and each pattern tags more than one exercise", () => {
    const counts: Record<string, number> = {};
    for (const mapping of Object.values(EXERCISE_MUSCLE_MAP)) for (const p of mapping.patterns ?? []) counts[p] = (counts[p] ?? 0) + 1;
    expect(Object.keys(counts).sort()).toEqual(["hip_hinge", "rotation", "split_stance", "squat"]);
    for (const n of Object.values(counts)) expect(n).toBeGreaterThan(1);
  });

  it("the other patterns work too (rotation, split stance, squat) and include aliases", () => {
    expect(isExerciseRestricted("Standing Cable Woodchoppers (high to low)", { ...emptyExerciseSettings(), patterns: { rotation: {} } })).toBe(true);
    expect(isExerciseRestricted("DB Bulgarian Split Squats", { ...emptyExerciseSettings(), patterns: { split_stance: {} } })).toBe(true);
    expect(isExerciseRestricted("DB Goblet Squat", { ...emptyExerciseSettings(), patterns: { squat: {} } })).toBe(true);
    expect(isExerciseRestricted("Landmine Rotational Press", { ...emptyExerciseSettings(), patterns: { rotation: {} } })).toBe(true);
  });

  it("restricted exercises are excluded from suggestions and listed as skipped (with the pattern's note)", () => {
    const settings = hingeRestricted("no hinging for now");
    const hams = suggestExercisesForMuscle("hamstrings", 50, settings);
    expect(hams.suggestions).not.toContain("Romanian Deadlift");
    expect(hams.suggestions).not.toContain("Barbell Deadlift");
    expect(hams.skippedRestricted.map((s) => s.name)).toEqual(expect.arrayContaining(["Romanian Deadlift", "Barbell Deadlift"]));
    expect(hams.skippedRestricted.every((s) => s.note === "no hinging for now")).toBe(true);
  });
});

describe("per-exercise overrides win over the pattern", () => {
  it("a cleared override (restricted: false) allows one exercise even though its pattern is restricted", () => {
    const settings: ExerciseSettingsData = {
      ...hingeRestricted(),
      overrides: { "single-leg romanian deadlift": { restricted: false } },
    };
    expect(isExerciseRestricted("Single-Leg Romanian Deadlift", settings)).toBe(false);
    expect(isExerciseRestricted("Romanian Deadlift", settings)).toBe(true);
    expect(suggestExercisesForMuscle("glutes", 50, settings).suggestions).toContain("Single-Leg Romanian Deadlift");
    expect(listRestrictedExercises(settings).map((r) => r.name)).not.toContain("Single-Leg Romanian Deadlift");
  });

  it("an explicit exercise restriction works with no pattern, and carries its note", () => {
    const settings: ExerciseSettingsData = { ...emptyExerciseSettings(), overrides: { "leg press": { restricted: true, restrictionNote: "my choice" } } };
    expect(listRestrictedExercises(settings)).toEqual([{ name: "Leg Press", note: "my choice", source: "exercise" }]);
    expect(hasAnyRestrictions(settings)).toBe(true);
  });

  it("limits and flags show on allowed exercises only, and suggestions never exceed the limit", () => {
    const settings: ExerciseSettingsData = {
      ...hingeRestricted(),
      overrides: {
        "single-leg romanian deadlift": { restricted: false, limit: "2x10", needsConfirmation: true },
        "leg press": { limit: "3x8" },
        "romanian deadlift": { limit: "2x5" }, // restricted by pattern: limit is moot
      },
    };
    expect(listLimitedExercises(settings)).toEqual(
      expect.arrayContaining([
        { name: "Single-Leg Romanian Deadlift", limit: "2x10" },
        { name: "Leg Press", limit: "3x8" },
      ])
    );
    expect(listLimitedExercises(settings).map((l) => l.name)).not.toContain("Romanian Deadlift");
    expect(listNeedsConfirmation(settings)).toEqual(["Single-Leg Romanian Deadlift"]);

    const chip = suggestExercisesForMuscle("glutes", 50, settings).items.find((i) => i.name === "Single-Leg Romanian Deadlift")!;
    expect(chip).toEqual({ name: "Single-Leg Romanian Deadlift", limit: "2x10", needsConfirmation: true });
    expect(clampToLimit({ sets: 4, reps: 12 }, chip.limit)).toMatchObject({ sets: 2, reps: 10, clamped: true });

    const focus = buildFocusList(computeMuscleEngine([], BW, TODAY).statsByGroup, undefined, settings, 17);
    const legPress = focus.flatMap((f) => f.suggestions).find((s) => s.name === "Leg Press");
    expect(legPress?.limit).toBe("3x8");
  });
});

describe("restrictions and the muscle score", () => {
  it("a muscle with an allowed alternative isn't paused; one with none is", () => {
    const entries = [make("1", "2026-09-01", "Pallof Press", 10, 25)];
    const patterned: ExerciseSettingsData = { ...emptyExerciseSettings(), patterns: { rotation: {} } };
    expect(groupHasAllowedExercise("obliques", patterned)).toBe(true); // pallof press is untagged
    expect(computeMuscleEngine(entries, BW, TODAY, undefined, patterned).statsByGroup.obliques.pausedRestricted).toBe(false);

    const allRestricted: ExerciseSettingsData = {
      ...emptyExerciseSettings(),
      patterns: { rotation: {} },
      overrides: { "pallof press": { restricted: true }, "side plank with leg raise": { restricted: true }, "side plank": { restricted: true } },
    };
    expect(allowedPrimaryExercises("obliques", allRestricted)).toEqual([]);
    const paused = computeMuscleEngine(entries, BW, TODAY, undefined, allRestricted).statsByGroup.obliques;
    expect(paused.pausedRestricted).toBe(true);
    expect(paused.isStale).toBe(false);
    expect(paused.effective).toBe(paused.peak);
  });

  it("Focus says what to try when the last direct work was restricted but alternatives exist", () => {
    const settings: ExerciseSettingsData = { ...emptyExerciseSettings(), patterns: { squat: {} } };
    const entries = [make("1", "2026-09-10", "Back Squat", 5, 185)];
    const { statsByGroup } = computeMuscleEngine(entries, BW, TODAY, undefined, settings);
    expect(statsByGroup.quads.lastPrimaryWasRestricted).toBe(true);
    expect(statsByGroup.quads.pausedRestricted).toBe(false); // leg press / leg extension are allowed
    const item = buildFocusList(statsByGroup, undefined, settings, 17).find((f) => f.group === "quads")!;
    expect(item.reason).toMatch(/Needs work.*restricted exercise; try:.*Leg Press/);
    expect(item.skippedRestricted.map((s) => s.name)).toContain("Back Squat");
  });
});

describe("a database with a restricted pattern and a cleared override", () => {
  it("persists, reloads and behaves the same after a restart", async () => {
    const { db } = await freshDatabase();
    const saved: ExerciseSettingsData = {
      overrides: { "single-leg romanian deadlift": { restricted: false, limit: "2x10" } },
      patterns: { hip_hinge: { note: "pattern note" }, squat: {} },
      focusMuscles: ["glutes"],
    };
    await db.saveExerciseSettings(saved);
    const loaded = await db.getExerciseSettings();
    expect(loaded).toEqual(saved);
    expect(isExerciseRestricted("Barbell Deadlift", loaded)).toBe(true);
    expect(isExerciseRestricted("Back Squat", loaded)).toBe(true);
    expect(isExerciseRestricted("Single-Leg Romanian Deadlift", loaded)).toBe(false);
    expect(isExerciseRestricted("Bench Press", loaded)).toBe(false);
    expect(loaded.focusMuscles).toEqual(["glutes"]);
  });

  it("reads older stored shapes (retired fields, brand-name keys) into the current one", async () => {
    const { db } = await freshDatabase();
    await db.getExerciseSettings(); // creates the stores
    // write the raw record directly, as an older release would have
    await (await import("idb")).openDB("golf-fitness-tracker", 3).then(async (raw) => {
      await raw.put("settings", {
        key: "exerciseSettings",
        overrides: {
          "nautilus leverage chest press": { loadMultiplier: 1.5, calibrate: false },
          "goblet squat": { selfRestricted: true },
          "pallof press": { needsPtConfirmation: true },
        },
      });
      raw.close();
    });
    const loaded = await db.getExerciseSettings();
    expect(loaded.overrides["chest press machine"]).toEqual({ loadMultiplier: 1.5 });
    expect(loaded.overrides["goblet squat"]).toEqual({ restricted: true, restrictionNote: "Self-restricted" });
    expect(loaded.overrides["pallof press"]).toEqual({ needsConfirmation: true });
    expect(loaded.patterns).toEqual({});
    expect(loaded.focusMuscles).toEqual([]);
  });

  it("older backups that stored a bare overrides map still import", () => {
    const legacy = normalizeExerciseSettings({ "romanian deadlift": { restricted: true }, "not a real key": { loadMultiplier: 2 } });
    expect(legacy.overrides["romanian deadlift"]).toEqual({ restricted: true });
    expect(legacy.overrides["not a real key"]).toEqual({ loadMultiplier: 2 });
    expect(canonicalExerciseKey("romanian deadlift")).toBe("romanian deadlift");
  });
});
