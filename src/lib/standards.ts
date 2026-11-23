// Where a lift's strength standard comes from, and how it's adjusted: the optional women's reference, and
// the plain-language source note shown in the app. Pure.
import { ExerciseMapping } from "./exerciseMuscleMap";
import { LIFT_FAMILY_STANDARDS, LiftFamily, WOMEN_STANDARD_FACTOR } from "./muscleScoreConfig";
import { MuscleGroupId } from "./muscleTaxonomy";

/** Optional profile setting. The published tables are men's; "female" applies the published women-to-men ratios, and "male" and "unspecified" both use the men's tables. */
export type StandardsReference = "unspecified" | "male" | "female";
export type Standard = [number, number, number, number, number];

export const STANDARDS_REFERENCE_LABELS: Record<StandardsReference, string> = {
  male: "Male",
  female: "Female",
  unspecified: "Not specified (default)",
};

const LOWER_BODY: MuscleGroupId[] = ["quads", "hamstrings", "glutes", "calves", "lowerBack", "abs", "obliques"];

/** Women's required-multiple factor for a lift: lower body and trunk like the squat/deadlift, upper body like the bench. */
export function womenFactor(mapping: ExerciseMapping): number {
  const primary = mapping.muscles.filter((m) => m.weight >= 1).map((m) => m.group);
  const group = primary.length > 0 ? primary : mapping.muscles.map((m) => m.group);
  const lower = group.filter((g) => LOWER_BODY.includes(g)).length;
  return lower * 2 >= group.length ? WOMEN_STANDARD_FACTOR.lower : WOMEN_STANDARD_FACTOR.upper;
}

export function standardForMapping(mapping: ExerciseMapping, reference: StandardsReference = "unspecified"): Standard | null {
  let table: Standard;
  if (mapping.scoring.method === "standard") {
    table = LIFT_FAMILY_STANDARDS[mapping.scoring.family];
  } else if (mapping.scoring.method === "proxy") {
    const base = LIFT_FAMILY_STANDARDS[mapping.scoring.family];
    const f = mapping.scoring.factor;
    table = base.map((v) => v * f) as Standard;
  } else {
    return null; // volumeOnly
  }
  if (reference === "female") {
    const f = womenFactor(mapping);
    return table.map((v) => v * f) as Standard;
  }
  return table;
}

export type Confidence = "sourced" | "approximate" | "estimate";

export interface StandardInfo {
  confidence: Confidence;
  /** Short name of the standard, e.g. "barbell squat". */
  name: string;
  /** One or two plain sentences about where the numbers come from. */
  note: string;
}

const FAMILY_INFO: Record<LiftFamily, StandardInfo> = {
  barbellSquat: { confidence: "approximate", name: "barbell squat", note: "Anchored to Strength Level's male squat standards and FitnessVolt's modeled 180 lb lifter (community and modeled data, not a clinical study)." },
  barbellDeadlift: { confidence: "approximate", name: "barbell deadlift", note: "Anchored to Strength Level's male deadlift standards and FitnessVolt's 180 lb figures (community and modeled data)." },
  barbellBench: { confidence: "approximate", name: "barbell bench press", note: "The intermediate level is sourced (about 1.23x bodyweight at 180 lb); the other levels follow the shape of Strength Level's male bench standards." },
  tricepExt: { confidence: "approximate", name: "triceps pushdown / extension", note: "Strength Level male bodyweight ratios for the pushdown (0.25 to 1.5x bodyweight)." },
  curl: { confidence: "approximate", name: "curl", note: "Consistent with Strength Level's male cable-curl and dumbbell-curl standards; dumbbell curls are scored per hand." },
  wristCurl: { confidence: "approximate", name: "wrist curl", note: "Strength Level and FitnessVolt dumbbell wrist curl data; reverse wrist curl is 0.57 of it (weaker wrist extensors)." },
  lateralRaise: { confidence: "approximate", name: "lateral raise", note: "Strength Level's male dumbbell lateral raise standards, per hand, at an assumed 180 lb lifter." },
  legPress: { confidence: "approximate", name: "leg press", note: "A blend of Strength Level's seated and sled leg press tables, which are inconsistent. How you log plates vs total weight changes the result." },
  squat: { confidence: "estimate", name: "squat-based", note: "An older estimate, not yet checked against published tables." },
  deadlift: { confidence: "estimate", name: "deadlift-based", note: "An older estimate, not yet checked against published tables." },
  bench: { confidence: "estimate", name: "bench-based", note: "An older estimate, not yet checked against published tables." },
  ohp: { confidence: "estimate", name: "overhead press", note: "An estimate, not yet checked against published tables." },
  row: { confidence: "estimate", name: "row", note: "An estimate, not yet checked against published tables." },
  pullup: { confidence: "estimate", name: "pull-up", note: "An estimate, not yet checked against published tables." },
  hipThrust: { confidence: "estimate", name: "hip thrust", note: "An estimate, not yet checked against published tables." },
  facePull: { confidence: "estimate", name: "face pull", note: "An estimate, not yet checked against published tables." },
  pulldown: { confidence: "estimate", name: "pulldown", note: "An estimate, not yet checked against published tables." },
  legExtension: { confidence: "estimate", name: "leg extension", note: "An estimate, not yet checked against published tables." },
  legCurl: { confidence: "estimate", name: "leg curl", note: "An estimate, not yet checked against published tables." },
};

/** Where a lift's standard comes from, for the "how this is scored" note. Null for lifts scored only on consistency. */
export function describeStandard(mapping: ExerciseMapping): StandardInfo | null {
  if (mapping.scoring.method === "volumeOnly") return null;
  const info = FAMILY_INFO[mapping.scoring.family];
  if (mapping.scoring.method === "proxy") {
    // A scaled copy of another family's table: only as good as the factor chosen.
    const sourced = info.confidence !== "estimate" && mapping.scoring.family !== "legPress";
    return {
      confidence: sourced ? "approximate" : "estimate",
      name: info.name,
      note: `Scored as ${Math.round(mapping.scoring.factor * 100)}% of the ${info.name} standard (a rough scaling for this lift). ${info.note}`,
    };
  }
  return info;
}
