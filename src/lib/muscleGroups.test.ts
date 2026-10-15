import { describe, expect, it } from "vitest";
import { inferMuscleGroups } from "./muscleGroups";

describe("inferMuscleGroups", () => {
  it("doesn't tag Back/Biceps for 'Lateral' just because it contains 'lat'", () => {
    // Real bug: the unanchored "lat" keyword (meant for Lat Pulldown) also
    // matched inside "Lateral", mistagging Banded Lateral Walks as Back/Biceps.
    const groups = inferMuscleGroups("Banded Lateral Walks");
    expect(groups).not.toContain("Back");
    expect(groups).not.toContain("Biceps");
    expect(groups).toContain("Glutes");
  });

  it("still tags real lat exercises as Back/Biceps", () => {
    expect(inferMuscleGroups("Lat Pulldown")).toEqual(expect.arrayContaining(["Back", "Biceps"]));
    expect(inferMuscleGroups("Lats")).toEqual(expect.arrayContaining(["Back", "Biceps"]));
  });

  it("doesn't false-positive on other words containing 'lat'", () => {
    for (const name of ["Lateral Raise", "Isolateral Press", "Inflatable Ball Exercise"]) {
      expect(inferMuscleGroups(name)).not.toContain("Back");
    }
  });

  it("tags the new glute medius / hip stability exercises as Glutes", () => {
    for (const name of [
      "Side-Lying Hip Abduction",
      "Clamshells with Band",
      "Cable Hip Abduction",
      "Standing Hip Abduction",
      "Reverse Clamshells",
      "Leg Bridge",
      "Single Leg Bridge",
    ]) {
      expect(inferMuscleGroups(name)).toContain("Glutes");
    }
  });
});
