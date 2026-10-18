// Suggests likely duplicate exercise names in a user's own history (e.g.
// "Lat Pulldown" / "lat pull down" / "Lat Pulldowns") so they can merge them
// after confirming. Suggestions only — nothing is merged automatically.
import { canonicalExerciseKey, exerciseDisplayName } from "./exerciseMuscleMap";

export interface NameCount {
  name: string;
  count: number;
}

export interface DuplicateGroup {
  names: NameCount[];
  /** Name to merge into by default: the library's name if one of them is it, otherwise the most-used. */
  suggestedTarget: string;
  reason: "same-spelling" | "same-library-exercise" | "near-identical";
}

const SYNONYMS: Record<string, string> = { dumbbell: "db", dumbbells: "db", barbell: "bb", kettlebell: "kb" };

function singular(word: string): string {
  if (/(ss|sh|ch|x|z)es$/.test(word)) return word.slice(0, -2); // presses -> press, crunches -> crunch
  return word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
}

/** Spacing-, punctuation-, case- and plural-insensitive form of a name. */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => singular(SYNONYMS[w] ?? w))
    .join("");
}

function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

export function findDuplicateGroups(names: NameCount[]): DuplicateGroup[] {
  const parent = names.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const reasons = new Map<number, DuplicateGroup["reason"]>();
  const union = (i: number, j: number, reason: DuplicateGroup["reason"]) => {
    const a = find(i);
    const b = find(j);
    if (a === b) return;
    parent[b] = a;
    // Keep the strongest reason seen for the merged group.
    const order: DuplicateGroup["reason"][] = ["same-spelling", "same-library-exercise", "near-identical"];
    const best = [reasons.get(a), reasons.get(b), reason].filter(Boolean) as DuplicateGroup["reason"][];
    reasons.set(a, best.sort((x, y) => order.indexOf(x) - order.indexOf(y))[0]);
  };

  const keys = names.map((n) => nameKey(n.name));
  const canon = names.map((n) => canonicalExerciseKey(n.name));
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      if (keys[i] === keys[j]) union(i, j, "same-spelling");
      else if (canon[i] && canon[i] === canon[j]) union(i, j, "same-library-exercise");
      else if (
        Math.min(keys[i].length, keys[j].length) >= 8 &&
        editDistance(keys[i], keys[j], 2) <= (Math.max(keys[i].length, keys[j].length) >= 14 ? 2 : 1)
      ) {
        union(i, j, "near-identical");
      }
    }
  }

  const groups = new Map<number, number[]>();
  names.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), i]));

  const result: DuplicateGroup[] = [];
  for (const [root, members] of groups) {
    if (members.length < 2) continue;
    const group = members.map((i) => names[i]).sort((a, b) => b.count - a.count || a.name.length - b.name.length);
    const libraryKey = members.map((i) => canon[i]).find(Boolean);
    const libraryName = libraryKey ? exerciseDisplayName(libraryKey) : null;
    const libraryMatch = libraryName ? group.find((g) => g.name.toLowerCase() === libraryName.toLowerCase()) : undefined;
    result.push({
      names: group,
      suggestedTarget: (libraryMatch ?? group[0]).name,
      reason: reasons.get(root) ?? "near-identical",
    });
  }
  return result.sort((a, b) => b.names.length - a.names.length);
}
