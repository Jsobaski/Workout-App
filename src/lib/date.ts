import { format, addDays, parseISO } from "date-fns";

// Local-timezone calendar day key, e.g. "2026-08-01". Day boundary is
// midnight-to-midnight in the browser's local timezone, not a rolling 24h.
export function dateKeyFor(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function todayKey(): string {
  return dateKeyFor(new Date());
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const d = parseISO(dateKey);
  return dateKeyFor(addDays(d, deltaDays));
}

export function dateKeysInRange(startKey: string, days: number): string[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    keys.push(shiftDateKey(startKey, -i));
  }
  return keys;
}

export function formatDisplayDate(dateKey: string): string {
  return format(parseISO(dateKey), "EEEE, MMMM d, yyyy");
}

export function formatShortDate(dateKey: string): string {
  return format(parseISO(dateKey), "MMM d");
}

export function formatTime(timestamp: number): string {
  return format(new Date(timestamp), "h:mm a");
}
