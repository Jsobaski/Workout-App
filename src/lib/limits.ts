// Per-exercise limits like "2x10" (sets x reps). Suggestions never go beyond them.

export interface ParsedLimit {
  sets: number;
  reps: number;
}

export function parseLimit(text: string | undefined | null): ParsedLimit | null {
  if (!text) return null;
  const match = text.match(/(\d+)\s*[x×*]\s*(\d+)/i);
  if (!match) return null;
  const sets = Number(match[1]);
  const reps = Number(match[2]);
  return sets > 0 && reps > 0 ? { sets, reps } : null;
}

/** Caps a suggested sets/reps at the limit. Unparseable limits are ignored (nothing to enforce). */
export function clampToLimit<T extends { sets: number; reps: number }>(
  suggestion: T,
  limitText: string | undefined | null
): T & { clamped: boolean } {
  const limit = parseLimit(limitText);
  if (!limit) return { ...suggestion, clamped: false };
  const sets = Math.min(suggestion.sets, limit.sets);
  const reps = Math.min(suggestion.reps, limit.reps);
  return { ...suggestion, sets, reps, clamped: sets !== suggestion.sets || reps !== suggestion.reps };
}
