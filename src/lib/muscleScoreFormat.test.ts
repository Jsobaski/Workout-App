import { describe, expect, it } from "vitest";
import { tierForScore } from "./muscleEngine";
import { formatScore, isNearTierBoundary } from "./muscleScoreFormat";

describe("tier classification and score display", () => {
  it("classifies on the unrounded score, so 59.6 is Solid even though it rounds to 60", () => {
    expect(Math.round(59.6)).toBe(60);
    expect(tierForScore(59.6).id).toBe("solid");
    expect(tierForScore(60).id).toBe("strong");
    expect(tierForScore(79.99).id).toBe("strong");
    expect(tierForScore(80).id).toBe("elite");
  });

  it("shows one decimal near a tier boundary and an integer elsewhere", () => {
    expect(formatScore(59.6)).toBe("59.6");
    expect(formatScore(60.2)).toBe("60.2");
    expect(formatScore(39.7)).toBe("39.7");
    expect(formatScore(20.0)).toBe("20.0");
    expect(formatScore(45.4)).toBe("45");
    expect(formatScore(62)).toBe("62");
    expect(isNearTierBoundary(45.4)).toBe(false);
    expect(isNearTierBoundary(79.8)).toBe(true);
  });

  it("never displays a boundary value for a score that is still below it", () => {
    expect(formatScore(59.96)).toBe("59.9"); // truncated, not "60.0"
    expect(tierForScore(59.96).id).toBe("solid");
    expect(formatScore(79.99)).toBe("79.9");
    expect(formatScore(60.04)).toBe("60.0"); // at/above the boundary rounds normally
    expect(tierForScore(60.04).id).toBe("strong");
  });
});
