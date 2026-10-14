// Orchestrates the pure scoring math (muscleScoring.ts) over actual workout
// logs. Still a pure function — given the same entries/bodyweight/date it
// always returns the same result — nothing here is persisted as the source
// of truth; call it fresh wherever you need muscle stats.
import { WorkoutEntry } from "./types";
import { shiftDateKey } from "./date";
import { BodyMapRegion } from "./bodyMapGeometry";
import { MUSCLE_GROUPS, MuscleGroupId } from "./muscleTaxonomy";
import { ExerciseMapping, lookupExerciseMapping } from "./exerciseMuscleMap";
import {
  BODYWEIGHT_FALLBACK_LB,
  DEFAULT_STALE_THRESHOLD_DAYS,
  FRESHNESS_SET_THRESHOLD_RATIO,
  LIFT_FAMILY_STANDARDS,
  MUSCLE_TIERS,
  MuscleTier,
  UNRATED_COLOR,
  VOLUME_BONUS_MAX_POINTS,
  VOLUME_BONUS_TARGET_SESSIONS,
  VOLUME_BONUS_WINDOW_DAYS,
} from "./muscleScoreConfig";
import { applyDecay, clampScore, daysBetween, epley1RM, ratioToScore, volumeConsistencyBonus } from "./muscleScoring";

export interface BestLift {
  exerciseName: string;
  e1RM: number;
  dateKey: string;
}

export interface MuscleStats {
  group: MuscleGroupId;
  hasAnyData: boolean;
  /** Lifetime-best raw composite score (0-100) as of the queried date. Null when hasAnyData is false. */
  peak: number | null;
  /** Peak decayed for recency — what actually drives the tier/color. */
  effective: number | null;
  lastTrainedDateKey: string | null;
  daysStale: number | null;
  isStale: boolean;
  bestLift: BestLift | null;
  contributingExercises: string[];
}

export interface MuscleEngineResult {
  statsByGroup: Record<MuscleGroupId, MuscleStats>;
  /** Distinct logged exercise names that couldn't be mapped to any muscle — surfaced in the UI, never silently dropped. */
  needsMapping: string[];
}

function loadForSet(
  set: { reps: number; weight: number },
  isBodyweight: boolean | undefined,
  bodyweightLb: number,
  bodyweightFraction: number | undefined
): number {
  if (!isBodyweight) return set.weight;
  return bodyweightLb * (bodyweightFraction ?? 1) + set.weight;
}

// For a timed entry (e.g. plank holds), seconds held stands in for reps in
// the Epley estimate — there's no absolute standard for isometric holds, so
// this only ever feeds the freshness/consistency comparisons, which are
// self-referential against that same exercise's own history anyway.
function quantityForSet(set: { reps: number; durationSec?: number }, isTimed: boolean | undefined): number {
  return isTimed ? set.durationSec ?? 0 : set.reps;
}

function standardsForMapping(mapping: ExerciseMapping): [number, number, number, number, number] | null {
  if (mapping.scoring.method === "standard") {
    return LIFT_FAMILY_STANDARDS[mapping.scoring.family];
  }
  if (mapping.scoring.method === "proxy") {
    const base = LIFT_FAMILY_STANDARDS[mapping.scoring.family];
    const factor = mapping.scoring.factor;
    return [base[0] * factor, base[1] * factor, base[2] * factor, base[3] * factor, base[4] * factor];
  }
  return null; // volumeOnly
}

export function computeMuscleEngine(
  entries: WorkoutEntry[],
  bodyweightLb: number | null,
  asOfDateKey: string,
  staleThresholdDays: number = DEFAULT_STALE_THRESHOLD_DAYS
): MuscleEngineResult {
  const effectiveBodyweight = bodyweightLb && bodyweightLb > 0 ? bodyweightLb : BODYWEIGHT_FALLBACK_LB;
  const relevant = entries.filter((e) => e.dateKey <= asOfDateKey);

  const mappingByKey = new Map<string, ExerciseMapping | null>();
  const needsMapping = new Set<string>();
  for (const entry of relevant) {
    const key = entry.exerciseName.trim().toLowerCase();
    if (mappingByKey.has(key)) continue;
    const mapping = lookupExerciseMapping(entry.exerciseName);
    mappingByKey.set(key, mapping);
    if (!mapping) needsMapping.add(entry.exerciseName.trim());
  }

  // Lifetime-best e1RM per exercise (as of asOfDateKey) — the "current e1RM"
  // used both for the load-standard score and as the freshness threshold.
  const bestByExercise = new Map<string, BestLift>();
  for (const entry of relevant) {
    const key = entry.exerciseName.trim().toLowerCase();
    const mapping = mappingByKey.get(key);
    if (!mapping) continue;
    const bwFraction = mapping.scoring.method === "standard" ? mapping.scoring.bodyweightFraction : undefined;
    for (const set of entry.sets) {
      const load = loadForSet(set, entry.bodyweight, effectiveBodyweight, bwFraction);
      const e1RM = epley1RM(load, quantityForSet(set, entry.timed));
      const current = bestByExercise.get(key);
      if (!current || e1RM > current.e1RM) {
        bestByExercise.set(key, { exerciseName: entry.exerciseName.trim(), e1RM, dateKey: entry.dateKey });
      }
    }
  }

  const statsByGroup = {} as Record<MuscleGroupId, MuscleStats>;

  for (const groupDef of MUSCLE_GROUPS) {
    let hasAnyData = false;
    let hasLoadablePrimary = false;
    let bestWeightedLiftScore = 0;
    let bestLift: BestLift | null = null;
    let lastMeaningfulDateKey: string | null = null;
    const contributingExercises = new Set<string>();

    for (const entry of relevant) {
      const key = entry.exerciseName.trim().toLowerCase();
      const mapping = mappingByKey.get(key);
      if (!mapping) continue;
      const contribution = mapping.muscles.find((m) => m.group === groupDef.id);
      if (!contribution) continue;

      hasAnyData = true;
      contributingExercises.add(entry.exerciseName.trim());

      const liftPeak = bestByExercise.get(key);
      const bwFraction = mapping.scoring.method === "standard" ? mapping.scoring.bodyweightFraction : undefined;

      // Freshness: a set only resets the clock if it's >= 60% of this
      // specific lift's own lifetime-best e1RM — warm-ups don't count.
      if (liftPeak) {
        const hasMeaningfulSet = entry.sets.some((set) => {
          const load = loadForSet(set, entry.bodyweight, effectiveBodyweight, bwFraction);
          const e1RM = epley1RM(load, quantityForSet(set, entry.timed));
          return e1RM >= FRESHNESS_SET_THRESHOLD_RATIO * liftPeak.e1RM;
        });
        if (hasMeaningfulSet && (!lastMeaningfulDateKey || entry.dateKey > lastMeaningfulDateKey)) {
          lastMeaningfulDateKey = entry.dateKey;
        }
      }

      const standards = standardsForMapping(mapping);
      if (standards && liftPeak) {
        // Only a *primary* (1.0-weight) loadable contributor should reclassify
        // the whole muscle into the "scored against a load standard" branch —
        // a muscle mostly trained via volumeOnly work (e.g. Abs via Pallof/
        // planks) shouldn't lose its consistency-driven scoring just because
        // some unrelated lift (e.g. Farmer Carry) touches it as a minor
        // secondary. The weighted score itself still counts either way.
        if (contribution.weight >= 1.0) hasLoadablePrimary = true;
        const ratio = liftPeak.e1RM / effectiveBodyweight;
        const liftScore = ratioToScore(ratio, standards);
        const weighted = liftScore * contribution.weight;
        if (weighted > bestWeightedLiftScore) {
          bestWeightedLiftScore = weighted;
          bestLift = liftPeak;
        }
      }
    }

    if (!hasAnyData) {
      statsByGroup[groupDef.id] = {
        group: groupDef.id,
        hasAnyData: false,
        peak: null,
        effective: null,
        lastTrainedDateKey: null,
        daysStale: null,
        isStale: false,
        bestLift: null,
        contributingExercises: [],
      };
      continue;
    }

    const windowStart = shiftDateKey(asOfDateKey, -VOLUME_BONUS_WINDOW_DAYS);
    const distinctDaysInWindow = new Set(
      relevant
        .filter((e) => e.dateKey >= windowStart && e.dateKey <= asOfDateKey)
        .filter((e) => {
          const mapping = mappingByKey.get(e.exerciseName.trim().toLowerCase());
          return mapping?.muscles.some((m) => m.group === groupDef.id) ?? false;
        })
        .map((e) => e.dateKey)
    ).size;

    // A muscle with no *primary* loadable driver (anti-rotation holds,
    // planks) has no load standard to meaningfully score against —
    // consistency itself becomes the primary signal instead of a small
    // top-up, even if a minor secondary lift contributed some load score.
    const peak = hasLoadablePrimary
      ? clampScore(bestWeightedLiftScore + volumeConsistencyBonus(distinctDaysInWindow, VOLUME_BONUS_TARGET_SESSIONS, VOLUME_BONUS_MAX_POINTS))
      : clampScore(bestWeightedLiftScore + volumeConsistencyBonus(distinctDaysInWindow, VOLUME_BONUS_TARGET_SESSIONS, 70));

    // Decay clock runs off "days since last meaningful stimulus" — the same
    // date driving the freshness badge — rather than a separate "days since
    // the single best-ever lift" concept, which would decay a muscle you're
    // still training consistently just because today's sets aren't a new PR.
    const daysStale = lastMeaningfulDateKey != null ? daysBetween(lastMeaningfulDateKey, asOfDateKey) : null;
    const effective = daysStale != null ? applyDecay(peak, daysStale) : applyDecay(peak, Infinity);

    statsByGroup[groupDef.id] = {
      group: groupDef.id,
      hasAnyData: true,
      peak,
      effective,
      lastTrainedDateKey: lastMeaningfulDateKey,
      daysStale,
      isStale: daysStale == null ? true : daysStale >= staleThresholdDays,
      bestLift,
      contributingExercises: Array.from(contributingExercises).sort(),
    };
  }

  return { statsByGroup, needsMapping: Array.from(needsMapping).sort() };
}

export function tierForScore(score: number): MuscleTier {
  let match = MUSCLE_TIERS[0];
  for (const tier of MUSCLE_TIERS) {
    if (score >= tier.minScore) match = tier;
  }
  return match;
}

export function colorForStats(stats: MuscleStats): string {
  if (!stats.hasAnyData || stats.effective == null) return UNRATED_COLOR;
  return tierForScore(stats.effective).color;
}

export interface RegionStats {
  region: BodyMapRegion;
  groups: MuscleGroupId[];
  hasAnyData: boolean;
  effective: number | null;
  isStale: boolean;
}

/**
 * Blends internal muscle groups that share one visual region (e.g. Upper
 * Chest + Mid/Lower Chest both render into the single "chest" polygon).
 * Averages effective score across whichever of the groups actually have
 * data (ignoring unrated siblings rather than dragging the average down),
 * and flags the region stale if any data-bearing group in it is stale.
 */
export function computeRegionStats(
  statsByGroup: Record<MuscleGroupId, MuscleStats>,
  view: "front" | "back"
): Record<BodyMapRegion, RegionStats> {
  const regions = new Map<BodyMapRegion, RegionStats>();
  for (const groupDef of MUSCLE_GROUPS) {
    const region = groupDef.visualRegions[view];
    if (!region) continue;
    const existing = regions.get(region);
    const groups = existing ? [...existing.groups, groupDef.id] : [groupDef.id];
    const ratedEffectives = groups
      .map((g) => statsByGroup[g])
      .filter((s) => s.hasAnyData && s.effective != null)
      .map((s) => s.effective as number);
    const anyStale = groups.some((g) => statsByGroup[g].hasAnyData && statsByGroup[g].isStale);
    regions.set(region, {
      region,
      groups,
      hasAnyData: ratedEffectives.length > 0,
      effective: ratedEffectives.length > 0 ? ratedEffectives.reduce((a, b) => a + b, 0) / ratedEffectives.length : null,
      isStale: anyStale,
    });
  }
  return Object.fromEntries(regions) as Record<BodyMapRegion, RegionStats>;
}

export function colorForRegion(region: RegionStats): string {
  if (!region.hasAnyData || region.effective == null) return UNRATED_COLOR;
  return tierForScore(region.effective).color;
}
