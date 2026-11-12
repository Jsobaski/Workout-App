// Pure pieces of the muscle-map share image: who moved most, how a body-map region is painted,
// and the radar's geometry. The canvas drawing (muscleShareCanvas.ts) uses these, so they're unit-tested.
import { MuscleDelta } from "./muscleComparison";
import { RegionStats, tierForScore } from "./muscleEngine";
import { ELITE_GLOW_COLOR, PAUSED_OUTLINE_COLOR, UNRATED_COLOR } from "./muscleScoreConfig";
import { MUSCLE_GROUPS, MuscleGroupId } from "./muscleTaxonomy";

export interface Mover {
  id: MuscleGroupId;
  label: string;
  delta: number;
}

/** The muscles with the biggest real gains, largest first. Only numeric deltas count; falls and "new exercise" rows are left out. */
export function topMovers(deltas: Record<MuscleGroupId, MuscleDelta>, count = 3, minDelta = 1): Mover[] {
  return MUSCLE_GROUPS.map((g) => ({ id: g.id, label: g.label, delta: deltas[g.id]?.delta }))
    .filter((m): m is Mover => m.delta != null && Math.round(m.delta) >= minDelta)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, count);
}

export function formatMovers(movers: Mover[]): string {
  return movers.map((m) => `${m.label} +${Math.round(m.delta)}`).join("  ·  ");
}

export interface RegionPaint {
  fill: string;
  opacity: number;
  /** Outline colour, or null for none. */
  stroke: string | null;
  dashed: boolean;
  /** Elite regions get a gold glow. */
  glow: boolean;
}

/** How one body-map region is painted: the same rules as the on-screen map (tier colour, dimmed when stale, ringed when paused, glowing at Elite). */
export function regionPaint(region: RegionStats | undefined): RegionPaint {
  if (!region || !region.hasAnyData || region.effective == null) {
    return { fill: UNRATED_COLOR, opacity: 1, stroke: null, dashed: false, glow: false };
  }
  const tier = tierForScore(region.effective);
  const elite = tier.id === "elite";
  const dashed = region.isStale || region.isPaused;
  const stroke = region.isStale ? (elite ? ELITE_GLOW_COLOR : "#a3a3a3") : region.isPaused ? PAUSED_OUTLINE_COLOR : elite ? ELITE_GLOW_COLOR : null;
  return { fill: tier.color, opacity: region.isStale ? 0.55 : 1, stroke, dashed, glow: elite };
}

/** "x y x y ..." from the body-map geometry as coordinate pairs. */
export function parsePolygon(points: string): [number, number][] {
  const nums = points.trim().split(/\s+/).map(Number);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
  return out;
}

/**
 * Radar vertices: value 0-100 per spoke, spokes evenly spaced clockwise starting at the top
 * (the same orientation as the on-screen radar). Returns canvas coordinates around (cx, cy).
 */
export function radarPoints(values: number[], cx: number, cy: number, radius: number): [number, number][] {
  const n = values.length;
  return values.map((v, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const r = (Math.max(0, Math.min(100, v)) / 100) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  });
}

/** Where a spoke's label goes: a point just outside the outer ring, and which way the text should align. */
export function radarLabelAnchor(index: number, count: number, cx: number, cy: number, radius: number, gap: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
  const cos = Math.cos(angle);
  return {
    x: cx + (radius + gap) * cos,
    y: cy + (radius + gap) * Math.sin(angle),
    align: Math.abs(cos) < 0.25 ? ("center" as const) : cos > 0 ? ("left" as const) : ("right" as const),
  };
}

/** Short lines for a muscle label ("Mid/Lower Chest" -> Mid/ | Lower | Chest), as on the on-screen radar. */
export function splitMuscleLabel(label: string): string[] {
  return label.replace(/\//g, "/ ").split(" ").filter(Boolean);
}
