// What goes on a shareable card (today's workout or the weekly recap). Pure: the model is plain data
// that shareCardCanvas.ts draws, so the content is unit-tested without a canvas.
import { formatDisplayDate } from "./date";
import { summarizeSets } from "./exerciseHistory";
import { WeeklyRecap } from "./recap";
import { WorkoutEntry } from "./types";

export interface ShareCardModel {
  title: string;
  subtitle: string;
  stats: { label: string; value: string }[];
  /** Seven Monday-first flags for the recap card's day dots. */
  days?: boolean[];
  rows: { primary: string; secondary?: string; tag?: string }[];
  /** Extra items that didn't fit. */
  moreCount: number;
  footer: string;
  /** Optional emoji strip (the active holiday's items). */
  emojis?: string[];
}

export const MAX_CARD_ROWS = 9;
export const CARD_FOOTER = "Golf Fitness Tracker";

const short = (dateKey: string) => formatDisplayDate(dateKey).replace(/^\w+, /, "");

export function buildWorkoutCardModel(
  dateKey: string,
  entries: WorkoutEntry[],
  summary: { totalVolume: number; setCount: number },
  emojis?: string[]
): ShareCardModel {
  const rows = entries.slice(0, MAX_CARD_ROWS).map((e) => ({
    primary: e.exerciseName,
    secondary: summarizeSets(e.sets, { timed: !!e.timed, bodyweight: !!e.bodyweight, banded: !!e.banded }),
    tag: e.supersetId ? "Superset" : undefined,
  }));
  return {
    title: "Workout",
    subtitle: formatDisplayDate(dateKey),
    stats: [
      { label: "Exercises", value: String(entries.length) },
      { label: "Sets", value: String(summary.setCount) },
      { label: "Volume", value: `${summary.totalVolume.toLocaleString()} lb` },
    ],
    rows,
    moreCount: Math.max(0, entries.length - rows.length),
    footer: CARD_FOOTER,
    emojis,
  };
}

export function buildRecapCardModel(recap: WeeklyRecap, emojis?: string[]): ShareCardModel {
  const prs = recap.wins.filter((w) => w.kind === "pr");
  const others = recap.wins.filter((w) => w.kind !== "pr");
  const ordered = [...prs, ...others];
  const rows = ordered.slice(0, MAX_CARD_ROWS).map((w) => ({ primary: `${w.emoji} ${w.title}`, secondary: w.detail }));
  const change =
    recap.previousVolume != null && recap.previousVolume > 0
      ? Math.round(((recap.volume - recap.previousVolume) / recap.previousVolume) * 100)
      : null;
  const stats = [
    { label: "Days trained", value: `${recap.daysTrained} / 7` },
    { label: "Sets", value: String(recap.setCount) },
    { label: "Volume", value: `${recap.volume.toLocaleString()} lb${change == null ? "" : ` (${change >= 0 ? "+" : ""}${change}%)`}` },
  ];
  if (recap.proteinDaysHit != null) stats.push({ label: "Protein days", value: `${recap.proteinDaysHit} / 7` });
  return {
    title: recap.inProgress ? "This week" : "Last week",
    subtitle: `${short(recap.weekStart)} to ${short(recap.weekEnd)}`,
    stats,
    days: recap.trained,
    rows,
    moreCount: Math.max(0, ordered.length - rows.length),
    footer: CARD_FOOTER,
    emojis,
  };
}
