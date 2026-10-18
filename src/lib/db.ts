import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  BodyMeasurementEntry,
  CoachingContext,
  DEFAULT_COACHING_CONTEXT,
  FoodEntry,
  GolfActivityEntry,
  WorkoutEntry,
} from "./types";
import {
  ExerciseSettingsData,
  ExerciseSettingsRecord,
  emptyExerciseSettings,
  normalizeExerciseSettings,
} from "./exerciseSettings";
import type { MigrationChoice, MigrationsRecord } from "./neutralMigration";

interface GolfTrackerDB extends DBSchema {
  foodEntries: {
    key: string;
    value: FoodEntry;
    indexes: { dateKey: string; timestamp: number };
  };
  workoutEntries: {
    key: string;
    value: WorkoutEntry;
    indexes: { dateKey: string; timestamp: number; exerciseName: string };
  };
  golfActivityEntries: {
    key: string;
    value: GolfActivityEntry;
    indexes: { dateKey: string; timestamp: number };
  };
  measurementEntries: {
    key: string;
    value: BodyMeasurementEntry;
    indexes: { dateKey: string; timestamp: number };
  };
  settings: {
    key: string;
    value: CoachingContext | ExerciseSettingsRecord | MigrationsRecord;
  };
}

const DB_NAME = "golf-fitness-tracker";
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<GolfTrackerDB>> | null = null;

function getDB(): Promise<IDBPDatabase<GolfTrackerDB>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new Error("IndexedDB is not available in this environment")
    );
  }
  if (!dbPromise) {
    dbPromise = openDB<GolfTrackerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("foodEntries")) {
          const store = db.createObjectStore("foodEntries", {
            keyPath: "id",
          });
          store.createIndex("dateKey", "dateKey");
          store.createIndex("timestamp", "timestamp");
        }
        if (!db.objectStoreNames.contains("workoutEntries")) {
          const store = db.createObjectStore("workoutEntries", {
            keyPath: "id",
          });
          store.createIndex("dateKey", "dateKey");
          store.createIndex("timestamp", "timestamp");
          store.createIndex("exerciseName", "exerciseName");
        }
        if (!db.objectStoreNames.contains("golfActivityEntries")) {
          const store = db.createObjectStore("golfActivityEntries", {
            keyPath: "id",
          });
          store.createIndex("dateKey", "dateKey");
          store.createIndex("timestamp", "timestamp");
        }
        if (!db.objectStoreNames.contains("measurementEntries")) {
          const store = db.createObjectStore("measurementEntries", {
            keyPath: "id",
          });
          store.createIndex("dateKey", "dateKey");
          store.createIndex("timestamp", "timestamp");
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---- Food entries ----

export async function listFoodEntriesForDate(
  dateKey: string
): Promise<FoodEntry[]> {
  const db = await getDB();
  const entries = await db.getAllFromIndex("foodEntries", "dateKey", dateKey);
  return entries.sort((a, b) => a.timestamp - b.timestamp);
}

export async function listFoodEntriesInRange(
  dateKeys: string[]
): Promise<FoodEntry[]> {
  const db = await getDB();
  const all = await db.getAll("foodEntries");
  const keySet = new Set(dateKeys);
  return all.filter((e) => keySet.has(e.dateKey));
}

export async function saveFoodEntry(
  entry: Omit<FoodEntry, "id"> & { id?: string }
): Promise<FoodEntry> {
  const db = await getDB();
  const full: FoodEntry = { ...entry, id: entry.id ?? newId() };
  await db.put("foodEntries", full);
  return full;
}

export async function deleteFoodEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("foodEntries", id);
}

export async function listAllFoodEntries(): Promise<FoodEntry[]> {
  const db = await getDB();
  return db.getAll("foodEntries");
}

// One entry per distinct item name (the most recent occurrence, so its
// calories/protein reflect the last time it was logged), across all history
// — not just a recent window. Backs both the "Recent" quick-add chips
// (sliced short) and full-history autocomplete (used unsliced), so a food
// logged weeks ago still auto-fills instead of requiring re-entry.
export async function listAllDistinctFoodEntries(): Promise<FoodEntry[]> {
  const all = await listAllFoodEntries();
  const sorted = all.sort((a, b) => b.timestamp - a.timestamp);
  const seen = new Set<string>();
  const result: FoodEntry[] = [];
  for (const entry of sorted) {
    const key = entry.itemName.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

export async function listRecentDistinctFoodEntries(
  limit = 8
): Promise<FoodEntry[]> {
  const all = await listAllDistinctFoodEntries();
  return all.slice(0, limit);
}

// ---- Workout entries ----

export async function listWorkoutEntriesForDate(
  dateKey: string
): Promise<WorkoutEntry[]> {
  const db = await getDB();
  const entries = await db.getAllFromIndex(
    "workoutEntries",
    "dateKey",
    dateKey
  );
  return entries.sort((a, b) => a.timestamp - b.timestamp);
}

export async function listWorkoutEntriesInRange(
  dateKeys: string[]
): Promise<WorkoutEntry[]> {
  const db = await getDB();
  const all = await db.getAll("workoutEntries");
  const keySet = new Set(dateKeys);
  return all.filter((e) => keySet.has(e.dateKey));
}

export async function listAllWorkoutEntries(): Promise<WorkoutEntry[]> {
  const db = await getDB();
  return db.getAll("workoutEntries");
}

export async function saveWorkoutEntry(
  entry: Omit<WorkoutEntry, "id"> & { id?: string }
): Promise<WorkoutEntry> {
  const db = await getDB();
  const full: WorkoutEntry = { ...entry, id: entry.id ?? newId() };
  await db.put("workoutEntries", full);
  return full;
}

export async function deleteWorkoutEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("workoutEntries", id);
}

export async function listDistinctExerciseNames(): Promise<string[]> {
  const all = await listAllWorkoutEntries();
  const names = new Set(all.map((e) => e.exerciseName));
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

export async function findMostRecentWorkoutEntry(): Promise<WorkoutEntry | null> {
  const all = await listAllWorkoutEntries();
  if (all.length === 0) return null;
  return all.reduce((latest, e) => (e.timestamp > latest.timestamp ? e : latest));
}

export async function findLastWorkoutEntryForExercise(
  exerciseName: string
): Promise<WorkoutEntry | null> {
  const target = exerciseName.trim().toLowerCase();
  if (!target) return null;
  const all = await listAllWorkoutEntries();
  const matches = all
    .filter((e) => e.exerciseName.trim().toLowerCase() === target)
    .sort((a, b) => b.timestamp - a.timestamp);
  return matches[0] ?? null;
}

// ---- Golf activity entries ----

export async function listGolfActivityEntriesForDate(
  dateKey: string
): Promise<GolfActivityEntry[]> {
  const db = await getDB();
  const entries = await db.getAllFromIndex(
    "golfActivityEntries",
    "dateKey",
    dateKey
  );
  return entries.sort((a, b) => a.timestamp - b.timestamp);
}

export async function listAllGolfActivityEntries(): Promise<GolfActivityEntry[]> {
  const db = await getDB();
  return db.getAll("golfActivityEntries");
}

export async function saveGolfActivityEntry(
  entry: Omit<GolfActivityEntry, "id"> & { id?: string }
): Promise<GolfActivityEntry> {
  const db = await getDB();
  const full: GolfActivityEntry = { ...entry, id: entry.id ?? newId() };
  await db.put("golfActivityEntries", full);
  return full;
}

export async function deleteGolfActivityEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("golfActivityEntries", id);
}

// ---- Body measurement entries ----

export async function listAllMeasurementEntries(): Promise<BodyMeasurementEntry[]> {
  const db = await getDB();
  const all = await db.getAll("measurementEntries");
  return all.sort((a, b) => b.timestamp - a.timestamp);
}

export async function saveMeasurementEntry(
  entry: Omit<BodyMeasurementEntry, "id"> & { id?: string }
): Promise<BodyMeasurementEntry> {
  const db = await getDB();
  const full: BodyMeasurementEntry = { ...entry, id: entry.id ?? newId() };
  await db.put("measurementEntries", full);
  return full;
}

export async function deleteMeasurementEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("measurementEntries", id);
}

// ---- Coaching context / settings ----

export async function getCoachingContext(): Promise<CoachingContext> {
  const db = await getDB();
  const existing = (await db.get("settings", "coachingContext")) as CoachingContext | undefined;
  return existing ?? DEFAULT_COACHING_CONTEXT;
}

export async function saveCoachingContext(
  context: CoachingContext
): Promise<void> {
  const db = await getDB();
  await db.put("settings", context);
}

// ---- Exercise settings (local overrides, movement-pattern restrictions, priority muscles) ----

export async function getExerciseSettings(): Promise<ExerciseSettingsData> {
  const db = await getDB();
  const existing = (await db.get("settings", "exerciseSettings")) as ExerciseSettingsRecord | undefined;
  return existing ? normalizeExerciseSettings(existing) : emptyExerciseSettings();
}

export async function saveExerciseSettings(data: ExerciseSettingsData): Promise<void> {
  const db = await getDB();
  const record: ExerciseSettingsRecord = {
    key: "exerciseSettings",
    overrides: data.overrides,
    patterns: data.patterns,
    focusMuscles: data.focusMuscles,
  };
  await db.put("settings", record);
}

// ---- One-time migrations ----

export async function getNeutralMigrationChoice(): Promise<MigrationChoice | undefined> {
  const db = await getDB();
  const record = (await db.get("settings", "migrations")) as MigrationsRecord | undefined;
  return record?.neutralDefaultsV1;
}

export async function setNeutralMigrationChoice(choice: MigrationChoice): Promise<void> {
  const db = await getDB();
  const existing = (await db.get("settings", "migrations")) as MigrationsRecord | undefined;
  await db.put("settings", { ...existing, key: "migrations", neutralDefaultsV1: choice });
}

/** True when this device has any logged data (workouts, food, golf activity or measurements). */
export async function hasAnyLoggedData(): Promise<boolean> {
  const db = await getDB();
  const stores = ["workoutEntries", "foodEntries", "golfActivityEntries", "measurementEntries"] as const;
  for (const store of stores) {
    if ((await db.count(store)) > 0) return true;
  }
  return false;
}

export async function hasStoredCoachingContext(): Promise<boolean> {
  const db = await getDB();
  return (await db.get("settings", "coachingContext")) != null;
}

// ---- Exercise names ----

/** Distinct logged exercise names with how many entries use each. */
export async function listExerciseNameCounts(): Promise<{ name: string; count: number }[]> {
  const all = await listAllWorkoutEntries();
  const counts = new Map<string, number>();
  for (const e of all) counts.set(e.exerciseName, (counts.get(e.exerciseName) ?? 0) + 1);
  return Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Renames every logged entry whose exercise name is in `fromNames` to `toName`. Returns how many entries changed. */
export async function renameExerciseEntries(fromNames: string[], toName: string): Promise<number> {
  const target = toName.trim();
  if (!target) return 0;
  const from = new Set(fromNames);
  const db = await getDB();
  const tx = db.transaction("workoutEntries", "readwrite");
  let changed = 0;
  for (const entry of await tx.store.getAll()) {
    if (from.has(entry.exerciseName) && entry.exerciseName !== target) {
      await tx.store.put({ ...entry, exerciseName: target });
      changed++;
    }
  }
  await tx.done;
  return changed;
}
