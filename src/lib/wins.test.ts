import { describe, expect, it } from "vitest";
import { workout } from "./dbTestHelper";
import { shiftDateKey } from "./date";
import { computeWins, newWinsFromSave } from "./wins";
import { buildWeeklyRecap, mondayOf, recapWeekStart } from "./recap";

const TODAY = "2026-10-21"; // Wednesday
const at = (id: string, ago: number, name: string, reps: number, weight: number) =>
  workout(id, shiftDateKey(TODAY, -ago), name, reps, weight);
const opts = { bodyweightLb: 180 };

describe("computeWins", () => {
  it("flags a PR only when an earlier best is beaten (the first log is a baseline)", () => {
    const entries = [at("a", 20, "Back Squat", 5, 185), at("b", 13, "Back Squat", 5, 185), at("c", 6, "Back Squat", 5, 205)];
    const prs = computeWins(entries, opts).filter((w) => w.kind === "pr");
    expect(prs).toHaveLength(1);
    expect(prs[0]).toMatchObject({ dateKey: shiftDateKey(TODAY, -6), title: "New Back Squat PR" });
    expect(prs[0].detail).toMatch(/Estimated 1RM \d+ → \d+ lb/);
  });

  it("ignores timed, banded and zero-load work", () => {
    const timed = { ...at("t", 3, "Plank", 1, 0), timed: true };
    const bw = { ...at("b", 1, "Push Up", 20, 0), bodyweight: true };
    expect(computeWins([at("p", 9, "Plank", 1, 0), timed], opts).filter((w) => w.kind === "pr")).toEqual([]);
    expect(computeWins([bw], opts).filter((w) => w.kind !== "badge")).toEqual([]);
  });

  it("flags a muscle moving up a tier on the day it happens", () => {
    const entries = [
      at("a", 40, "Back Squat", 5, 95),
      at("b", 33, "Back Squat", 5, 105),
      at("c", 26, "Back Squat", 5, 115),
      at("d", 2, "Back Squat", 5, 225),
    ];
    const tiers = computeWins(entries, opts).filter((w) => w.kind === "tier");
    expect(tiers.length).toBeGreaterThan(0);
    expect(tiers.every((w) => w.dateKey === shiftDateKey(TODAY, -2) || w.dateKey < shiftDateKey(TODAY, -2))).toBe(true);
    expect(tiers.some((w) => w.title.startsWith("Quads reached"))).toBe(true);
  });

  it("flags crossing a badge milestone once", () => {
    const entries = Array.from({ length: 10 }, (_, i) => at(`w${i}`, 40 - i * 3, "Bench Press", 5, 135));
    const badges = computeWins(entries, opts).filter((w) => w.kind === "badge" && w.detail === "10 workouts completed");
    expect(badges).toHaveLength(1);
    expect(badges[0].dateKey).toBe(shiftDateKey(TODAY, -40 + 9 * 3));
    const first = computeWins(entries, opts).filter((w) => w.detail === "1 workout completed");
    expect(first).toHaveLength(1);
  });

  it("is newest first, and sinceDateKey trims old wins without losing the baseline", () => {
    const entries = [at("a", 50, "Back Squat", 5, 185), at("b", 40, "Back Squat", 5, 195), at("c", 3, "Back Squat", 5, 215)];
    const all = computeWins(entries, opts);
    expect(all.map((w) => w.dateKey)).toEqual([...all.map((w) => w.dateKey)].sort().reverse());
    const recent = computeWins(entries, { ...opts, sinceDateKey: shiftDateKey(TODAY, -10) });
    expect(recent.every((w) => w.dateKey >= shiftDateKey(TODAY, -10))).toBe(true);
    expect(recent.some((w) => w.kind === "pr" && w.detail.startsWith("Estimated 1RM 2"))).toBe(true); // 195-baseline → 215, not "first log"
  });
});

describe("newWinsFromSave", () => {
  const history = [at("a", 20, "Back Squat", 5, 185), at("b", 10, "Back Squat", 5, 195)];

  it("returns only the wins the save created", () => {
    const saved = workout("n", TODAY, "Back Squat", 5, 225);
    const wins = newWinsFromSave(history, [...history, saved], TODAY, opts);
    expect(wins.some((w) => w.kind === "pr" && w.id === `pr:${TODAY}:back squat`)).toBe(true);
    expect(wins.every((w) => w.dateKey === TODAY)).toBe(true);
  });

  it("returns nothing for an ordinary session", () => {
    const saved = workout("n", TODAY, "Back Squat", 5, 175);
    expect(newWinsFromSave(history, [...history, saved], TODAY, opts).filter((w) => w.kind === "pr")).toEqual([]);
  });

  it("does not re-announce a PR that was already there", () => {
    const first = workout("n", TODAY, "Back Squat", 5, 225);
    const second = workout("m", TODAY, "Leg Press", 10, 300);
    const afterFirst = [...history, first];
    const wins = newWinsFromSave(afterFirst, [...afterFirst, second], TODAY, opts);
    expect(wins.some((w) => w.id === `pr:${TODAY}:back squat`)).toBe(false);
  });
});

describe("weekly recap", () => {
  it("uses the last completed week Monday-Saturday and the current week on Sunday", () => {
    expect(mondayOf("2026-10-21")).toBe("2026-10-19");
    expect(recapWeekStart("2026-10-21")).toEqual({ weekStart: "2026-10-12", inProgress: false });
    expect(recapWeekStart("2026-10-25")).toEqual({ weekStart: "2026-10-19", inProgress: true }); // Sunday
    expect(recapWeekStart("2026-10-19")).toEqual({ weekStart: "2026-10-12", inProgress: false }); // Monday
  });

  it("summarises days, sets, volume, previous week, wins and protein days", () => {
    const w = (id: string, d: string, weight: number) => workout(id, d, "Back Squat", 5, weight);
    const workouts = [w("p1", "2026-10-06", 185), w("a", "2026-10-12", 195), w("b", "2026-10-14", 205), w("c", "2026-10-16", 215), w("late", "2026-10-20", 225)];
    const foods = ["2026-10-12", "2026-10-13", "2026-10-14"].map((d, i) => ({
      id: `f${i}`, dateKey: d, timestamp: 0, itemName: "x", calories: 500, proteinG: i === 1 ? 100 : 160, source: "typed" as const,
    }));
    const wins = computeWins(workouts, opts);
    const recap = buildWeeklyRecap("2026-10-21", workouts, foods, wins, { bodyweightLb: 180, proteinTargetG: 150 });
    expect(recap).toMatchObject({ weekStart: "2026-10-12", weekEnd: "2026-10-18", inProgress: false, daysTrained: 3, setCount: 3 });
    expect(recap.trained).toEqual([true, false, true, false, true, false, false]);
    expect(recap.volume).toBe(5 * 195 + 5 * 205 + 5 * 215);
    expect(recap.previousVolume).toBe(5 * 185);
    expect(recap.proteinDaysHit).toBe(2);
    expect(recap.wins.every((x) => x.dateKey >= "2026-10-12" && x.dateKey <= "2026-10-18")).toBe(true);
    expect(recap.wins.some((x) => x.kind === "pr")).toBe(true);
    expect(buildWeeklyRecap("2026-10-21", workouts, foods, wins, { bodyweightLb: 180, proteinTargetG: null }).proteinDaysHit).toBeNull();
  });
});
