import { BandColor } from "./bands";

export interface SetEntry {
  reps: number;
  weight: number;
  durationSec?: number; // set when the parent entry is timed (e.g. plank holds) — reps is unused then
  bandColor?: BandColor; // set when the parent entry is banded — stands in for weight
}

export interface WorkoutEntry {
  id: string;
  dateKey: string; // YYYY-MM-DD, local calendar day
  timestamp: number; // ms epoch, when logged
  exerciseName: string;
  muscleGroups: string[];
  sets: SetEntry[];
  bodyweight?: boolean; // no added weight — e.g. pull-ups, knee raises
  timed?: boolean; // logged by duration (seconds held) rather than reps — e.g. planks
  banded?: boolean; // resistance comes from a band color, not a numeric weight
  notes?: string;
}

export interface BodyMeasurementEntry {
  id: string;
  dateKey: string; // YYYY-MM-DD, local calendar day
  timestamp: number; // ms epoch, when logged
  weightLb?: number;
  bodyFatPct?: number;
  neckIn?: number;
  shouldersIn?: number;
  chestIn?: number;
  waistIn?: number;
  hipsIn?: number;
  bicepIn?: number;
  forearmIn?: number;
  thighIn?: number;
  calfIn?: number;
  notes?: string;
}

export type GolfActivityType =
  | "full_round"
  | "nine_holes"
  | "simulator"
  | "practice_range"
  | "short_game";

export interface GolfActivityEntry {
  id: string;
  dateKey: string; // YYYY-MM-DD, local calendar day
  timestamp: number; // ms epoch, when logged
  activityType: GolfActivityType;
  durationMin: number | null;
  notes?: string;
}

export type FoodSource = "typed" | "photo";

export interface FoodEntry {
  id: string;
  dateKey: string; // YYYY-MM-DD, local calendar day
  timestamp: number; // ms epoch
  itemName: string;
  calories: number;
  proteinG: number;
  source: FoodSource;
  photoThumbnail?: Blob;
  confidenceNote?: string;
}

export interface CoachingContext {
  key: "coachingContext";
  goals: string;
  ageRange: string;
  heightIn: number | null;
  currentWeightLb: number | null;
  activityLevel: string;
  trainingFrequencyTarget: number | null;
  calorieTargetLow: number | null;
  calorieTargetHigh: number | null;
  proteinTargetG: number | null;
  injuryNotes: string;
}

export interface FoodEstimate {
  item: string;
  calories: number;
  protein_g: number;
  confidence_note: string;
}

export interface SuggestedExercise {
  name: string;
  sets: number;
  reps: number;
  weight: number;
  reasoning: string;
  muscleGroups?: string[];
  caution?: string;
}

export interface WorkoutSuggestion {
  exercises: SuggestedExercise[];
  summary: string;
}

export const DEFAULT_COACHING_CONTEXT: CoachingContext = {
  key: "coachingContext",
  goals:
    "Body recomposition (build muscle, lose fat). Improve rotational/hip power for golf swing. Improve hip internal rotation to fix early extension in swing.",
  ageRange: "",
  heightIn: null,
  currentWeightLb: null,
  activityLevel: "",
  trainingFrequencyTarget: null,
  calorieTargetLow: 2100,
  calorieTargetHigh: 2300,
  proteinTargetG: 175,
  injuryNotes:
    "Neck sensitivity during Pallof press and other anti-rotation core work — watch shoulder/neck tension cues.",
};
