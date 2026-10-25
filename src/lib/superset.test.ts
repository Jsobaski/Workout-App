import { describe, expect, it } from "vitest";
import { buildEntries, supersetPosition, MovementInput } from "./superset";
import { formatWorkoutText } from "./shareText";
import { WorkoutEntry } from "./types";

const move = (name: string, extra: Partial<MovementInput> = {}): MovementInput => ({
  name,
  sets: [{ reps: 10, weight: 0 }],
  bodyweight: false,
  timed: false,
  banded: false,
  notes: "",
  ...extra,
});

describe("buildEntries", () => {
  it("logs a superset as separate entries sharing one id, in order", () => {
    const entries = buildEntries(
      [move("Side Plank", { timed: true, sets: [{ reps: 0, weight: 0, durationSec: 30 }, { reps: 0, weight: 0, durationSec: 30 }] }), move("Single Leg Bridge", { bodyweight: true })],
      1000,
      () => "ss-1"
    );
    expect(entries.map((e) => e.exerciseName)).toEqual(["Side Plank", "Single Leg Bridge"]);
    expect(entries.every((e) => e.supersetId === "ss-1")).toBe(true);
    expect(entries[0].timed).toBe(true);
    expect(entries[0].sets).toHaveLength(2);
    expect(entries[1].bodyweight).toBe(true);
    expect(entries[1].timestamp).toBeGreaterThan(entries[0].timestamp); // order survives sorting by time
  });

  it("a single movement is an ordinary entry, and blank movements are ignored", () => {
    const single = buildEntries([move("Back Squat")], 1, () => "x");
    expect(single).toHaveLength(1);
    expect("supersetId" in single[0]).toBe(false);
    const withBlank = buildEntries([move("Back Squat"), move("  ")], 1, () => "x");
    expect(withBlank).toHaveLength(1);
    expect(withBlank[0].supersetId).toBeUndefined();
    expect(buildEntries([move("")], 1, () => "x")).toEqual([]);
  });

  it("keeps each movement's own flags, notes and muscle groups", () => {
    const [a, b] = buildEntries([move("Bench Press", { notes: " heavy " }), move("Lat Pulldown", { banded: false })], 1, () => "s");
    expect(a.notes).toBe("heavy");
    expect(b.notes).toBeUndefined();
    expect(a.muscleGroups).toContain("Chest");
    expect(b.muscleGroups).toContain("Back");
  });
});

describe("superset display", () => {
  const e = (id: string, name: string, supersetId?: string): WorkoutEntry => ({
    id, dateKey: "2026-10-25", timestamp: 1, exerciseName: name, muscleGroups: [], sets: [{ reps: 10, weight: 20 }], ...(supersetId ? { supersetId } : {}),
  });
  const list = [e("1", "Back Squat"), e("2", "Side Plank", "s"), e("3", "Single Leg Bridge", "s")];

  it("labels positions within a superset and nothing for normal entries", () => {
    expect(supersetPosition(list, 0)).toBeNull();
    expect(supersetPosition(list, 1)).toEqual({ position: 1, total: 2 });
    expect(supersetPosition(list, 2)).toEqual({ position: 2, total: 2 });
    expect(supersetPosition([e("9", "Lonely", "z")], 0)).toBeNull();
  });

  it("copy text groups the superset under one heading", () => {
    const text = formatWorkoutText("2026-10-25", list);
    expect(text).toContain("Back Squat: 10×20lb");
    expect(text).toMatch(/Superset \(alternating\):\n {2}Side Plank: .*\n {2}Single Leg Bridge: /);
    expect(text.match(/Superset \(alternating\)/g)).toHaveLength(1);
  });
});
