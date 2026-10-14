import { BodyMapRegion } from "./bodyMapGeometry";

export type MuscleGroupId =
  | "frontDelts"
  | "sideRearDelts"
  | "upperChest"
  | "midLowerChest"
  | "biceps"
  | "triceps"
  | "forearms"
  | "abs"
  | "obliques"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "lats"
  | "traps"
  | "upperBack"
  | "lowerBack";

export interface MuscleGroupDef {
  id: MuscleGroupId;
  label: string;
  /** Which anatomy-figure region(s) this renders into. Upper/mid-lower chest
   * both render into "chest" (the library has no split-chest region); lats
   * render into "upper-back" (no distinct lats region) — both views and
   * front/back */
  visualRegions: { front?: BodyMapRegion; back?: BodyMapRegion };
  /** Golf-relevant areas get a small boost in the weekly focus ranking. */
  golfRelevant: boolean;
}

export const MUSCLE_GROUPS: MuscleGroupDef[] = [
  { id: "frontDelts", label: "Front Delts", visualRegions: { front: "front-deltoids" }, golfRelevant: false },
  { id: "sideRearDelts", label: "Side/Rear Delts", visualRegions: { back: "back-deltoids" }, golfRelevant: false },
  { id: "upperChest", label: "Upper Chest", visualRegions: { front: "chest" }, golfRelevant: false },
  { id: "midLowerChest", label: "Mid/Lower Chest", visualRegions: { front: "chest" }, golfRelevant: false },
  { id: "biceps", label: "Biceps", visualRegions: { front: "biceps" }, golfRelevant: false },
  { id: "triceps", label: "Triceps", visualRegions: { front: "triceps", back: "triceps" }, golfRelevant: false },
  { id: "forearms", label: "Forearms", visualRegions: { front: "forearm", back: "forearm" }, golfRelevant: true },
  { id: "abs", label: "Abs", visualRegions: { front: "abs" }, golfRelevant: true },
  { id: "obliques", label: "Obliques", visualRegions: { front: "obliques" }, golfRelevant: true },
  { id: "quads", label: "Quads", visualRegions: { front: "quadriceps" }, golfRelevant: false },
  { id: "hamstrings", label: "Hamstrings", visualRegions: { back: "hamstring" }, golfRelevant: false },
  { id: "glutes", label: "Glutes", visualRegions: { back: "gluteal" }, golfRelevant: true },
  { id: "calves", label: "Calves", visualRegions: { front: "calves", back: "calves" }, golfRelevant: false },
  { id: "lats", label: "Lats", visualRegions: { back: "upper-back" }, golfRelevant: true },
  { id: "traps", label: "Traps", visualRegions: { back: "trapezius" }, golfRelevant: false },
  { id: "upperBack", label: "Upper Back", visualRegions: { back: "upper-back" }, golfRelevant: false },
  { id: "lowerBack", label: "Lower Back", visualRegions: { back: "lower-back" }, golfRelevant: false },
];

export function muscleGroup(id: MuscleGroupId): MuscleGroupDef {
  const found = MUSCLE_GROUPS.find((g) => g.id === id);
  if (!found) throw new Error(`Unknown muscle group: ${id}`);
  return found;
}

/** Internal groups that render into a given visual region/view — e.g. both
 * Upper Chest and Mid/Lower Chest render into the front "chest" polygon. */
export function groupsForRegion(view: "front" | "back", region: BodyMapRegion): MuscleGroupId[] {
  return MUSCLE_GROUPS.filter((g) => g.visualRegions[view] === region).map((g) => g.id);
}
