import { describe, expect, it } from "vitest";
import { clampToLimit, parseLimit } from "./limits";

describe("limits", () => {
  it("parses sets x reps in common spellings", () => {
    expect(parseLimit("2x10")).toEqual({ sets: 2, reps: 10 });
    expect(parseLimit("3 × 8")).toEqual({ sets: 3, reps: 8 });
    expect(parseLimit("max 2X12")).toEqual({ sets: 2, reps: 12 });
    expect(parseLimit("light")).toBeNull();
    expect(parseLimit("")).toBeNull();
    expect(parseLimit(undefined)).toBeNull();
    expect(parseLimit("0x10")).toBeNull();
  });

  it("never suggests beyond the limit", () => {
    expect(clampToLimit({ name: "Leg Press", sets: 4, reps: 12 }, "2x10")).toMatchObject({ sets: 2, reps: 10, clamped: true });
    expect(clampToLimit({ name: "Leg Press", sets: 2, reps: 8 }, "2x10")).toMatchObject({ sets: 2, reps: 8, clamped: false });
    expect(clampToLimit({ name: "Leg Press", sets: 5, reps: 5 }, "3x10")).toMatchObject({ sets: 3, reps: 5, clamped: true });
  });

  it("leaves a suggestion alone when there is no (parseable) limit", () => {
    expect(clampToLimit({ sets: 5, reps: 15 }, undefined)).toMatchObject({ sets: 5, reps: 15, clamped: false });
    expect(clampToLimit({ sets: 5, reps: 15 }, "easy")).toMatchObject({ sets: 5, reps: 15, clamped: false });
  });
});
