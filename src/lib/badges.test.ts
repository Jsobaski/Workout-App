import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { BADGE_CATEGORIES, computeProgress, nextGoalHint } from "./badges";

const hint = (id: string, value: number, available = true) =>
  nextGoalHint(computeProgress(BADGE_CATEGORIES.find((c) => c.id === id)!, value, available));

describe("nextGoalHint", () => {
  it("shows the next reachable goal for a category at zero", () => {
    expect(hint("workouts", 0)).toBe("1 workout to your first badge");
    expect(hint("volume", 0)).toBe("10,000 lb of volume to your first badge");
    expect(hint("streak", 0)).toBe("1 week in a row to your first badge");
    expect(hint("consistency", 0)).toBe("4 workouts in a month to your first badge");
    expect(hint("golf", 0)).toBe("1 golf session to your first badge");
  });

  it("switches to 'next badge' once something is unlocked, and is null when complete or unavailable", () => {
    expect(hint("workouts", 3)).toBe("7 workouts to your next badge");
    expect(hint("workouts", 365)).toBeNull();
    expect(hint("protein", 0, false)).toBeNull();
  });
});

describe("source hygiene", () => {
  it("has no literal \\uXXXX escapes in JSX text under src", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx$/.test(name) && /\\u[0-9a-fA-F]{4}/.test(readFileSync(path, "utf8"))) offenders.push(path);
      }
    };
    walk(join(process.cwd(), "src"));
    expect(offenders).toEqual([]);
  });
});
