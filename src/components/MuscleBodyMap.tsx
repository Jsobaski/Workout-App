"use client";

import { useEffect, useState } from "react";
import { ANTERIOR_REGIONS, BODY_MAP_VIEWBOX, BodyMapRegion, POSTERIOR_REGIONS } from "@/lib/bodyMapGeometry";
import { MuscleGroupId } from "@/lib/muscleTaxonomy";
import { MuscleStats, colorForRegion, computeRegionStats, tierForScore } from "@/lib/muscleEngine";
import { ELITE_GLOW_COLOR, MUSCLE_TIERS, PAUSED_OUTLINE_COLOR, UNRATED_COLOR } from "@/lib/muscleScoreConfig";

interface TrackedTiers {
  view: "front" | "back";
  tiers: Partial<Record<BodyMapRegion, number>>;
}

export default function MuscleBodyMap({
  statsByGroup,
  view,
  onRegionClick,
}: {
  statsByGroup: Record<MuscleGroupId, MuscleStats>;
  view: "front" | "back";
  onRegionClick: (groups: MuscleGroupId[]) => void;
}) {
  const regionStats = computeRegionStats(statsByGroup, view);
  const regionGeometry = view === "front" ? ANTERIOR_REGIONS : POSTERIOR_REGIONS;

  // Brief glow when a region crosses into a higher tier since the last
  // render. Computed during render (React's "adjust state when a value
  // changes" pattern) rather than in an effect, since it's a synchronous
  // derivation, not a subscription to an external system — the effect below
  // only handles the timeout that clears the glow afterward.
  const [glowing, setGlowing] = useState<Set<BodyMapRegion>>(new Set());
  const [tracked, setTracked] = useState<TrackedTiers>({ view, tiers: {} });

  const nextTiers: Partial<Record<BodyMapRegion, number>> = {};
  for (const geo of regionGeometry) {
    const stats = regionStats[geo.region];
    if (stats?.hasAnyData && stats.effective != null) {
      nextTiers[geo.region] = tierIndexForScore(stats.effective);
    }
  }
  const tiersChanged = regionGeometry.some((geo) => nextTiers[geo.region] !== tracked.tiers[geo.region]);
  if (tracked.view !== view || tiersChanged) {
    const newlyGlowing = new Set<BodyMapRegion>();
    if (tracked.view === view) {
      for (const geo of regionGeometry) {
        const prev = tracked.tiers[geo.region];
        const next = nextTiers[geo.region];
        if (prev != null && next != null && next > prev) newlyGlowing.add(geo.region);
      }
    }
    setTracked({ view, tiers: nextTiers });
    if (newlyGlowing.size > 0) setGlowing(newlyGlowing);
  }

  useEffect(() => {
    if (glowing.size === 0) return;
    const timeout = setTimeout(() => setGlowing(new Set()), 1400);
    return () => clearTimeout(timeout);
  }, [glowing]);

  return (
    <svg viewBox={BODY_MAP_VIEWBOX} className="mx-auto w-full max-w-[220px]" role="img" aria-label={`${view} body map`}>
      {regionGeometry.map((geo) => {
        const stats = regionStats[geo.region];
        const color = stats ? colorForRegion(stats) : UNRATED_COLOR;
        const isStale = stats?.isStale ?? false;
        const isPaused = stats?.isPaused ?? false;
        const isGlowing = glowing.has(geo.region);
        const isElite = stats?.hasAnyData && stats.effective != null && tierForScore(stats.effective).id === "elite";
        // Elite is near-white with a gold ring + glow so it reads as the brightest
        // tier and can't be mistaken for unrated; stale dashes and the paused
        // (restricted) ring take over the outline when they apply.
        const stroke = isStale
          ? isElite ? ELITE_GLOW_COLOR : "#a3a3a3"
          : isPaused ? PAUSED_OUTLINE_COLOR : isElite ? ELITE_GLOW_COLOR : "none";
        const dashed = isStale || isPaused;
        return geo.svgPoints.map((points, i) => (
          <polygon
            key={`${geo.region}-${i}`}
            points={points}
            onClick={() => onRegionClick(stats?.groups ?? [])}
            style={{
              fill: color,
              cursor: "pointer",
              opacity: isStale ? 0.55 : 1,
              transition: "fill 0.5s ease, opacity 0.5s ease",
              filter: isGlowing
                ? "drop-shadow(0 0 4px #34d399) drop-shadow(0 0 8px #34d399)"
                : isElite
                  ? `drop-shadow(0 0 2px ${ELITE_GLOW_COLOR}) drop-shadow(0 0 5px ${ELITE_GLOW_COLOR}88)`
                  : undefined,
            }}
            stroke={stroke}
            strokeWidth={stroke === "none" ? 0 : isElite && !dashed ? 0.7 : 0.5}
            strokeDasharray={dashed ? "1.5 1" : undefined}
          >
            {isStale && (
              <animate attributeName="stroke-opacity" values="1;0.2;1" dur="2s" repeatCount="indefinite" />
            )}
          </polygon>
        ));
      })}
    </svg>
  );
}

function tierIndexForScore(score: number): number {
  const tier = tierForScore(score);
  return MUSCLE_TIERS.findIndex((t) => t.id === tier.id);
}
