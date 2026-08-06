import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  CoachingContext,
  DEFAULT_COACHING_CONTEXT,
  FoodEntry,
  GolfActivityEntry,
  WorkoutEntry,
} from "./types";

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
  settings: {
    key: string;
    value: CoachingContext;
  };
}

const DB_NAME = "golf-fitness-tracker";
const DB_VERSION = 2;

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

// ---- Coaching context / settings ----

export async function getCoachingContext(): Promise<CoachingContext> {
  const db = await getDB();
  const existing = await db.get("settings", "coachingContext");
  return existing ?? DEFAULT_COACHING_CONTEXT;
}

export async function saveCoachingContext(
  context: CoachingContext
): Promise<void> {
  const db = await getDB();
  await db.put("settings", context);
}
