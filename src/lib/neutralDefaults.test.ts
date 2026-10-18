// A brand-new install must be neutral: no restrictions, no flags, multipliers
// 1.0, no sport/goal/injury assumptions, no priority bonus.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { freshDatabase } from "./dbTestHelper";
import { EXERCISE_MUSCLE_MAP, MOVEMENT_PATTERNS } from "./exerciseMuscleMap";
import {
  allowedPrimaryExercises,
  emptyExerciseSettings,
  hasAnyRestrictions,
  listLimitedExercises,
  listNeedsConfirmation,
  listRestrictedExercises,
  resolveConfigForKey,
} from "./exerciseSettings";
import { suggestExercisesForMuscle } from "./exerciseSuggestions";
import { computeMuscleEngine } from "./muscleEngine";
import { compareSnapshots } from "./muscleComparison";
import { buildFocusList } from "./muscleFocus";
import { formatMuscleSummaryText } from "./muscleShareText";
import { MUSCLE_GROUPS } from "./muscleTaxonomy";
import { DEFAULT_COACHING_CONTEXT } from "./types";
import { workoutSummary } from "./aggregate";

const BW = 180;
const TODAY = "2026-10-17";
const entry = (id: string, dateKey: string, exerciseName: string, reps: number, weight: number) => ({
  id,
  dateKey,
  timestamp: Date.parse(`${dateKey}T12:00:00`),
  exerciseName,
  muscleGroups: [] as string[],
  sets: [{ reps, weight }],
});

describe("empty database", () => {
  it("has no settings: nothing restricted, no patterns, no priority muscles, no migration pending", async () => {
    const { db, migration } = await freshDatabase();
    const settings = await db.getExerciseSettings();
    expect(settings).toEqual({ overrides: {}, patterns: {}, focusMuscles: [] });
    expect(hasAnyRestrictions(settings)).toBe(false);
    expect(await db.hasAnyLoggedData()).toBe(false);
    expect(await migration.checkNeutralMigration()).toBeNull();
  });

  it("coaching context is blank — no goals, sport, injury notes or nutrition targets assumed", async () => {
    const { db } = await freshDatabase();
    const ctx = await db.getCoachingContext();
    expect(ctx).toEqual(DEFAULT_COACHING_CONTEXT);
    expect(ctx.goals).toBe("");
    expect(ctx.injuryNotes).toBe("");
    expect([ctx.calorieTargetLow, ctx.calorieTargetHigh, ctx.proteinTargetG, ctx.heightIn, ctx.currentWeightLb]).toEqual([null, null, null, null, null]);
  });

  it("every exercise resolves with multiplier 1.0, nothing restricted, no limit, no flag", () => {
    for (const key of Object.keys(EXERCISE_MUSCLE_MAP)) {
      const cfg = resolveConfigForKey(key)!;
      expect(cfg.loadMultiplier, key).toBe(1);
      expect(cfg.restricted, key).toBe(false);
      expect(cfg.restrictionSource, key).toBeNull();
      expect(cfg.limit, key).toBeUndefined();
      expect(cfg.needsConfirmation, key).toBe(false);
    }
    expect(listRestrictedExercises(emptyExerciseSettings())).toEqual([]);
    expect(listLimitedExercises(emptyExerciseSettings())).toEqual([]);
    expect(listNeedsConfirmation(emptyExerciseSettings())).toEqual([]);
  });

  it("the shared library carries no restriction/flag/multiplier fields at all", () => {
    for (const [key, mapping] of Object.entries(EXERCISE_MUSCLE_MAP)) {
      const fields = Object.keys(mapping);
      for (const banned of ["restricted", "restrictionNote", "needsPtConfirmation", "needsConfirmation", "selfRestricted", "loadMultiplier", "calibrationAnchor"]) {
        expect(fields, `${key}.${banned}`).not.toContain(banned);
      }
    }
  });

  it("no suggestion is filtered, skipped or flagged, and every muscle has allowed exercises", () => {
    for (const g of MUSCLE_GROUPS) {
      const result = suggestExercisesForMuscle(g.id, 50);
      expect(result.skippedRestricted, g.id).toEqual([]);
      for (const item of result.items) {
        expect(item.limit).toBeUndefined();
        expect(item.needsConfirmation).toBe(false);
      }
    }
    for (const g of MUSCLE_GROUPS) expect(allowedPrimaryExercises(g.id).length, g.id).toBeGreaterThan(0);
  });

  it("the muscle engine reports no restriction state and no pausing", () => {
    const entries = [
      entry("1", "2026-08-20", "Trap Bar Deadlift", 5, 225),
      entry("2", "2026-08-27", "Trap Bar Deadlift", 5, 225),
      entry("3", "2026-09-01", "Trap Bar Deadlift", 5, 225),
      entry("4", "2026-09-02", "Pallof Press", 10, 25),
    ];
    const { statsByGroup } = computeMuscleEngine(entries, BW, TODAY);
    for (const g of MUSCLE_GROUPS) {
      expect(statsByGroup[g.id].pausedRestricted, g.id).toBe(false);
      expect(statsByGroup[g.id].lastPrimaryWasRestricted, g.id).toBe(false);
    }
    // a stale muscle just decays — no "paused" shield
    expect(statsByGroup.lowerBack.isStale).toBe(true);
    expect(statsByGroup.lowerBack.effective!).toBeLessThan(statsByGroup.lowerBack.peak!);
  });

  it("Focus gets no priority bonus unless the user tagged muscles", () => {
    const { statsByGroup } = computeMuscleEngine([], BW, TODAY);
    const neutral = buildFocusList(statsByGroup, undefined, emptyExerciseSettings(), 17);
    const baseline = new Map(neutral.map((f) => [f.group, f.priority]));
    // every never-trained muscle has the same priority: nothing is favoured
    expect(new Set(baseline.values()).size).toBe(1);
    const tagged = buildFocusList(statsByGroup, undefined, { ...emptyExerciseSettings(), focusMuscles: ["calves"] }, 17);
    expect(tagged[0].group).toBe("calves");
    expect(tagged[0].priority).toBeGreaterThan(neutral[0].priority);
    for (const f of tagged.slice(1)) expect(f.priority).toBe(baseline.get(f.group));
    for (const f of neutral) {
      expect(f.skippedRestricted).toEqual([]);
      for (const s of f.suggestions) expect([s.limit, s.needsConfirmation]).toEqual([undefined, false]);
    }
  });

  it("the copied summary lists no restrictions, limits, flags or priority tags", () => {
    const entries = [entry("1", "2026-10-10", "Bench Press", 5, 135)];
    const result = computeMuscleEngine(entries, BW, TODAY);
    const text = formatMuscleSummaryText({
      asOfDateKey: TODAY,
      bodyweightLb: BW,
      result,
      deltaByGroup: compareSnapshots(computeMuscleEngine(entries, BW, "2026-09-17").statsByGroup, result.statsByGroup),
      entries,
      settings: emptyExerciseSettings(),
    });
    for (const word of ["Restricted", "Limits", "Confirm before", "[priority]", "PAUSED"]) expect(text).not.toContain(word);
  });

  it("workout volume uses multiplier 1.0 and plain bodyweight logic", () => {
    const e = entry("1", "2026-10-10", "Chest Press Machine", 8, 100);
    expect(workoutSummary([e], { bodyweightLb: BW, settings: emptyExerciseSettings() }).totalVolume).toBe(800);
  });

  it("movement patterns are only metadata: none restricted by default", () => {
    expect(MOVEMENT_PATTERNS.map((p) => p.id).sort()).toEqual(["hip_hinge", "rotation", "split_stance", "squat"]);
    expect(emptyExerciseSettings().patterns).toEqual({});
  });
});

describe("shared code is neutral (nothing about one person, gym, injury or sport)", () => {
  const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
  // "PT" is matched case-sensitively so Tailwind classes like pt-3 don't trip it.
  const personalWords = /golf|golf swing|early extension|physical therap|neck sensitiv|nautilus|hoist/i;
  const personal = { test: (text: string) => personalWords.test(text) || /\bPT\b/.test(text) };

  it("the AI suggestion prompt and route", () => {
    const route = read("src/app/api/suggest-workout/route.ts");
    expect(personal.test(route)).toBe(false);
    const prompt = route.slice(route.indexOf("const SYSTEM_PROMPT"), route.indexOf("export async function POST"));
    expect(prompt).toMatch(/Use ONLY what the user has told you/);
    expect(prompt).toMatch(/Do not assume a sport/);
  });

  it("the muscle engine, config, focus, suggestions, settings, taxonomy and defaults", () => {
    for (const file of [
      "src/lib/muscleEngine.ts",
      "src/lib/muscleScoreConfig.ts",
      "src/lib/muscleFocus.ts",
      "src/lib/exerciseSettings.ts",
      "src/lib/exerciseSuggestions.ts",
      "src/lib/muscleTaxonomy.ts",
      "src/lib/muscleShareText.ts",
      "src/lib/commonExercises.ts",
      "src/components/ExercisePreferences.tsx",
      "src/components/ExerciseSettingsEditor.tsx",
      "src/components/WeeklyFocusCard.tsx",
      "src/components/MuscleDetailPanel.tsx",
      "src/app/muscles/page.tsx",
    ]) {
      expect(personal.test(read(file)), file).toBe(false);
    }
  });

  it("the exercise library (brand names appear only as aliases)", () => {
    const source = read("src/lib/exerciseMuscleMap.ts");
    const withoutAliases = source.replace(/export const EXERCISE_ALIASES[\s\S]*?\n};/, "");
    expect(personal.test(withoutAliases)).toBe(false);
  });

  it("the default coaching context text in types.ts", () => {
    const types = read("src/lib/types.ts");
    expect(personal.test(types.slice(types.indexOf("export const DEFAULT_COACHING_CONTEXT")))).toBe(false);
  });

  it("the old personal defaults live only in the migration-only module", () => {
    expect(read("src/lib/legacyDefaults.ts")).toMatch(/Safe to delete/);
  });
});
