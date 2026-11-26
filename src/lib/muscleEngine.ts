// Orchestrates the pure scoring math (muscleScoring.ts) over actual workout
// logs. Still a pure function — given the same entries/bodyweight/date it
// always returns the same result — nothing here is persisted as the source
// of truth; call it fresh wherever you need muscle stats.
import { WorkoutEntry } from "./types";
import { shiftDateKey } from "./date";
import { BodyMapRegion } from "./bodyMapGeometry";
import { MUSCLE_GROUPS, MuscleGroupId } from "./muscleTaxonomy";
import { standardForMapping } from "./standards";
import { liftGroupMap } from "./liftGroups";
import {
  ExerciseSettingsData,
  ResolvedExerciseConfig,
  effectiveLoadForSet,
  groupHasAllowedExercise,
  resolveExerciseConfig,
} from "./exerciseSettings";
import {
  CONSISTENCY_LOOKBACK_DAYS,
  BODYWEIGHT_FALLBACK_LB,
  DEFAULT_STALE_THRESHOLD_DAYS,
  FRESHNESS_SET_THRESHOLD_RATIO,
  MUSCLE_TIERS,
  MuscleTier,
  PROVISIONAL_CAP_EPSILON,
  PROVISIONAL_MIN_SESSIONS,
  SECONDARY_CAP_FRACTION,
  SECONDARY_ONLY_CAP,
  UNRATED_COLOR,
  VOLUME_BONUS_MAX_POINTS,
  VOLUME_BONUS_TARGET_SESSIONS,
  VOLUME_BONUS_WINDOW_DAYS,
} from "./muscleScoreConfig";
import {
  applyDecay,
  daysBetween,
  decayFactor,
  estimate1RM,
  normalizedBodyweightRatio,
  ratioToUncappedScore,
  softCapScore,
  volumeConsistencyBonus,
} from "./muscleScoring";

export interface BestLift {
  /** Canonical exercise key, for looking up how the lift is scored. */
  key: string;
  exerciseName: string;
  e1RM: number;
  dateKey: string;
}

/** One load-scored exercise's standing for one muscle — the unit used for like-for-like comparisons. */
export interface ExerciseScoreSnapshot {
  key: string;
  /** Lift group (see liftGroups.ts): exercises that are automatically treated as the same lift share it. */
  groupKey: string;
  name: string;
  /** This exercise's contribution weight to the muscle (1.0 primary, 0.4 secondary, 0.15 minor). */
  weight: number;
  e1RM: number;
  /** Weighted, display-scale score at this exercise's lifetime best. */
  peakScore: number;
  /** peakScore decayed by this exercise's own time since last meaningful set. */
  effectiveScore: number;
  lastDateKey: string | null;
  /** Restricted by the user (still scored the same; shown so the breakdown is honest about it). */
  restricted: boolean;
}

/** Every term between the per-lift credits and a muscle's final score, so any score can be reproduced by hand. */
export interface ScoreArithmetic {
  /** Best primary lift's weighted credit (peak, and after its own decay). 0 when there is no scored primary lift. */
  primary: { name: string | null; peak: number; effective: number };
  /** Best secondary/minor credit before and after the cap (0.5 x the primary credit, or a flat cap with no primary). */
  secondary: { name: string | null; raw: number; cap: number; credited: number };
  /** Consistency bonus in points, the most it could be, and the weighted training days behind it. */
  consistency: { points: number; maxPoints: number; weightedDays: number };
  /** The earlier score kept by the basis-change floor, when it applies. */
  basisFloor: number | null;
  /** True when the muscle only has incidental (secondary/minor) exposure, so its whole score is capped at SECONDARY_ONLY_CAP. */
  incidentalOnly: boolean;
  /** primary + secondary + consistency, before the floor and the soft cap. */
  rawSum: number;
  /** Raw peak after the floor and any incidental cap, then after the soft cap (the displayed peak before any provisional hold). */
  peakRaw: number;
  peakSoftCapped: number;
  /** Combined decay share applied to get the effective score, and the effective score before any provisional hold. */
  decayShare: number;
  effectiveBeforeHold: number;
  /** Provisional hold: the tier the score computes to, and whether the hold actually lowered the score. */
  computedTier: string;
  provisionalHeld: boolean;
}

/** Where a consistency-scored muscle's peak came from: the window and the exercises on its training days. */
export interface ConsistencyPeak {
  windowStart: string;
  windowEnd: string;
  weightedDays: number;
  bonusPoints: number;
  lookbackDays: number;
  exercises: { name: string; days: number; weight: number; restricted: boolean }[];
}

export interface MuscleStats {
  group: MuscleGroupId;
  hasAnyData: boolean;
  /** Lifetime-best composite score on the displayed 0-100 scale (soft-capped, so 100 is effectively unreachable). Null when hasAnyData is false. */
  peak: number | null;
  /** Peak decayed for recency — what actually drives the tier/color. Held below the computed tier while provisional. */
  effective: number | null;
  /** True when the score comes solely from one lift group logged on fewer than PROVISIONAL_MIN_SESSIONS days. */
  provisional: boolean;
  /** Distinct days the leading lift group has been logged (including grouped exercises); null when not applicable. */
  provisionalSessions: number | null;
  /** The effective score before any provisional cap. */
  uncappedEffective: number | null;
  /** Uncapped versions of peak/effective: keep climbing past 100 so progress stays visible. */
  peakRaw: number | null;
  effectiveRaw: number | null;
  /** "load": scored against a strength standard. "reps-time": scored by training consistency (no meaningful load). */
  scoringBasis: "load" | "reps-time" | null;
  /** Last meaningful *primary* work. Secondary/minor credit never moves this. */
  lastTrainedDateKey: string | null;
  /** Last meaningful secondary/minor exposure — informational only, not part of staleness. */
  lastSecondaryDateKey: string | null;
  daysStale: number | null;
  isStale: boolean;
  /** Decay/staleness is paused: the last primary work was a restricted exercise AND this muscle has no allowed exercise at all. */
  pausedRestricted: boolean;
  /** The last primary work for this muscle was a restricted exercise (it may still have allowed alternatives). */
  lastPrimaryWasRestricted: boolean;
  bestLift: BestLift | null;
  contributingExercises: string[];
  exerciseScores: ExerciseScoreSnapshot[];
  /** Set for consistency-scored muscles: the window that produced the peak. Null for strength-scored ones. */
  consistencyPeak: ConsistencyPeak | null;
  arithmetic: ScoreArithmetic | null;
}

export interface MuscleEngineResult {
  statsByGroup: Record<MuscleGroupId, MuscleStats>;
  /** Distinct logged exercise names that couldn't be mapped to any muscle — surfaced in the UI, never silently dropped. */
  needsMapping: string[];
}

// For a timed entry (e.g. plank holds), seconds held stands in for reps in
// the Epley estimate — there's no absolute standard for isometric holds, so
// this only ever feeds the freshness/consistency comparisons, which are
// self-referential against that same exercise's own history anyway.
function quantityForSet(set: { reps: number; durationSec?: number }, isTimed: boolean | undefined): number {
  return isTimed ? set.durationSec ?? 0 : set.reps;
}

interface ResolvedEntry {
  entry: WorkoutEntry;
  cfg: ResolvedExerciseConfig;
  /** At least one set reached FRESHNESS_SET_THRESHOLD_RATIO of this exercise's best effort. */
  meaningful: boolean;
}

interface ExerciseBest {
  name: string;
  bestE1RM: number;
  bestE1RMDateKey: string;
  /** e1RM when the set carried load, otherwise reps/seconds — only ever compared within one exercise. */
  bestEffort: number;
}

export function computeMuscleEngine(
  entries: WorkoutEntry[],
  bodyweightLb: number | null,
  asOfDateKey: string,
  staleThresholdDays: number = DEFAULT_STALE_THRESHOLD_DAYS,
  settings?: ExerciseSettingsData,
  options: { basisFloor?: boolean } = {}
): MuscleEngineResult {
  const effectiveBodyweight = bodyweightLb && bodyweightLb > 0 ? bodyweightLb : BODYWEIGHT_FALLBACK_LB;
  const relevant = entries.filter((e) => e.dateKey <= asOfDateKey);

  const configByName = new Map<string, ResolvedExerciseConfig | null>();
  const needsMapping = new Set<string>();
  const resolvedEntries: { entry: WorkoutEntry; cfg: ResolvedExerciseConfig }[] = [];
  for (const entry of relevant) {
    const nameKey = entry.exerciseName.trim().toLowerCase();
    if (!configByName.has(nameKey)) {
      const cfg = resolveExerciseConfig(entry.exerciseName, settings);
      configByName.set(nameKey, cfg);
      if (!cfg) needsMapping.add(entry.exerciseName.trim());
    }
    const cfg = configByName.get(nameKey);
    if (cfg) resolvedEntries.push({ entry, cfg });
  }

  function measureSet(entry: WorkoutEntry, set: WorkoutEntry["sets"][number], cfg: ResolvedExerciseConfig) {
    const load = effectiveLoadForSet(set.weight, {
      isBodyweight: entry.bodyweight,
      bodyweightLb: effectiveBodyweight,
      bodyweightFraction: cfg.bodyweightFraction,
      loadMultiplier: cfg.loadMultiplier,
      sides: cfg.sides,
    });
    const quantity = quantityForSet(set, entry.timed);
    const e1RM = estimate1RM(load, quantity);
    return { e1RM, effort: load > 0 ? e1RM : quantity };
  }

  // Lifetime-best per canonical exercise (as of asOfDateKey) — variants of the
  // same movement (e.g. "Calf Raise" / "Standing Calf") combine here. The best
  // e1RM drives the load-standard score; the best effort is the freshness bar.
  const bestByExercise = new Map<string, ExerciseBest>();
  for (const { entry, cfg } of resolvedEntries) {
    for (const set of entry.sets) {
      const { e1RM, effort } = measureSet(entry, set, cfg);
      const current = bestByExercise.get(cfg.key) ?? {
        name: cfg.displayName,
        bestE1RM: 0,
        bestE1RMDateKey: entry.dateKey,
        bestEffort: 0,
      };
      if (e1RM > current.bestE1RM) {
        current.bestE1RM = e1RM;
        current.bestE1RMDateKey = entry.dateKey;
      }
      if (effort > current.bestEffort) current.bestEffort = effort;
      bestByExercise.set(cfg.key, current);
    }
  }

  // Freshness: a session only counts as meaningful stimulus if one of its sets
  // is >= 60% of this specific exercise's own best — warm-ups don't count.
  const resolved: ResolvedEntry[] = resolvedEntries.map(({ entry, cfg }) => {
    const best = bestByExercise.get(cfg.key)!;
    const meaningful =
      best.bestEffort > 0 &&
      entry.sets.some((set) => measureSet(entry, set, cfg).effort >= FRESHNESS_SET_THRESHOLD_RATIO * best.bestEffort);
    return { entry, cfg, meaningful };
  });

  const lastMeaningfulByExercise = new Map<string, string>();
  for (const r of resolved) {
    if (!r.meaningful) continue;
    const current = lastMeaningfulByExercise.get(r.cfg.key);
    if (!current || r.entry.dateKey > current) lastMeaningfulByExercise.set(r.cfg.key, r.entry.dateKey);
  }

  // Automatic lift grouping: grouped exercises share history (distinct days
  // logged), so a lift you switch to inherits the group's track record.
  const groupOf = liftGroupMap(settings);
  const groupKeyOf = (key: string) => groupOf.get(key) ?? key;
  const groupDates = new Map<string, Set<string>>();
  for (const { entry, cfg } of resolved) {
    const g = groupKeyOf(cfg.key);
    if (!groupDates.has(g)) groupDates.set(g, new Set());
    groupDates.get(g)!.add(entry.dateKey);
  }
  const sessionsOf = (group: string) => groupDates.get(group)?.size ?? 0;

  // The same engine run on the history before a given day (memoised), for the basis-change floor.
  const priorSnapshots = new Map<string, Record<MuscleGroupId, MuscleStats>>();
  const priorSnapshot = (dateKey: string) => {
    let snap = priorSnapshots.get(dateKey);
    if (!snap) {
      snap = computeMuscleEngine(
        entries.filter((e) => e.dateKey < dateKey),
        bodyweightLb,
        shiftDateKey(dateKey, -1),
        staleThresholdDays,
        settings,
        { basisFloor: false }
      ).statsByGroup;
      priorSnapshots.set(dateKey, snap);
    }
    return snap;
  };

  const windowStart = shiftDateKey(asOfDateKey, -VOLUME_BONUS_WINDOW_DAYS);
  const statsByGroup = {} as Record<MuscleGroupId, MuscleStats>;

  for (const groupDef of MUSCLE_GROUPS) {
    let hasAnyData = false;
    let hasLoadablePrimary = false;
    let bestPrimaryScore = 0;
    let bestSecondaryScore = 0;
    // The same two, after each lift's own decay (see exerciseScores).
    let bestPrimaryEff = 0;
    let bestSecondaryEff = 0;
    let bestSecondaryName: string | null = null;
    let hasPrimaryExposure = false;
    let bestLift: BestLift | null = null;
    let bestLiftKey: string | null = null;
    let lastPrimary: string | null = null;
    let lastPrimaryRestricted: string | null = null;
    let lastPrimaryAllowed: string | null = null;
    let lastSecondary: string | null = null;
    // Earliest day this muscle got direct (primary, load-scored) work.
    let firstDirectDate: string | null = null;
    const contributingExercises = new Set<string>();
    const exerciseScores = new Map<string, ExerciseScoreSnapshot>();
    // Training days in the consistency window, each weighted by the strongest
    // contribution that day (a primary day counts 1, a secondary day 0.4).
    const dayWeights = new Map<string, number>();
    // The same weights over the whole history, for consistency-only muscles (see bestWindowDayWeightSum).
    const allDayWeights = new Map<string, number>();
    const dayExercises = new Map<string, Map<string, { name: string; weight: number; restricted: boolean }>>();

    for (const { entry, cfg, meaningful } of resolved) {
      const contribution = cfg.mapping.muscles.find((m) => m.group === groupDef.id);
      if (!contribution) continue;

      hasAnyData = true;
      contributingExercises.add(cfg.displayName);
      const isPrimary = contribution.weight >= 1.0;
      if (isPrimary) hasPrimaryExposure = true;

      // Only primary work moves the "last trained" clock; secondary/minor
      // exposure is tracked separately and never resets staleness.
      if (meaningful) {
        if (isPrimary) {
          if (!lastPrimary || entry.dateKey > lastPrimary) lastPrimary = entry.dateKey;
          if (cfg.restricted) {
            if (!lastPrimaryRestricted || entry.dateKey > lastPrimaryRestricted) lastPrimaryRestricted = entry.dateKey;
          } else if (!lastPrimaryAllowed || entry.dateKey > lastPrimaryAllowed) {
            lastPrimaryAllowed = entry.dateKey;
          }
        } else if (!lastSecondary || entry.dateKey > lastSecondary) {
          lastSecondary = entry.dateKey;
        }
      }

      allDayWeights.set(entry.dateKey, Math.max(allDayWeights.get(entry.dateKey) ?? 0, contribution.weight));
      if (!dayExercises.has(entry.dateKey)) dayExercises.set(entry.dateKey, new Map());
      dayExercises.get(entry.dateKey)!.set(cfg.key, { name: cfg.displayName, weight: contribution.weight, restricted: cfg.restricted });
      if (entry.dateKey >= windowStart && entry.dateKey <= asOfDateKey) {
        dayWeights.set(entry.dateKey, Math.max(dayWeights.get(entry.dateKey) ?? 0, contribution.weight));
      }

      const best = bestByExercise.get(cfg.key)!;
      const standards = standardForMapping(cfg.mapping, settings?.standards ?? "unspecified");
      if (isPrimary && standards && best.bestE1RM > 0 && (firstDirectDate == null || entry.dateKey < firstDirectDate)) {
        firstDirectDate = entry.dateKey;
      }
      // No load credit (e.g. bodyweight-only reps at fraction 0) -> best.bestE1RM is 0
      // and the exercise feeds consistency only, never the strength score.
      if (!standards || best.bestE1RM <= 0 || exerciseScores.has(cfg.key)) continue;

      // Only a *primary* (1.0-weight) loadable contributor should reclassify
      // the whole muscle into the "scored against a load standard" branch —
      // a muscle mostly trained via volumeOnly work (e.g. Abs via planks)
      // shouldn't lose its consistency-driven scoring just because some
      // unrelated lift (e.g. Farmer Carry) touches it as a minor secondary.
      // The weighted score itself still counts either way.
      if (isPrimary) hasLoadablePrimary = true;
      // Only a primary contributor may run past 100 (uncapped); incidental
      // credit is capped at 100 before weighting so a huge number on an
      // easy-to-max lift can't make a barely-trained muscle look strong.
      const scoredE1RM = best.bestE1RM;
      const rawLiftScore = ratioToUncappedScore(normalizedBodyweightRatio(scoredE1RM, effectiveBodyweight), standards);
      const liftScore = isPrimary ? rawLiftScore : Math.min(rawLiftScore, 100);
      const weighted = liftScore * contribution.weight;
      const peakScore = softCapScore(weighted);
      const lastDateKey = lastMeaningfulByExercise.get(cfg.key) ?? null;
      exerciseScores.set(cfg.key, {
        key: cfg.key,
        groupKey: groupKeyOf(cfg.key),
        name: cfg.displayName,
        weight: contribution.weight,
        e1RM: scoredE1RM,
        peakScore,
        effectiveScore: applyDecay(peakScore, lastDateKey ? daysBetween(lastDateKey, asOfDateKey) : Infinity),
        lastDateKey,
        restricted: cfg.restricted,
      });
      // Each lift's raw credit decays on its own clock (days since that lift was last done meaningfully).
      const liftDecay = decayFactor(lastDateKey ? daysBetween(lastDateKey, asOfDateKey) : Infinity);
      if (isPrimary) bestPrimaryEff = Math.max(bestPrimaryEff, weighted * liftDecay);
      else bestSecondaryEff = Math.max(bestSecondaryEff, weighted * liftDecay);
      if (isPrimary) {
        if (bestLift == null || weighted > bestPrimaryScore) {
          bestPrimaryScore = weighted;
          bestLiftKey = cfg.key;
          bestLift = { key: cfg.key, exerciseName: best.name, e1RM: scoredE1RM, dateKey: best.bestE1RMDateKey };
        }
      } else if (weighted > bestSecondaryScore) {
        bestSecondaryScore = weighted;
        bestSecondaryName = cfg.displayName;
      }
    }

    if (!hasAnyData) {
      statsByGroup[groupDef.id] = {
        group: groupDef.id,
        hasAnyData: false,
        peak: null,
        effective: null,
        provisional: false,
        provisionalSessions: null,
        uncappedEffective: null,
        peakRaw: null,
        effectiveRaw: null,
        scoringBasis: null,
        lastTrainedDateKey: null,
        lastSecondaryDateKey: null,
        daysStale: null,
        isStale: false,
        pausedRestricted: false,
        lastPrimaryWasRestricted: false,
        bestLift: null,
        contributingExercises: [],
        exerciseScores: [],
        consistencyPeak: null,
        arithmetic: null,
      };
      continue;
    }

    // Secondary credit never exceeds a fraction of this muscle's own best
    // primary lift (so triceps are scored from tricep lifts, not the chest
    // press); with no primary lift it's capped at a small flat amount.
    const secondaryCap = hasLoadablePrimary ? SECONDARY_CAP_FRACTION * bestPrimaryScore : SECONDARY_ONLY_CAP;
    const bestWeightedLiftScore = Math.max(bestPrimaryScore, Math.min(bestSecondaryScore, secondaryCap));
    // Strength-scored muscles keep their lift score between sessions, so only the small consistency top-up looks at
    // the last window. A consistency-only muscle (planks, holds) has nothing else, so its peak is the best window it
    // reached within CONSISTENCY_LOOKBACK_DAYS (older windows are history, not evidence), decayed from the last real work.
    let consistencyPeak: ConsistencyPeak | null = null;
    let effectiveConsistencyBonus = 0;
    let weightedDays: number;
    if (hasLoadablePrimary) {
      weightedDays = Array.from(dayWeights.values()).reduce((a, b) => a + b, 0);
    } else {
      const windows = bestConsistencyWindows(allDayWeights, VOLUME_BONUS_WINDOW_DAYS, asOfDateKey, CONSISTENCY_LOOKBACK_DAYS, (d) =>
        volumeConsistencyBonus(d, VOLUME_BONUS_TARGET_SESSIONS, 70)
      );
      const win = windows.peak;
      effectiveConsistencyBonus = windows.current.bonus;
      weightedDays = win.sum;
      const perExercise = new Map<string, { name: string; days: number; weight: number; restricted: boolean }>();
      for (const [date, exs] of dayExercises) {
        if (date < win.start || date > win.end) continue;
        for (const [key, ex] of exs) {
          const cur = perExercise.get(key) ?? { ...ex, days: 0 };
          cur.days += 1;
          cur.weight = Math.max(cur.weight, ex.weight);
          perExercise.set(key, cur);
        }
      }
      consistencyPeak = {
        windowStart: win.start,
        windowEnd: win.end,
        weightedDays: win.sum,
        bonusPoints: 0, // filled below
        lookbackDays: CONSISTENCY_LOOKBACK_DAYS,
        exercises: Array.from(perExercise.values()).sort((a, b) => b.days - a.days),
      };
    }
    const bonusMax = hasLoadablePrimary ? VOLUME_BONUS_MAX_POINTS : 70;
    const bonusPoints = volumeConsistencyBonus(weightedDays, VOLUME_BONUS_TARGET_SESSIONS, bonusMax);
    if (consistencyPeak) consistencyPeak.bonusPoints = bonusPoints;
    const rawSum = bestWeightedLiftScore + bonusPoints;
    // A muscle that only ever gets incidental (secondary/minor) exposure can't be scored above the incidental cap, no
    // matter how often that exposure shows up: showing up as a helper isn't training the muscle.
    const incidentalOnly = !hasPrimaryExposure;
    let peakRaw = incidentalOnly ? Math.min(rawSum, SECONDARY_ONLY_CAP) : rawSum;
    let peak = softCapScore(peakRaw);

    // Basis change: a muscle that was scored from incidental credit / consistency (no direct lift) and now
    // has its first direct lift keeps at least the score it already had, so doing the right exercise can't
    // lower it. Once the direct lift's score exceeds the earlier one, the direct score simply takes over.
    let floorPeak: number | null = null;
    let floorEffective: number | null = null;
    let floorRaw = 0;
    if (options.basisFloor !== false && hasLoadablePrimary && firstDirectDate != null) {
      const earlier = priorSnapshot(firstDirectDate)[groupDef.id];
      if (earlier.hasAnyData && earlier.scoringBasis !== "load" && earlier.peak != null && earlier.effective != null) {
        floorPeak = earlier.peak;
        floorEffective = earlier.effective;
        peak = Math.max(peak, earlier.peak);
        peakRaw = Math.max(peakRaw, earlier.peakRaw ?? 0);
        floorRaw = earlier.peakRaw ?? 0;
      }
    }

    // Decay clock runs off "days since last meaningful *primary* stimulus"
    // rather than a separate "days since the single best-ever lift" concept,
    // which would decay a muscle you're still training consistently just
    // because today's sets aren't a new PR.
    const daysStale = lastPrimary != null ? daysBetween(lastPrimary, asOfDateKey) : null;

    // Restriction pause: only when the muscle has NO allowed exercise at all (every
    // primary exercise for it is restricted) and its last primary work was
    // restricted — then the clock is frozen instead of decaying for work
    // the user has chosen not to do. If any allowed exercise exists (e.g. leg
    // press for quads) the muscle decays normally and the UI suggests it.
    const lastPrimaryWasRestricted =
      lastPrimaryRestricted != null && (lastPrimaryAllowed == null || lastPrimaryRestricted >= lastPrimaryAllowed);
    const pausedRestricted =
      lastPrimaryWasRestricted &&
      !groupHasAllowedExercise(groupDef.id, settings) &&
      daysStale != null &&
      daysStale >= staleThresholdDays;

    // Every lift's credit decays from when that lift was last done, so an old peak can't be kept fresh by training a
    // different lift. The consistency top-up and consistency-scored muscles decay from the muscle's last primary work.
    const muscleDecay = decayFactor(daysStale ?? Infinity);
    const effectiveSecondaryCap = hasLoadablePrimary ? SECONDARY_CAP_FRACTION * bestPrimaryEff : SECONDARY_ONLY_CAP;
    const liftPartEff = hasLoadablePrimary
      ? Math.max(bestPrimaryEff, Math.min(bestSecondaryEff, effectiveSecondaryCap))
      : bestWeightedLiftScore * muscleDecay;
    // The basis-change floor (the score the muscle already had) is carried through decay on the muscle's own clock.
    // A consistency-scored muscle's bonus has already been decayed from the day its window ended (see above).
    const bonusEff = consistencyPeak ? effectiveConsistencyBonus : bonusPoints * muscleDecay;
    const effectiveRawPerLift = Math.max(liftPartEff + bonusEff, floorRaw * muscleDecay);
    // When every component shares one clock this equals peak * decayFactor, as before.
    const perLiftRatio = peakRaw > 0 ? Math.min(1, effectiveRawPerLift / peakRaw) : muscleDecay;
    let effective = pausedRestricted ? peak : peak * perLiftRatio;
    const uncappedEffective = effective;
    const decayShare = pausedRestricted ? 1 : perLiftRatio;
    const effectiveBeforeHold = effective;
    const peakBeforeHold = peak;
    const computedTierLabel = tierForScore(effective).label;
    let provisionalHeld = false;

    // Provisional: the strength score comes solely from one lift group that has
    // been logged on fewer than PROVISIONAL_MIN_SESSIONS days (grouped exercises
    // count together, and another established primary lift means it isn't "solely").
    // The tier is held one level below the computed one until the third session.
    let provisional = false;
    let provisionalSessions: number | null = null;
    if (hasLoadablePrimary && bestLiftKey != null) {
      const topGroup = groupKeyOf(bestLiftKey);
      provisionalSessions = sessionsOf(topGroup);
      const establishedElsewhere = Array.from(exerciseScores.values()).some(
        (e) => e.weight >= 1 && e.groupKey !== topGroup && sessionsOf(e.groupKey) >= PROVISIONAL_MIN_SESSIONS
      );
      provisional = provisionalSessions < PROVISIONAL_MIN_SESSIONS && !establishedElsewhere;
    }
    if (provisional) {
      const computedTier = tierForScore(effective);
      if (computedTier.minScore > 0) {
        const cap = computedTier.minScore - PROVISIONAL_CAP_EPSILON;
        // The cap never pushes a muscle below the score it already had (see the basis-change floor).
        effective = Math.max(Math.min(effective, cap), Math.min(effective, floorEffective ?? 0));
        peak = Math.max(Math.min(peak, cap), Math.min(peak, floorPeak ?? 0));
        provisionalHeld = effective < effectiveBeforeHold - 1e-9;
      }
    }
    const effectiveRaw = pausedRestricted ? peakRaw : peakRaw * perLiftRatio;

    statsByGroup[groupDef.id] = {
      group: groupDef.id,
      hasAnyData: true,
      peak,
      effective,
      provisional,
      provisionalSessions,
      uncappedEffective,
      peakRaw,
      effectiveRaw,
      scoringBasis: hasLoadablePrimary ? "load" : "reps-time",
      lastTrainedDateKey: lastPrimary,
      lastSecondaryDateKey: lastSecondary,
      daysStale,
      isStale: pausedRestricted ? false : daysStale == null ? true : daysStale >= staleThresholdDays,
      pausedRestricted,
      lastPrimaryWasRestricted,
      bestLift,
      contributingExercises: Array.from(contributingExercises).sort(),
      exerciseScores: Array.from(exerciseScores.values()),
      consistencyPeak,
      arithmetic: {
        primary: { name: bestLift?.exerciseName ?? null, peak: bestPrimaryScore, effective: bestPrimaryEff },
        secondary: {
          name: bestSecondaryName,
          raw: bestSecondaryScore,
          cap: secondaryCap,
          credited: Math.min(bestSecondaryScore, secondaryCap),
        },
        consistency: { points: bonusPoints, maxPoints: bonusMax, weightedDays },
        basisFloor: floorPeak != null ? floorRaw : null,
        incidentalOnly,
        rawSum,
        peakRaw,
        peakSoftCapped: peakBeforeHold,
        decayShare,
        effectiveBeforeHold,
        computedTier: computedTierLabel,
        provisionalHeld,
      },
    };
  }

  return { statsByGroup, needsMapping: Array.from(needsMapping).sort() };
}

/**
 * Consistency windows of `windowDays` ending on a training day (or on asOfDateKey) within `lookbackDays` of
 * asOfDateKey. `peak` is the one with the most weighted training days (ties go to the latest); `current` is the one
 * whose bonus is worth most after decaying from the day it ended, so an old peak competes with recent work at its
 * decayed value, exactly as a lift's old best competes with a newer lift.
 */
function bestConsistencyWindows(
  weights: Map<string, number>,
  windowDays: number,
  asOfDateKey: string,
  lookbackDays: number,
  bonusFor: (weightedDays: number) => number
): { peak: { sum: number; start: string; end: string }; current: { bonus: number; end: string } } {
  const dates = Array.from(weights.keys());
  const earliestEnd = shiftDateKey(asOfDateKey, -lookbackDays);
  let peak = { sum: 0, start: asOfDateKey, end: asOfDateKey };
  let current = { bonus: 0, end: asOfDateKey };
  for (const end of [...dates, asOfDateKey].filter((d) => d >= earliestEnd && d <= asOfDateKey).sort()) {
    const start = shiftDateKey(end, -windowDays);
    let sum = 0;
    for (const d of dates) if (d >= start && d <= end) sum += weights.get(d)!;
    if (sum >= peak.sum && sum > 0) peak = { sum, start, end };
    const decayed = bonusFor(sum) * decayFactor(daysBetween(end, asOfDateKey));
    if (decayed > current.bonus) current = { bonus: decayed, end };
  }
  return { peak, current };
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

export function tierOutlineForScore(score: number | null): string | undefined {
  return score == null ? undefined : tierForScore(score).outline;
}

export interface RegionStats {
  region: BodyMapRegion;
  groups: MuscleGroupId[];
  hasAnyData: boolean;
  effective: number | null;
  isStale: boolean;
  isPaused: boolean;
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
    const anyPaused = groups.some((g) => statsByGroup[g].pausedRestricted);
    regions.set(region, {
      region,
      groups,
      hasAnyData: ratedEffectives.length > 0,
      effective: ratedEffectives.length > 0 ? ratedEffectives.reduce((a, b) => a + b, 0) / ratedEffectives.length : null,
      isStale: anyStale,
      isPaused: anyPaused,
    });
  }
  return Object.fromEntries(regions) as Record<BodyMapRegion, RegionStats>;
}

export function colorForRegion(region: RegionStats): string {
  if (!region.hasAnyData || region.effective == null) return UNRATED_COLOR;
  return tierForScore(region.effective).color;
}
