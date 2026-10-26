// Weekly recap (Monday to Sunday). On Sunday it wraps up the week in progress;
// on any other day it recaps the last completed week. Pure.
import { shiftDateKey } from "./date";
import { workoutSummary } from "./aggregate";
import { ExerciseSettingsData } from "./exerciseSettings";
import { Win } from "./wins";
import { FoodEntry, WorkoutEntry } from "./types";

export interface WeeklyRecap {
  weekStart: string;
  weekEnd: string;
  /** True when the recap is of the week still in progress (Sunday). */
  inProgress: boolean;
  /** Seven flags, Monday first. */
  trained: boolean[];
  daysTrained: number;
  setCount: number;
  volume: number;
  /** Volume of the week before, or null when nothing was logged then. */
  previousVolume: number | null;
  wins: Win[];
  /** Days the protein target was met, or null when there is no target. */
  proteinDaysHit: number | null;
}

export function mondayOf(dateKey: string): string {
  const day = new Date(`${dateKey}T00:00:00`).getDay(); // 0 = Sunday
  return shiftDateKey(dateKey, -((day + 6) % 7));
}

export function recapWeekStart(today: string): { weekStart: string; inProgress: boolean } {
  const isSunday = new Date(`${today}T00:00:00`).getDay() === 0;
  const thisMonday = mondayOf(today);
  return isSunday ? { weekStart: thisMonday, inProgress: true } : { weekStart: shiftDateKey(thisMonday, -7), inProgress: false };
}

export function buildWeeklyRecap(
  today: string,
  workouts: WorkoutEntry[],
  foods: FoodEntry[],
  wins: Win[],
  opts: { bodyweightLb: number | null; settings?: ExerciseSettingsData; proteinTargetG: number | null }
): WeeklyRecap {
  const { weekStart, inProgress } = recapWeekStart(today);
  const weekEnd = shiftDateKey(weekStart, 6);
  const inWeek = (d: string) => d >= weekStart && d <= weekEnd;
  const week = workouts.filter((e) => inWeek(e.dateKey));
  const previous = workouts.filter((e) => e.dateKey >= shiftDateKey(weekStart, -7) && e.dateKey < weekStart);
  const volOpts = { bodyweightLb: opts.bodyweightLb, settings: opts.settings };
  const summary = workoutSummary(week, volOpts);
  const days = Array.from({ length: 7 }, (_, i) => shiftDateKey(weekStart, i));
  const trainedDates = new Set(week.map((e) => e.dateKey));

  let proteinDaysHit: number | null = null;
  if (opts.proteinTargetG && opts.proteinTargetG > 0) {
    const byDay = new Map<string, number>();
    for (const f of foods) if (inWeek(f.dateKey)) byDay.set(f.dateKey, (byDay.get(f.dateKey) ?? 0) + f.proteinG);
    proteinDaysHit = Array.from(byDay.values()).filter((g) => g >= opts.proteinTargetG!).length;
  }

  return {
    weekStart,
    weekEnd,
    inProgress,
    trained: days.map((d) => trainedDates.has(d)),
    daysTrained: trainedDates.size,
    setCount: summary.setCount,
    volume: summary.totalVolume,
    previousVolume: previous.length > 0 ? workoutSummary(previous, volOpts).totalVolume : null,
    wins: wins.filter((w) => inWeek(w.dateKey)),
    proteinDaysHit,
  };
}

/** Plain-text version of the recap, for the Copy button. */
export function formatRecapText(recap: WeeklyRecap): string {
  const lines = [
    `${recap.inProgress ? "This week" : "Last week"}: ${recap.weekStart} to ${recap.weekEnd}`,
    `Days trained: ${recap.daysTrained}/7 (${recap.trained.map((t, i) => (t ? "MTWTFSS"[i] : "-")).join("")})`,
    `Sets: ${recap.setCount}`,
    `Volume: ${recap.volume.toLocaleString()} lb${recap.previousVolume != null ? ` (week before: ${recap.previousVolume.toLocaleString()} lb)` : ""}`,
  ];
  if (recap.proteinDaysHit != null) lines.push(`Protein target hit: ${recap.proteinDaysHit}/7 days`);
  for (const w of recap.wins) lines.push(`${w.emoji} ${w.title}: ${w.detail}`);
  return lines.join("\n");
}
