export interface SetEntry {
  reps: number;
  weight: number;
}

export interface WorkoutEntry {
  id: string;
  dateKey: string; // YYYY-MM-DD, local calendar day
  timestamp: number; // ms epoch, when logged
  exerciseName: string;
  muscleGroups: string[];
  sets: SetEntry[];
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
