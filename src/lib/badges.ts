import { FoodEntry, GolfActivityEntry, WorkoutEntry } from "./types";
import { todayKey, shiftDateKey } from "./date";

export interface BadgeCategory {
  id: string;
  title: string;
  icon: string;
  unit: string;
  /** Short noun phrase for a count of this category, used in goal hints: "1 workout", "10,000 lb of volume". */
  noun: (n: number) => string;
  /** Ascending milestone thresholds. */
  tiers: number[];
  /** How to phrase a reached/target value, e.g. v => `${v} workouts completed`. */
  describe: (value: number) => string;
}

export const BADGE_CATEGORIES: BadgeCategory[] = [
  {
    id: "workouts",
    title: "Workouts",
    icon: "🎯",
    unit: "workouts",
    noun: (n) => `workout${n === 1 ? "" : "s"}`,
    tiers: [1, 10, 25, 50, 100, 200, 365],
    describe: (v) => `${v} workout${v === 1 ? "" : "s"} completed`,
  },
  {
    id: "volume",
    title: "Volume",
    icon: "🏋️",
    unit: "lb",
    noun: () => "lb of volume",
    tiers: [10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000],
    describe: (v) => `${v.toLocaleString()} lb total volume`,
  },
  {
    id: "streak",
    title: "Streaks",
    icon: "🔥",
    unit: "weeks",
    noun: (n) => `week${n === 1 ? "" : "s"} in a row`,
    tiers: [1, 4, 8, 12, 26, 52],
    describe: (v) => `${v} week${v === 1 ? "" : "s"} streak`,
  },
  {
    id: "consistency",
    title: "Consistency",
    icon: "📅",
    unit: "workouts/month",
    noun: () => "workouts in a month",
    tiers: [4, 8, 12, 16, 20, 24],
    describe: (v) => `${v} workouts in a month`,
  },
  {
    id: "golf",
    title: "Golf Activity",
    icon: "⛳",
    unit: "sessions",
    noun: (n) => `golf session${n === 1 ? "" : "s"}`,
    tiers: [1, 5, 10, 25, 50, 100],
    describe: (v) => `${v} golf session${v === 1 ? "" : "s"} logged`,
  },
  {
    id: "protein",
    title: "Nutrition",
    icon: "🥩",
    unit: "days",
    noun: (n) => `day${n === 1 ? "" : "s"} hitting your protein target in a row`,
    tiers: [3, 7, 14, 30, 60, 100],
    describe: (v) => `${v}-day protein streak`,
  },
];

export interface BadgeProgress {
  category: BadgeCategory;
  value: number;
  unlockedTiers: number[];
  currentTier: number | null;
  nextTier: number | null;
  progressToNext: number; // 0..1
  /** Set to false when the metric can't be computed yet (e.g. no protein target set). */
  available: boolean;
}

export function computeProgress(category: BadgeCategory, value: number, available = true): BadgeProgress {
  const unlockedTiers = category.tiers.filter((t) => value >= t);
  const currentTier = unlockedTiers.length > 0 ? unlockedTiers[unlockedTiers.length - 1] : null;
  const nextTier = category.tiers.find((t) => t > value) ?? null;
  const floor = currentTier ?? 0;
  const progressToNext = nextTier ? Math.min(1, (value - floor) / (nextTier - floor)) : 1;
  return { category, value, unlockedTiers, currentTier, nextTier, progressToNext, available };
}

/**
 * The next reachable goal, phrased for a compact list: "1 workout to your first badge",
 * "3 workouts to your next badge". Null when every badge is unlocked or the metric isn't available.
 */
export function nextGoalHint(progress: BadgeProgress): string | null {
  if (!progress.available || progress.nextTier == null) return null;
  const remaining = progress.nextTier - progress.value;
  const first = progress.currentTier == null;
  return `${remaining.toLocaleString()} ${progress.category.noun(remaining)} to your ${first ? "first" : "next"} badge`;
}

// ---- Metric calculations ----

export function totalWorkoutDays(entries: WorkoutEntry[]): number {
  return new Set(entries.map((e) => e.dateKey)).size;
}

export function totalVolume(entries: WorkoutEntry[]): number {
  return entries.reduce(
    (sum, e) => sum + e.sets.reduce((s, set) => s + set.reps * set.weight, 0),
    0
  );
}

function isoWeekKey(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  const day = date.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - diffToMonday);
  return monday.toISOString().slice(0, 10);
}

// Consecutive weeks (each containing at least one workout), counted back
// from the most recent week that has a workout logged — so an in-progress
// current week with nothing logged yet doesn't falsely break the streak.
export function currentWeekStreak(entries: WorkoutEntry[]): number {
  if (entries.length === 0) return 0;
  const weeksWithWorkout = new Set(entries.map((e) => isoWeekKey(e.dateKey)));
  const sortedWeeks = Array.from(weeksWithWorkout).sort((a, b) => b.localeCompare(a));
  let streak = 0;
  let cursor = sortedWeeks[0];
  for (const week of sortedWeeks) {
    if (week !== cursor) break;
    streak += 1;
    cursor = shiftIsoWeek(cursor, -1);
  }
  return streak;
}

function shiftIsoWeek(weekKey: string, deltaWeeks: number): string {
  const d = new Date(`${weekKey}T00:00:00`);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return d.toISOString().slice(0, 10);
}

// Best single calendar-month count of distinct workout days.
export function bestMonthWorkoutCount(entries: WorkoutEntry[]): number {
  const byMonth = new Map<string, Set<string>>();
  for (const e of entries) {
    const monthKey = e.dateKey.slice(0, 7); // YYYY-MM
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, new Set());
    byMonth.get(monthKey)!.add(e.dateKey);
  }
  let best = 0;
  for (const days of byMonth.values()) {
    best = Math.max(best, days.size);
  }
  return best;
}

export function golfSessionCount(entries: GolfActivityEntry[]): number {
  return entries.length;
}

// Consecutive days (back from today) whose total logged protein meets or
// exceeds the target. A day with nothing logged breaks the streak — we
// can't confirm the target was hit if there's no data for it.
export function currentProteinStreak(
  entries: FoodEntry[],
  targetG: number | null
): number {
  if (!targetG || targetG <= 0) return 0;
  const byDay = new Map<string, number>();
  for (const e of entries) {
    byDay.set(e.dateKey, (byDay.get(e.dateKey) ?? 0) + e.proteinG);
  }
  let streak = 0;
  let cursor = todayKey();
  // Today may still be in progress — skip it if nothing's logged yet rather
  // than counting that as a broken streak, then walk backward from there.
  if (!byDay.has(cursor)) cursor = shiftDateKey(cursor, -1);
  while (byDay.has(cursor) && (byDay.get(cursor) ?? 0) >= targetG) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}
