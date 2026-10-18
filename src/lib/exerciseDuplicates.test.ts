import { describe, expect, it } from "vitest";
import { findDuplicateGroups, nameKey } from "./exerciseDuplicates";

const n = (name: string, count = 1) => ({ name, count });

describe("duplicate exercise suggestions", () => {
  it("groups names that differ only by case, spacing, punctuation or plural", () => {
    const groups = findDuplicateGroups([n("Lat Pulldown", 5), n("lat pull down", 2), n("Lat Pulldowns"), n("Bench Press", 3)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].names.map((x) => x.name).sort()).toEqual(["Lat Pulldown", "Lat Pulldowns", "lat pull down"]);
    expect(groups[0].suggestedTarget).toBe("Lat Pulldown");
    expect(groups[0].reason).toBe("same-spelling");
  });

  it("groups different names that are the same library exercise, preferring the library's name", () => {
    const groups = findDuplicateGroups([n("Standing Calf", 4), n("Calf Raise", 2), n("Back Squat", 3)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].reason).toBe("same-library-exercise");
    expect(groups[0].suggestedTarget).toBe("Calf Raise");
  });

  it("suggests near-identical spellings (a typo) but not short or unrelated names", () => {
    const groups = findDuplicateGroups([n("Romanian Deadlift", 6), n("Romanian Deadlifft", 1), n("Plank", 3), n("Plant", 1), n("Bench Press"), n("Barbell Row")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].names.map((x) => x.name)).toEqual(["Romanian Deadlift", "Romanian Deadlifft"]); // most-used first
    expect(groups[0].reason).toBe("near-identical");
  });

  it("returns nothing when there are no likely duplicates, and never merges on its own", () => {
    expect(findDuplicateGroups([n("Bench Press"), n("Barbell Row"), n("Plank")])).toEqual([]);
    expect(findDuplicateGroups([])).toEqual([]);
  });

  it("normalizes spacing, plurals and dumbbell/DB", () => {
    expect(nameKey("DB Bench Press")).toBe(nameKey("Dumbbell Bench Presses"));
    expect(nameKey("Captain's Chair Knee Raises")).toBe(nameKey("captains chair knee raise"));
  });
});
