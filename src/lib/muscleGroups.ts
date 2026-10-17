// Lightweight keyword-based classifier so free-typed exercise names still
// roll up into a muscle-group summary (used for day totals and to steer
// "avoid repeating recently-hit muscle groups" workout suggestions).
const RULES: { pattern: RegExp; groups: string[] }[] = [
  { pattern: /deadlift|good morning|hip hinge|rdl|back extension|hyperextension/i, groups: ["Posterior Chain", "Glutes"] },
  { pattern: /squat|lunge|leg press|leg extension|step.?up/i, groups: ["Quads", "Glutes"] },
  { pattern: /bench|chest press|push.?up|fly|incline/i, groups: ["Chest", "Triceps"] },
  { pattern: /row|pulldown|pull.?up|chin.?up|\blats?\b/i, groups: ["Back", "Biceps"] },
  { pattern: /shoulder press|overhead press|ohp|lateral raise|delt|face pull/i, groups: ["Shoulders"] },
  { pattern: /curl/i, groups: ["Biceps"] },
  { pattern: /tricep|dip|skull.?crusher|pushdown/i, groups: ["Triceps"] },
  { pattern: /pallof|anti.?rotation|core|plank|dead.?bug|ab |knee raise|captain.?s chair|leg raise/i, groups: ["Core"] },
  { pattern: /rotation|swing|cable chop|wood.?chop/i, groups: ["Rotational Core"] },
  { pattern: /calf/i, groups: ["Calves"] },
  { pattern: /hip thrust|glute bridge|leg bridge|clamshell|hip abduction|lateral walk|glute/i, groups: ["Glutes"] },
];

export function inferMuscleGroups(exerciseName: string): string[] {
  const matches = new Set<string>();
  for (const rule of RULES) {
    if (rule.pattern.test(exerciseName)) {
      rule.groups.forEach((g) => matches.add(g));
    }
  }
  return matches.size > 0 ? Array.from(matches) : ["Other"];
}
