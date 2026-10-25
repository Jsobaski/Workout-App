// Logging several movements as one superset: each movement is saved as its own workout
// entry (so scoring, history and PRs are unchanged), tied together by a shared supersetId.
import { inferMuscleGroups } from "./muscleGroups";
import { SetEntry, WorkoutEntry } from "./types";

export interface MovementInput {
  name: string;
  sets: SetEntry[];
  bodyweight: boolean;
  timed: boolean;
  banded: boolean;
  notes: string;
}

/**
 * One entry per named movement, in order. Two or more share a supersetId; a single
 * movement is an ordinary entry. Timestamps step by a millisecond so the order is kept.
 */
export function buildEntries(
  movements: MovementInput[],
  now: number,
  newId: () => string
): Omit<WorkoutEntry, "id" | "dateKey">[] {
  const named = movements.filter((m) => m.name.trim() !== "");
  const supersetId = named.length > 1 ? newId() : undefined;
  return named.map((m, i) => ({
    timestamp: now + i,
    exerciseName: m.name.trim(),
    muscleGroups: inferMuscleGroups(m.name.trim()),
    sets: m.sets,
    bodyweight: m.bodyweight || undefined,
    timed: m.timed || undefined,
    banded: m.banded || undefined,
    notes: m.notes.trim() || undefined,
    ...(supersetId ? { supersetId } : {}),
  }));
}

/** Position of an entry inside its superset run, for labelling ("Superset 1/2"); null for a normal entry. */
export function supersetPosition(entries: WorkoutEntry[], index: number): { position: number; total: number } | null {
  const id = entries[index]?.supersetId;
  if (!id) return null;
  const members = entries.filter((e) => e.supersetId === id);
  if (members.length < 2) return null;
  return { position: members.findIndex((e) => e === entries[index]) + 1, total: members.length };
}
