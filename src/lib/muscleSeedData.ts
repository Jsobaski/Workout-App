// Sample workout history for visual testing of the Muscles tab before real
// logs exist. Deliberately spans a mix of tiers, a stale muscle (pull day
// logged ~20 days back), fully untouched muscles (calves — stays unrated
// gray, not "Needs Work"), and volumeOnly-driven core work.
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
    // Chest/triceps/front delts — strong, recent, progressive overload.
    e("s1", 60, "DB Bench Press", [{ reps: 5, weight: 60 }, { reps: 5, weight: 60 }]),
    e("s2", 46, "DB Bench Press", [{ reps: 5, weight: 65 }, { reps: 5, weight: 65 }]),
    e("s3", 32, "DB Bench Press", [{ reps: 5, weight: 70 }, { reps: 5, weight: 70 }]),
    e("s4", 18, "DB Bench Press", [{ reps: 5, weight: 75 }, { reps: 5, weight: 75 }]),
    e("s5", 4, "DB Bench Press", [{ reps: 5, weight: 80 }, { reps: 5, weight: 80 }]),
    e("s6", 4, "Incline DB Press", [{ reps: 8, weight: 55 }, { reps: 8, weight: 55 }]),
    e("s7", 18, "Incline DB Press", [{ reps: 8, weight: 50 }]),

    // Back/lats/biceps — decent peak, but nothing logged in ~20 days (stale).
    e("s8", 35, "Pull Up", [{ reps: 8, weight: 0 }, { reps: 7, weight: 0 }], true),
    e("s9", 28, "Pull Up", [{ reps: 9, weight: 10 }, { reps: 8, weight: 10 }], true),
    e("s10", 21, "Lat Pulldown", [{ reps: 8, weight: 140 }, { reps: 8, weight: 140 }]),
    e("s11", 21, "Seated Cable Row", [{ reps: 10, weight: 120 }]),

    // Quads/glutes — mid-range, moderately fresh.
    e("s12", 25, "Back Squat", [{ reps: 5, weight: 185 }, { reps: 5, weight: 185 }]),
    e("s13", 11, "Goblet Squat", [{ reps: 10, weight: 50 }]),
    e("s14", 3, "Back Squat", [{ reps: 5, weight: 195 }, { reps: 5, weight: 195 }]),

    // Hamstrings — light secondary work only, low tier.
    e("s15", 11, "Romanian Deadlift", [{ reps: 8, weight: 95 }]),

    // Shoulders — side/rear delts developing.
    e("s16", 9, "Lateral Raise", [{ reps: 12, weight: 15 }, { reps: 12, weight: 15 }]),
    e("s17", 2, "Lateral Raise", [{ reps: 12, weight: 17.5 }]),
    e("s18", 9, "Cable Face Pulls w/ External Rotation", [{ reps: 15, weight: 40 }]),

    // Obliques/abs — volumeOnly, but trained consistently (decent score from consistency alone).
    e("s19", 23, "Pallof Press", [{ reps: 12, weight: 25 }]),
    e("s20", 16, "Half-Kneeling Pallof Press", [{ reps: 10, weight: 25 }]),
    e("s21", 9, "Standing Cable Woodchopper (High-to-Low)", [{ reps: 10, weight: 30 }]),
    e("s22", 2, "Captain's Chair Knee Raises", [{ reps: 12, weight: 0 }], true),

    // Forearms/traps — minimal, secondary-only exposure.
    e("s23", 14, "Farmer Carry", [{ reps: 1, weight: 60 }]),

    // Lower back — secondary from deadlift.
    e("s24", 25, "Trap Bar Deadlift", [{ reps: 5, weight: 225 }, { reps: 5, weight: 225 }]),
    e("s25", 4, "Trap Bar Deadlift", [{ reps: 5, weight: 235 }]),

    // Calves — intentionally never logged, stays unrated gray.
  ];
}
