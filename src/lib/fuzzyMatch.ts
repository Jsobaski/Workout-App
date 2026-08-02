// Common gym shorthand so typing an abbreviation still finds the full name,
// e.g. "db" -> matches "Dumbbell Goblet Squat".
const ABBREVIATIONS: Record<string, string> = {
  db: "dumbbell",
  bb: "barbell",
  kb: "kettlebell",
  bw: "bodyweight",
  ohp: "overhead press",
  bp: "bench press",
  rdl: "romanian deadlift",
  dl: "deadlift",
  sq: "squat",
  bs: "back squat",
  fs: "front squat",
  pu: "pull up",
  cg: "close grip",
};

function expandWords(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ABBREVIATIONS[word] ?? word);
}

export function matchExerciseNames(
  query: string,
  names: string[],
  limit = 6
): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const lower = trimmed.toLowerCase();
  const tokens = expandWords(trimmed);

  const scored = names
    .map((name) => {
      const lowerName = name.toLowerCase();
      let score = -1;
      if (lowerName.startsWith(lower)) {
        score = 3;
      } else if (lowerName.includes(lower)) {
        score = 2;
      } else if (tokens.length > 0 && tokens.every((t) => lowerName.includes(t))) {
        score = 1;
      }
      return { name, score };
    })
    .filter((s) => s.score >= 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return scored.slice(0, limit).map((s) => s.name);
}
