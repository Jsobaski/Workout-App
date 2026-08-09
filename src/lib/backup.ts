import { blobToBase64 } from "./image";
import {
  getCoachingContext,
  listAllFoodEntries,
  listAllGolfActivityEntries,
  listAllMeasurementEntries,
  listAllWorkoutEntries,
  saveCoachingContext,
  saveFoodEntry,
  saveGolfActivityEntry,
  saveMeasurementEntry,
  saveWorkoutEntry,
} from "./db";
import {
  BodyMeasurementEntry,
  CoachingContext,
  FoodEntry,
  GolfActivityEntry,
  WorkoutEntry,
} from "./types";

interface BackupFoodEntry extends Omit<FoodEntry, "photoThumbnail"> {
  photoThumbnail?: { dataUrl: string; type: string };
}

export interface BackupData {
  version: 1 | 2;
  exportedAt: string;
  foodEntries: BackupFoodEntry[];
  workoutEntries: WorkoutEntry[];
  golfActivityEntries?: GolfActivityEntry[];
  measurementEntries?: BodyMeasurementEntry[];
  coachingContext: CoachingContext;
}

export async function buildBackup(): Promise<BackupData> {
  const [foodEntries, workoutEntries, golfActivityEntries, measurementEntries, coachingContext] =
    await Promise.all([
      listAllFoodEntries(),
      listAllWorkoutEntries(),
      listAllGolfActivityEntries(),
      listAllMeasurementEntries(),
      getCoachingContext(),
    ]);

  const foodWithPhotos: BackupFoodEntry[] = await Promise.all(
    foodEntries.map(async (entry) => {
      const { photoThumbnail, ...rest } = entry;
      if (!photoThumbnail) return rest;
      const dataUrl = await blobToBase64(photoThumbnail);
      return {
        ...rest,
        photoThumbnail: { dataUrl, type: photoThumbnail.type || "image/jpeg" },
      };
    })
  );

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    foodEntries: foodWithPhotos,
    workoutEntries,
    golfActivityEntries,
    measurementEntries,
    coachingContext,
  };
}

export function downloadBackup(data: BackupData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `golf-fitness-tracker-backup-${data.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function base64ToBlob(dataUrl: string, type: string): Blob {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function restoreBackup(
  data: BackupData
): Promise<{
  foodCount: number;
  workoutCount: number;
  golfActivityCount: number;
  measurementCount: number;
}> {
  if (!data || (data.version !== 1 && data.version !== 2)) {
    throw new Error("Unrecognized backup file — expected a Golf Fitness Tracker export.");
  }

  for (const entry of data.foodEntries ?? []) {
    const { photoThumbnail, ...rest } = entry;
    await saveFoodEntry({
      ...rest,
      photoThumbnail: photoThumbnail
        ? base64ToBlob(photoThumbnail.dataUrl, photoThumbnail.type)
        : undefined,
    });
  }

  for (const entry of data.workoutEntries ?? []) {
    await saveWorkoutEntry(entry);
  }

  // Absent entirely in version-1 exports (feature didn't exist yet) — that's
  // fine, the loops just no-op.
  for (const entry of data.golfActivityEntries ?? []) {
    await saveGolfActivityEntry(entry);
  }

  for (const entry of data.measurementEntries ?? []) {
    await saveMeasurementEntry(entry);
  }

  if (data.coachingContext) {
    await saveCoachingContext(data.coachingContext);
  }

  return {
    foodCount: data.foodEntries?.length ?? 0,
    workoutCount: data.workoutEntries?.length ?? 0,
    golfActivityCount: data.golfActivityEntries?.length ?? 0,
    measurementCount: data.measurementEntries?.length ?? 0,
  };
}
