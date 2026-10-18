// Display formatting for muscle scores. Tiers are always classified on the
// UNROUNDED score (tierForScore); this only decides how the number is shown so
// it can never contradict the tier: a score within TIER_BOUNDARY_DECIMAL_WINDOW
// of a tier boundary gets one decimal, and a score just below a boundary is
// truncated (59.96 shows "59.9", never "60").
import { MUSCLE_TIERS, TIER_BOUNDARY_DECIMAL_WINDOW } from "./muscleScoreConfig";

const BOUNDARIES = MUSCLE_TIERS.slice(1).map((t) => t.minScore);

export function isNearTierBoundary(score: number): boolean {
  return BOUNDARIES.some((b) => Math.abs(score - b) < TIER_BOUNDARY_DECIMAL_WINDOW);
}

export function formatScore(score: number): string {
  if (!isNearTierBoundary(score)) return String(Math.round(score));
  const below = BOUNDARIES.some((b) => score < b && b - score < TIER_BOUNDARY_DECIMAL_WINDOW);
  const value = below ? Math.floor(score * 10) / 10 : Math.round(score * 10) / 10;
  return value.toFixed(1);
}
