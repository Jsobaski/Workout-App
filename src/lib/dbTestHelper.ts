// Test-only helper: a brand-new in-memory IndexedDB per call, with fresh copies
// of the modules that talk to it (db.ts keeps a module-level connection).
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { vi } from "vitest";

export async function freshDatabase() {
  vi.resetModules();
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  const db = await import("./db");
  const migration = await import("./migrationService");
  return { db, migration };
}

export function workout(id: string, dateKey: string, exerciseName: string, reps = 8, weight = 50) {
  return {
    id,
    dateKey,
    timestamp: Date.parse(`${dateKey}T12:00:00`),
    exerciseName,
    muscleGroups: [] as string[],
    sets: [{ reps, weight }],
  };
}
