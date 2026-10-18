// Sample workout history for the Muscles "Preview with sample data" button only
// (never real data). It is built as two snapshots about 30 days apart: a
// "before" block (logged 35-65 days ago) and an "after" block (logged in the
// last ~25 days), with the same lifts in both so the comparison shows real
// deltas: strength gains, one pulling muscle that has gone stale, and a couple
// of lifts that only appear in the second block (shown as "new exercise").
// Calves are never logged and stay unrated.
import { WorkoutEntry } from "./types";
import { shiftDateKey } from "./date";

function entry(
  id: string,
  daysAgo: number,
  todayKey: string,
  exerciseName: string,
  sets: { reps: number; weight: number }[],
  bodyweight?: boolean
): WorkoutEntry {
  const dateKey = shiftDateKey(todayKey, -daysAgo);
  return {
    id,
    dateKey,
    timestamp: new Date(`${dateKey}T12:00:00`).getTime(),
    exerciseName,
    muscleGroups: [],
    sets,
    bodyweight,
  };
}

export function buildMuscleSeedData(todayKey: string): WorkoutEntry[] {
  const e = (id: string, daysAgo: number, name: string, sets: { reps: number; weight: number }[], bw?: boolean) =>
    entry(id, daysAgo, todayKey, name, sets, bw);

  return [
    // Chest: same press in both blocks, climbing.
    e("s1", 63, "DB Bench Press", [{ reps: 5, weight: 60 }, { reps: 5, weight: 60 }]),
    e("s2", 49, "DB Bench Press", [{ reps: 5, weight: 65 }, { reps: 5, weight: 65 }]),
    e("s3", 36, "DB Bench Press", [{ reps: 5, weight: 70 }, { reps: 5, weight: 70 }]),
    e("s4", 18, "DB Bench Press", [{ reps: 5, weight: 75 }, { reps: 5, weight: 75 }]),
    e("s5", 4, "DB Bench Press", [{ reps: 5, weight: 80 }, { reps: 5, weight: 80 }]),
    e("s6", 36, "Incline DB Press", [{ reps: 8, weight: 50 }, { reps: 8, weight: 50 }]),
    e("s7", 4, "Incline DB Press", [{ reps: 8, weight: 55 }, { reps: 8, weight: 55 }]),

    // Back/lats: trained in the first block only, so they have gone stale since (decay).
    e("s8", 64, "Pull Up", [{ reps: 8, weight: 0 }, { reps: 7, weight: 0 }], true),
    e("s9", 50, "Pull Up", [{ reps: 9, weight: 10 }, { reps: 8, weight: 10 }], true),
    e("s10", 37, "Lat Pulldown", [{ reps: 8, weight: 130 }, { reps: 8, weight: 130 }]),
    e("s11", 37, "Seated Cable Row", [{ reps: 10, weight: 110 }]),

    // Quads/glutes: steady progression on the same squat.
    e("s14", 62, "Back Squat", [{ reps: 5, weight: 165 }, { reps: 5, weight: 165 }]),
    e("s15", 48, "Back Squat", [{ reps: 5, weight: 175 }, { reps: 5, weight: 175 }]),
    e("s16", 35, "Back Squat", [{ reps: 5, weight: 185 }, { reps: 5, weight: 185 }]),
    e("s17", 20, "Back Squat", [{ reps: 5, weight: 195 }, { reps: 5, weight: 195 }]),
    e("s18", 3, "Back Squat", [{ reps: 5, weight: 205 }, { reps: 5, weight: 205 }]),
    e("s19", 11, "Goblet Squat", [{ reps: 10, weight: 50 }]),

    // Hamstrings/lower back: hinge work in both blocks.
    e("s20", 61, "Trap Bar Deadlift", [{ reps: 5, weight: 205 }, { reps: 5, weight: 205 }]),
    e("s21", 47, "Trap Bar Deadlift", [{ reps: 5, weight: 215 }, { reps: 5, weight: 215 }]),
    e("s22", 34, "Trap Bar Deadlift", [{ reps: 5, weight: 225 }, { reps: 5, weight: 225 }]),
    e("s23", 4, "Trap Bar Deadlift", [{ reps: 5, weight: 245 }, { reps: 5, weight: 245 }]),
    e("s24", 40, "Romanian Deadlift", [{ reps: 8, weight: 85 }]),
    e("s25", 11, "Romanian Deadlift", [{ reps: 8, weight: 105 }]),

    // Shoulders: lateral raises in both blocks; face pulls in both.
    e("s26", 62, "Lateral Raise", [{ reps: 12, weight: 12.5 }, { reps: 12, weight: 12.5 }]),
    e("s27", 48, "Lateral Raise", [{ reps: 12, weight: 15 }, { reps: 12, weight: 15 }]),
    e("s28", 35, "Lateral Raise", [{ reps: 12, weight: 15 }]),
    e("s29", 9, "Lateral Raise", [{ reps: 12, weight: 17.5 }, { reps: 12, weight: 17.5 }]),
    e("s30", 2, "Lateral Raise", [{ reps: 12, weight: 17.5 }]),
    e("s31", 35, "Cable Face Pulls w/ External Rotation", [{ reps: 15, weight: 35 }]),
    e("s32", 9, "Cable Face Pulls w/ External Rotation", [{ reps: 15, weight: 40 }]),

    // Biceps: a curl that only shows up in the second block ("new exercise").
    e("s33", 14, "Barbell Curl", [{ reps: 8, weight: 65 }, { reps: 8, weight: 65 }]),
    e("s34", 6, "Barbell Curl", [{ reps: 8, weight: 70 }, { reps: 8, weight: 70 }]),

    // Abs/obliques: consistency-scored, in both blocks.
    e("s35", 62, "Pallof Press", [{ reps: 12, weight: 20 }]),
    e("s36", 37, "Half-Kneeling Pallof Press", [{ reps: 10, weight: 20 }]),
    e("s37", 23, "Pallof Press", [{ reps: 12, weight: 25 }]),
    e("s38", 16, "Half-Kneeling Pallof Press", [{ reps: 10, weight: 25 }]),
    e("s39", 9, "Standing Cable Woodchopper (High-to-Low)", [{ reps: 10, weight: 30 }]),
    e("s40", 38, "Captain's Chair Knee Raises", [{ reps: 10, weight: 0 }], true),
    e("s41", 2, "Captain's Chair Knee Raises", [{ reps: 12, weight: 0 }], true),

    // Forearms/traps: minimal exposure.
    e("s42", 14, "Farmer Carry", [{ reps: 1, weight: 60 }]),
  ];
}
