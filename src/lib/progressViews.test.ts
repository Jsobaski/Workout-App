import { describe, expect, it } from "vitest";
import { workout } from "./dbTestHelper";
import { shiftDateKey } from "./date";
import { buildExerciseHistory, summarizeSets } from "./exerciseHistory";
import { EASE_BACK_FACTOR, LAYOFF_DAYS, REP_CEILING, REP_FLOOR, suggestNextSets } from "./setSuggestions";
import { buildMuscleTrends, linearSlope, trendDirection } from "./muscleTrends";
import { buildRecapCardModel, buildWorkoutCardModel, MAX_CARD_ROWS } from "./shareCard";
import { buildWeeklyRecap, formatRecapText } from "./recap";
import { computeWins } from "./wins";
import { WorkoutEntry } from "./types";

const TODAY = "2026-10-26";
const at = (id: string, ago: number, name: string, reps: number, weight: number, extra: Partial<WorkoutEntry> = {}): WorkoutEntry => ({
  ...workout(id, shiftDateKey(TODAY, -ago), name, reps, weight),
  ...extra,
});
const sets = (...pairs: [number, number][]) => pairs.map(([reps, weight]) => ({ reps, weight }));

describe("buildExerciseHistory", () => {
  const entries = [
    at("a", 30, "Back Squat", 5, 185),
    at("b", 20, "Back Squat", 5, 195),
    at("c", 10, "Back Squat", 5, 195), // no new best
    at("d", 3, "Back Squat", 5, 215),
    at("x", 3, "Bench Press", 5, 135),
  ];

  it("combines sessions, finds the best set, volume and PRs (the first session is a baseline)", () => {
    const h = buildExerciseHistory(entries, "Back Squat")!;
    expect(h.sessions).toHaveLength(4);
    expect(h.metric).toBe("e1rm");
    expect(h.best.dateKey).toBe(shiftDateKey(TODAY, -3));
    expect(h.best.bestSet).toMatchObject({ reps: 5, weight: 215 });
    expect(h.prs.map((p) => p.dateKey)).toEqual([shiftDateKey(TODAY, -20), shiftDateKey(TODAY, -3)]);
    expect(h.totalVolume).toBe(5 * (185 + 195 + 195 + 215));
    expect(h.totalSets).toBe(4);
  });

  it("matches name variants of the same movement and is null for an unlogged one", () => {
    const withAlias = [at("a", 5, "Romanian Deadlift", 8, 135), at("b", 2, "Romanian Deadlift straight bar", 8, 155)];
    expect(buildExerciseHistory(withAlias, "Romanian Deadlift")!.sessions).toHaveLength(2);
    expect(buildExerciseHistory(entries, "Hack Squat")).toBeNull();
  });

  it("merges two entries on one day and measures bodyweight and timed lifts in reps and seconds", () => {
    const day = [at("a", 4, "Back Squat", 5, 185), at("b", 4, "Back Squat", 5, 205)];
    expect(buildExerciseHistory(day, "Back Squat")!.sessions[0].sets).toHaveLength(2);
    const pull = [at("a", 9, "Pull Up", 6, 0, { bodyweight: true }), at("b", 2, "Pull Up", 8, 0, { bodyweight: true })];
    const h = buildExerciseHistory(pull, "Pull Up")!;
    expect(h.metric).toBe("reps");
    expect(h.best.best).toBe(8);
    expect(h.prs).toHaveLength(1);
    const plank = [at("a", 9, "Plank", 0, 0, { timed: true, sets: [{ reps: 0, weight: 0, durationSec: 45 }] }), at("b", 2, "Plank", 0, 0, { timed: true, sets: [{ reps: 0, weight: 0, durationSec: 60 }] })];
    expect(buildExerciseHistory(plank, "Plank")!.metric).toBe("seconds");
    expect(buildExerciseHistory(plank, "Plank")!.best.best).toBe(60);
  });

  it("summarises sets compactly", () => {
    const f = { timed: false, bodyweight: false, banded: false };
    expect(summarizeSets(sets([10, 25], [10, 25], [10, 25]), f)).toBe("3×10 @ 25 lb");
    expect(summarizeSets(sets([10, 25], [8, 25]), f)).toBe("10×25, 8×25 lb");
    expect(summarizeSets(sets([10, 0], [8, 0]), { ...f, bodyweight: true })).toBe("10, 8 reps");
  });
});

describe("suggestNextSets", () => {
  const hist = (entries: WorkoutEntry[], name = "Back Squat") => buildExerciseHistory(entries, name);

  it("adds a rep at the same weight until every working set reaches the ceiling", () => {
    const h = hist([at("a", 4, "Cable Curl", 10, 25, { sets: sets([10, 25], [9, 25], [8, 25]) })], "Cable Curl");
    const s = suggestNextSets(h, TODAY)!;
    expect(s.kind).toBe("add-rep");
    expect(s.sets.map((x) => [x.reps, x.weight])).toEqual([[11, 25], [10, 25], [9, 25]]);
  });

  it("adds weight and restarts at the floor once all working sets hit the ceiling, leaving warm-ups alone", () => {
    const h = hist([at("a", 4, "Back Squat", 5, 100, { sets: sets([10, 45], [REP_CEILING, 100], [REP_CEILING, 100]) })]);
    const s = suggestNextSets(h, TODAY)!;
    expect(s.kind).toBe("add-weight");
    expect(s.sets.map((x) => [x.reps, x.weight])).toEqual([[10, 45], [REP_FLOOR, 105], [REP_FLOOR, 105]]);
    // Lighter loads move in 2.5 lb steps.
    const light = hist([at("a", 4, "Lateral Raise", 12, 15, { sets: sets([12, 15], [12, 15]) })], "Lateral Raise");
    expect(suggestNextSets(light, TODAY)!.sets[0].weight).toBe(17.5);
  });

  it("repeats an off day, and eases back after a long break", () => {
    const off = hist([at("a", 14, "Back Squat", 5, 225), at("b", 4, "Back Squat", 5, 185)]);
    expect(suggestNextSets(off, TODAY)!.kind).toBe("repeat");
    const gap = hist([at("a", LAYOFF_DAYS + 10, "Back Squat", 8, 200)]);
    const s = suggestNextSets(gap, TODAY)!;
    expect(s.kind).toBe("ease-back");
    expect(s.sets[0].weight).toBe(Math.round((200 * EASE_BACK_FACTOR) / 2.5) * 2.5);
    expect(s.sets[0].reps).toBe(8);
  });

  it("handles bodyweight, timed and banded movements, and has nothing for a new one", () => {
    const bw = hist([at("a", 4, "Pull Up", 8, 0, { bodyweight: true })], "Pull Up");
    expect(suggestNextSets(bw, TODAY)).toMatchObject({ kind: "add-rep", flags: { bodyweight: true } });
    expect(suggestNextSets(bw, TODAY)!.sets[0].reps).toBe(9);
    const plank = hist([at("a", 4, "Plank", 0, 0, { timed: true, sets: [{ reps: 0, weight: 0, durationSec: 45 }] })], "Plank");
    expect(suggestNextSets(plank, TODAY)!.sets[0].durationSec).toBe(50);
    expect(suggestNextSets(null, TODAY)).toBeNull();
  });
});

describe("muscle trends", () => {
  const climbing = Array.from({ length: 10 }, (_, i) => at(`s${i}`, 70 - i * 7, "Back Squat", 5, 135 + i * 10));

  it("gives each muscle a series ending today and a rising slope for a lifter who keeps adding weight", () => {
    const t = buildMuscleTrends(climbing, 180, TODAY, undefined, { weeks: 8 });
    expect(t.dates).toHaveLength(9);
    expect(t.dates[8]).toBe(TODAY);
    expect(t.series.quads).toHaveLength(9);
    expect(t.series.quads[8]!).toBeGreaterThan(t.series.quads[0] ?? 0);
    expect(t.slopePerWeek.quads!).toBeGreaterThan(0.4);
    expect(trendDirection(t.slopePerWeek.quads)).toBe("rising");
    expect(t.series.calves.every((v) => v === null)).toBe(true);
    expect(t.slopePerWeek.calves).toBeNull();
  });

  it("slope math and direction thresholds", () => {
    expect(linearSlope([0, 1, 2, 3], [10, 12, 14, 16])).toBeCloseTo(2);
    expect(linearSlope([0, 1], [1, 2])).toBeNull();
    expect(trendDirection(0.1)).toBe("steady");
    expect(trendDirection(-1)).toBe("falling");
    expect(trendDirection(null)).toBeNull();
  });
});

describe("share cards", () => {
  const entries: WorkoutEntry[] = [
    at("1", 0, "Side Plank", 0, 0, { timed: true, supersetId: "s", sets: [{ reps: 0, weight: 0, durationSec: 30 }, { reps: 0, weight: 0, durationSec: 30 }] }),
    at("2", 0, "Single Leg Bridge", 10, 0, { bodyweight: true, supersetId: "s" }),
    at("3", 0, "Back Squat", 5, 185, { sets: sets([5, 185], [5, 185], [5, 185]) }),
  ];

  it("workout card lists each movement with a compact set summary and tags the superset", () => {
    const m = buildWorkoutCardModel(TODAY, entries, { totalVolume: 2775, setCount: 6 }, ["🎃"]);
    expect(m.rows.map((r) => r.primary)).toEqual(["Side Plank", "Single Leg Bridge", "Back Squat"]);
    expect(m.rows[0]).toMatchObject({ secondary: "2 × 30s", tag: "Superset" });
    expect(m.rows[2].secondary).toBe("3×5 @ 185 lb");
    expect(m.stats).toEqual([
      { label: "Exercises", value: "3" },
      { label: "Sets", value: "6" },
      { label: "Volume", value: "2,775 lb" },
    ]);
    expect(m.emojis).toEqual(["🎃"]);
    expect(m.moreCount).toBe(0);
  });

  it("caps long sessions and says how many are left out", () => {
    const many = Array.from({ length: MAX_CARD_ROWS + 3 }, (_, i) => at(`m${i}`, 0, `Lift ${i}`, 5, 100));
    const m = buildWorkoutCardModel(TODAY, many, { totalVolume: 1, setCount: 1 });
    expect(m.rows).toHaveLength(MAX_CARD_ROWS);
    expect(m.moreCount).toBe(3);
  });

  it("recap card and copy text carry the same numbers", () => {
    const week = [at("a", 13, "Back Squat", 5, 185), at("b", 11, "Back Squat", 5, 195), at("c", 9, "Back Squat", 5, 205)];
    const wins = computeWins(week, { bodyweightLb: 180 });
    const recap = buildWeeklyRecap(TODAY, week, [], wins, { bodyweightLb: 180, proteinTargetG: null });
    const card = buildRecapCardModel(recap);
    expect(card.days).toHaveLength(7);
    expect(card.stats[0].value).toBe(`${recap.daysTrained} / 7`);
    const text = formatRecapText(recap);
    expect(text).toContain(`Days trained: ${recap.daysTrained}/7`);
    expect(text).toContain(`Sets: ${recap.setCount}`);
  });
});
