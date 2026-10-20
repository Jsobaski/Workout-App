import { describe, expect, it } from "vitest";
import { canonicalExerciseKey, lookupExerciseMapping } from "./exerciseMuscleMap";
import { exercisesForMuscle } from "./exerciseSuggestions";

// Exact exercise names from a real user bug report: these showed up in the
// "needs mapping" banner despite representing real training — either the
// old generic split placeholder names (Core/Curls/Woodchopper/Cable Tricep
// Work, from before the split was renamed to specific exercises) or real
// gym equipment/variant names that were never in the mapping table.
const userLoggedNames = [
  "Cable Face pulls",
  "Cable Tricep Work",
  "Captain chair knee raises",
  "Chest Press - Nautilus Machine",
  "Core",
  "Curls",
  "DB Overhead Tricep extension",
  "Deltoid raise machine",
  "Face Pulls",
  "Hoist preacher curl machine",
  "Lying Leg Curl",
  "Nautilus Angled Leg Press Plate Loaded",
  "Landmine Rotational Press",
  "Nautilus Impact Tricep Extension",
  "Nautilus Leverage Chest press",
  "Nautilus Leverage Incline Chest press",
  "Nautilus impact bicep curl",
  "Nautilus impact rear deltoid machine",
  "Romanian Deadlift straight bar",
  "Shoulder Press machine",
  "Single Arm Cable Tricep Extension",
  "Standing Cable Woodchoppers (high to low)",
  "Standing Calf",
  "Straight Bar Tricep Pushdown",
  "Woodchopper",
];

describe("real-world unmapped names from user report", () => {
  for (const name of userLoggedNames) {
    it(`resolves "${name}"`, () => {
      expect(lookupExerciseMapping(name)).not.toBeNull();
    });
  }
});

describe("legacy split placeholder names", () => {
  it("scores but never gets suggested as a new exercise to do", () => {
    const suggestions = exercisesForMuscle("abs", 10);
    expect(suggestions).not.toContain("Core");
    expect(suggestions).not.toContain("Woodchopper");
  });

  it("the apostrophe-free and apostrophe'd Captain's Chair variants both resolve", () => {
    expect(lookupExerciseMapping("Captain's Chair Knee Raises")).not.toBeNull();
    expect(lookupExerciseMapping("Captain chair knee raises")).not.toBeNull();
  });
});

describe("glute medius / hip stability exercises", () => {
  const glutesMedExercises = [
    "Side-Lying Hip Abduction",
    "Banded Lateral Walks",
    "Clamshells with Band",
    "Single-Leg Romanian Deadlift",
    "Side Plank with Leg Raise",
    "Step-Ups",
    "Cable Hip Abduction",
    "Reverse Clamshells",
    "Leg Bridge",
    "Single Leg Bridge",
    "Single Leg Bridges",
  ];

  for (const name of glutesMedExercises) {
    it(`resolves "${name}" and contributes to glutes`, () => {
      const mapping = lookupExerciseMapping(name);
      expect(mapping).not.toBeNull();
      expect(mapping!.muscles.some((m) => m.group === "glutes")).toBe(true);
    });
  }

  it("suggests glute-med work for the glutes muscle group", () => {
    const suggestions = exercisesForMuscle("glutes", 10);
    expect(suggestions.length).toBeGreaterThan(0);
  });
});

describe("back extensions", () => {
  for (const name of ["Back Extension", "Back Extensions"]) {
    it(`resolves "${name}" to lower back`, () => {
      const mapping = lookupExerciseMapping(name);
      expect(mapping).not.toBeNull();
      expect(mapping!.muscles.find((m) => m.group === "lowerBack")?.weight).toBe(1.0);
    });
  }
});

describe("leg curl and angled leg press", () => {
  it("Lying Leg Curl trains hamstrings (primary), and the plate-loaded angled leg press is a Leg Press", () => {
    const curl = lookupExerciseMapping("Lying Leg Curl")!;
    expect(curl.muscles.find((m) => m.group === "hamstrings")!.weight).toBe(1);
    expect(canonicalExerciseKey("Nautilus Angled Leg Press Plate Loaded")).toBe("leg press");
    expect(lookupExerciseMapping("Nautilus Angled Leg Press Plate Loaded")!.muscles.find((m) => m.group === "quads")!.weight).toBe(1);
    expect(exercisesForMuscle("hamstrings", 20)).toContain("Lying Leg Curl");
  });
});

describe("exercises added from the user's checklist", () => {
  const primaryOf = (name: string) => lookupExerciseMapping(name)!.muscles.filter((m) => m.weight >= 1).map((m) => m.group).sort();
  const cases: [string, string[]][] = [
    ["Seated Leg Curl", ["hamstrings"]], ["Standing Leg Curl", ["hamstrings"]], ["Hack Squat", ["quads"]],
    ["Good Morning", ["hamstrings", "lowerBack"]], ["Forward Lunge", ["glutes", "quads"]], ["Hip Abduction Machine", ["glutes"]],
    ["Cable Glute Kickback", ["glutes"]], ["Frog Pump", ["glutes"]], ["Seated Calf Raise", ["calves"]], ["Sled Push", ["glutes", "quads"]],
    ["Nordic Curl", ["hamstrings"]], ["Incline Barbell Bench", ["frontDelts", "upperChest"]], ["Decline Bench", ["midLowerChest"]],
    ["Close-Grip Bench", ["triceps"]], ["Dumbbell Fly", ["midLowerChest"]], ["Cable Fly", ["midLowerChest"]],
    ["Pec Deck (Machine Fly)", ["midLowerChest"]], ["Shrugs", ["traps"]], ["T-Bar Row", ["upperBack"]],
    ["One-Arm Dumbbell Row", ["upperBack"]], ["Chest-Supported Row", ["upperBack"]], ["Rear Delt Fly (Reverse Fly)", ["sideRearDelts"]],
    ["Arnold Press", ["frontDelts"]], ["EZ-Bar Curl", ["biceps"]], ["Barbell Curl", ["biceps"]], ["Cable Curl", ["biceps"]],
    ["Concentration Curl", ["biceps"]], ["Rope Overhead Tricep Extension", ["triceps"]], ["Tricep Kickback", ["triceps"]],
    ["Bench Dips", ["triceps"]], ["Close-Grip Push-Up", ["triceps"]], ["Crunch", ["abs"]], ["Cable Crunch", ["abs"]],
    ["Sit-Up", ["abs"]], ["Bicycle Crunch", ["abs"]], ["Ab Wheel Rollout", ["abs"]], ["Russian Twist", ["obliques"]],
    ["Side Plank", ["obliques"]], ["Bird Dog", ["lowerBack"]], ["Kettlebell Swing", ["glutes", "hamstrings"]],
    ["Battle Ropes", ["forearms", "frontDelts"]], ["Wide-Grip Pulldown", ["lats"]],
  ];
  for (const [name, primary] of cases) {
    it(`maps "${name}" to ${primary.join(" + ")}`, () => {
      expect(lookupExerciseMapping(name), name).not.toBeNull();
      expect(primaryOf(name)).toEqual(primary);
    });
  }

  it("Hip Adduction Machine and Pullover only give incidental credit (adductors aren't tracked; pulldown owns lats)", () => {
    expect(primaryOf("Hip Adduction Machine")).toEqual([]);
    expect(primaryOf("Pullover")).toEqual([]);
  });

  it("variants resolve to the same exercise", () => {
    for (const [alias, canon] of [["Wide-Grip Pulldown", "lat pulldown"], ["Pec Deck (Machine Fly)", "pec deck"], ["Reverse Fly", "rear delt fly"], ["lunges", "forward lunge"], ["EZ Curl", "ez-bar curl"], ["Sit-ups", "sit-up"]]) {
      expect(canonicalExerciseKey(alias), alias).toBe(canon);
    }
  });

  it("movement-pattern tags are on the new hinge, rotation, split-stance and squat exercises", () => {
    const tags = (n: string) => lookupExerciseMapping(n)!.patterns ?? [];
    expect(tags("Good Morning")).toContain("hip_hinge");
    expect(tags("Kettlebell Swing")).toContain("hip_hinge");
    expect(tags("Russian Twist")).toContain("rotation");
    expect(tags("Forward Lunge")).toContain("split_stance");
    expect(tags("Hack Squat")).toContain("squat");
  });
});
