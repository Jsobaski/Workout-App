import { describe, expect, it } from "vitest";
import { MuscleDelta } from "./muscleComparison";
import { RegionStats } from "./muscleEngine";
import { formatMovers, parsePolygon, radarLabelAnchor, radarPoints, regionPaint, splitMuscleLabel, topMovers } from "./muscleShareCard";
import { ELITE_GLOW_COLOR, MUSCLE_TIERS, PAUSED_OUTLINE_COLOR, UNRATED_COLOR } from "./muscleScoreConfig";
import { MUSCLE_GROUPS, MuscleGroupId } from "./muscleTaxonomy";
import { ANTERIOR_REGIONS, POSTERIOR_REGIONS } from "./bodyMapGeometry";

const delta = (value: number | null, status: MuscleDelta["status"] = "like-for-like") => ({ delta: value, status });
function deltas(over: Partial<Record<MuscleGroupId, number | null>>): Record<MuscleGroupId, MuscleDelta> {
  return Object.fromEntries(
    MUSCLE_GROUPS.map((g) => [g.id, { group: g.id, ...(g.id in over ? delta(over[g.id]!, over[g.id] == null ? "new" : "like-for-like") : delta(null, "no-data")) }])
  ) as Record<MuscleGroupId, MuscleDelta>;
}
const region = (over: Partial<RegionStats>): RegionStats => ({ region: "chest", groups: [], hasAnyData: true, effective: 50, isStale: false, isPaused: false, ...over });

describe("topMovers", () => {
  it("returns the biggest real gains, largest first, ignoring falls, tiny changes and 'new exercise' rows", () => {
    const d = deltas({ quads: 12.4, biceps: 8, lats: -20, glutes: 0.4, abs: null, forearms: 5, traps: 3, calves: 9.6 });
    const movers = topMovers(d, 3);
    expect(movers.map((m) => m.id)).toEqual(["quads", "calves", "biceps"]);
    expect(formatMovers(movers)).toBe("Quads +12  ·  Calves +10  ·  Biceps +8");
    expect(topMovers(deltas({ lats: -3, abs: null }))).toEqual([]);
  });
});

describe("regionPaint", () => {
  it("paints unrated and rated regions with the tier colour", () => {
    expect(regionPaint(undefined).fill).toBe(UNRATED_COLOR);
    expect(regionPaint(region({ hasAnyData: false, effective: null })).fill).toBe(UNRATED_COLOR);
    expect(regionPaint(region({ effective: 45 }))).toMatchObject({ fill: MUSCLE_TIERS[2].color, opacity: 1, stroke: null, dashed: false, glow: false });
  });

  it("dims and dashes stale regions, rings paused ones, and glows Elite", () => {
    expect(regionPaint(region({ effective: 45, isStale: true }))).toMatchObject({ opacity: 0.55, stroke: "#a3a3a3", dashed: true });
    expect(regionPaint(region({ effective: 45, isPaused: true }))).toMatchObject({ stroke: PAUSED_OUTLINE_COLOR, dashed: true });
    expect(regionPaint(region({ effective: 90 }))).toMatchObject({ stroke: ELITE_GLOW_COLOR, glow: true, dashed: false });
    expect(regionPaint(region({ effective: 90, isStale: true }))).toMatchObject({ stroke: ELITE_GLOW_COLOR, dashed: true, glow: true });
  });
});

describe("geometry helpers", () => {
  it("parses every body-map polygon into whole coordinate pairs inside the 100 x 200 box", () => {
    for (const geo of [...ANTERIOR_REGIONS, ...POSTERIOR_REGIONS]) {
      for (const poly of geo.svgPoints) {
        const pts = parsePolygon(poly);
        expect(pts.length).toBeGreaterThanOrEqual(3);
        for (const [x, y] of pts) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(100);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(200);
        }
      }
    }
    expect(parsePolygon("1 2 3 4 5 6")).toEqual([[1, 2], [3, 4], [5, 6]]);
  });

  it("radar: first spoke straight up, clockwise, 0-100 scaled to the radius and clamped", () => {
    const [top, right] = radarPoints([100, 100, 100, 100], 0, 0, 10);
    expect(top[0]).toBeCloseTo(0);
    expect(top[1]).toBeCloseTo(-10);
    expect(right[0]).toBeCloseTo(10);
    expect(right[1]).toBeCloseTo(0);
    expect(radarPoints([50], 0, 0, 10)[0][1]).toBeCloseTo(-5);
    expect(radarPoints([250], 0, 0, 10)[0][1]).toBeCloseTo(-10);
    expect(radarPoints([-5], 0, 0, 10)[0][1]).toBeCloseTo(0);
  });

  it("radar labels sit outside the ring and align away from the centre", () => {
    expect(radarLabelAnchor(0, 17, 0, 0, 100, 20)).toMatchObject({ align: "center" });
    expect(radarLabelAnchor(0, 17, 0, 0, 100, 20).y).toBeCloseTo(-120);
    expect(radarLabelAnchor(4, 17, 0, 0, 100, 20).align).toBe("left"); // right half
    expect(radarLabelAnchor(13, 17, 0, 0, 100, 20).align).toBe("right"); // left half
    expect(splitMuscleLabel("Mid/Lower Chest")).toEqual(["Mid/", "Lower", "Chest"]);
    expect(splitMuscleLabel("Quads")).toEqual(["Quads"]);
  });
});
