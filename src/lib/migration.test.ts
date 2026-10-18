// One-time migration for devices that installed an earlier release.
import { describe, expect, it } from "vitest";
import { freshDatabase, workout } from "./dbTestHelper";
import { isExerciseRestricted, listNeedsConfirmation, listRestrictedExercises } from "./exerciseSettings";
import { LEGACY_COACHING_CONTEXT } from "./legacyDefaults";
import { applyKeepLegacyDefaults, decideNeutralMigration, describeLegacyDefaults } from "./neutralMigration";
import { emptyExerciseSettings } from "./exerciseSettings";
import { DEFAULT_COACHING_CONTEXT } from "./types";

describe("decideNeutralMigration", () => {
  it("prompts only existing devices (with data) that haven't chosen yet", () => {
    expect(decideNeutralMigration({ hasLoggedData: true })).toBe("prompt");
    expect(decideNeutralMigration({ hasLoggedData: false })).toBe("mark-not-needed");
    expect(decideNeutralMigration({ hasLoggedData: true, recorded: "kept" })).toBe("done");
    expect(decideNeutralMigration({ hasLoggedData: true, recorded: "cleared" })).toBe("done");
    expect(decideNeutralMigration({ hasLoggedData: false, recorded: "not-needed" })).toBe("done");
  });
});

describe("migration notice", () => {
  it("a new install sees nothing — and still sees nothing after it logs data later", async () => {
    const { db, migration } = await freshDatabase();
    expect(await migration.checkNeutralMigration()).toBeNull();
    expect(await db.getNeutralMigrationChoice()).toBe("not-needed");
    await db.saveWorkoutEntry(workout("1", "2026-10-10", "Bench Press"));
    expect(await migration.checkNeutralMigration()).toBeNull();
  });

  it("an existing device with data is shown exactly what used to be on by default", async () => {
    const { db, migration } = await freshDatabase();
    await db.saveWorkoutEntry(workout("1", "2026-10-10", "Bench Press"));
    const summary = (await migration.checkNeutralMigration())!;
    expect(summary).not.toBeNull();
    expect(summary.restrictedExercises.map((r) => r.name).sort()).toEqual(
      [
        "DB Bulgarian Split Squat",
        "DB Romanian Deadlift",
        "Goblet Squat",
        "Landmine Rotational Press",
        "Romanian Deadlift",
        "Standing Cable Woodchopper (High-to-Low)",
        "Standing Cable Woodchopper (Low-to-High)",
        "Trap Bar Deadlift",
      ].sort()
    );
    expect(summary.confirmationExercises.sort()).toEqual(["Back Extension", "Pallof Press"]);
    expect(summary.priorityMuscles.sort()).toEqual(["Abs", "Forearms", "Glutes", "Lats", "Obliques"]);
    expect(summary.coaching?.goals).toContain("golf");
    // nothing is applied until the user chooses
    expect(listRestrictedExercises(await db.getExerciseSettings())).toEqual([]);
    expect(await db.getNeutralMigrationChoice()).toBeUndefined();
    // and the notice keeps showing until they choose
    expect(await migration.checkNeutralMigration()).not.toBeNull();
  });

  it('"Keep these" writes the old defaults into this device\'s local settings, and is remembered', async () => {
    const { db, migration } = await freshDatabase();
    await db.saveWorkoutEntry(workout("1", "2026-10-10", "Bench Press"));
    expect(await migration.checkNeutralMigration()).not.toBeNull();
    await migration.resolveNeutralMigration("kept");

    const settings = await db.getExerciseSettings();
    expect(isExerciseRestricted("Trap Bar Deadlift", settings)).toBe(true);
    expect(isExerciseRestricted("Goblet Squat", settings)).toBe(true);
    expect(isExerciseRestricted("Bench Press", settings)).toBe(false);
    expect(settings.overrides["trap bar deadlift"]?.restrictionNote).toBe("PT: no hip hinge");
    expect(listNeedsConfirmation(settings).sort()).toEqual(["Back Extension", "Pallof Press"]);
    expect(settings.focusMuscles.sort()).toEqual(["abs", "forearms", "glutes", "lats", "obliques"]);
    expect(await db.getCoachingContext()).toEqual(LEGACY_COACHING_CONTEXT);
    expect(await db.getNeutralMigrationChoice()).toBe("kept");
    expect(await migration.checkNeutralMigration()).toBeNull(); // remembered
  });

  it('"Clear them" leaves the device neutral, and is remembered', async () => {
    const { db, migration } = await freshDatabase();
    await db.saveWorkoutEntry(workout("1", "2026-10-10", "Bench Press"));
    await migration.resolveNeutralMigration("cleared");
    expect(await db.getExerciseSettings()).toEqual(emptyExerciseSettings());
    expect(await db.getCoachingContext()).toEqual(DEFAULT_COACHING_CONTEXT);
    expect(await db.getNeutralMigrationChoice()).toBe("cleared");
    expect(await migration.checkNeutralMigration()).toBeNull();
  });

  it("a coaching context the user already saved is never overwritten, and isn't listed", async () => {
    const { db, migration } = await freshDatabase();
    await db.saveWorkoutEntry(workout("1", "2026-10-10", "Bench Press"));
    await db.saveCoachingContext({ ...DEFAULT_COACHING_CONTEXT, goals: "my own goal" });
    const summary = (await migration.checkNeutralMigration())!;
    expect(summary.coaching).toBeUndefined();
    await migration.resolveNeutralMigration("kept");
    expect((await db.getCoachingContext()).goals).toBe("my own goal");
  });

  it('"Keep these" never overrides something the user already set on this device', () => {
    const current = {
      ...emptyExerciseSettings(),
      overrides: { "goblet squat": { restricted: false }, "pallof press": { needsConfirmation: false, limit: "2x10" } },
      focusMuscles: ["calves" as const],
    };
    const kept = applyKeepLegacyDefaults(current);
    expect(kept.overrides["goblet squat"]).toEqual({ restricted: false });
    expect(kept.overrides["pallof press"]).toEqual({ needsConfirmation: false, limit: "2x10" });
    expect(kept.overrides["trap bar deadlift"]?.restricted).toBe(true);
    expect(kept.focusMuscles).toEqual(expect.arrayContaining(["calves", "forearms", "lats"]));
  });

  it("describes the legacy coaching defaults only when none was stored", () => {
    expect(describeLegacyDefaults({ coachingContextStored: true }).coaching).toBeUndefined();
    expect(describeLegacyDefaults({ coachingContextStored: false }).coaching?.nutrition).toBe("2100-2300 kcal, 175 g protein");
  });
});
