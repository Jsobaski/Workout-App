import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  CoachingContext,
  DEFAULT_COACHING_CONTEXT,
  FoodEntry,
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
  settings: {
    key: string;
    value: CoachingContext;
  };
}

const DB_NAME = "golf-fitness-tracker";
const DB_VERSION = 1;

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
