import { BodyMeasurementEntry } from "./types";

type MeasurementKey = Exclude<keyof BodyMeasurementEntry, "id" | "dateKey" | "timestamp" | "notes">;

export interface MeasurementField {
  key: MeasurementKey;
  label: string;
  unit: string;
  hint?: string;
}

// A comprehensive set of standard body-recomposition tracking points — the
// full picture, not just the areas most people think to ask about. Weight
// and body fat % give the overall trend; waist trending down while chest,
// arms, and thighs hold or trend up is the classic "gaining muscle, losing
// fat" signal that the scale alone can't show. All fields are optional —
// log whatever you actually measured.
export const MEASUREMENT_FIELDS: MeasurementField[] = [
  { key: "weightLb", label: "Body Weight", unit: "lb" },
  { key: "bodyFatPct", label: "Body Fat", unit: "%", hint: "scale or calipers" },
  { key: "neckIn", label: "Neck", unit: "in" },
  { key: "shouldersIn", label: "Shoulders", unit: "in" },
  { key: "chestIn", label: "Chest", unit: "in", hint: "at nipple line" },
  { key: "waistIn", label: "Waist", unit: "in", hint: "at navel" },
  { key: "hipsIn", label: "Hips", unit: "in", hint: "widest point" },
  { key: "bicepIn", label: "Bicep", unit: "in", hint: "same arm each time, flexed or relaxed" },
  { key: "forearmIn", label: "Forearm", unit: "in", hint: "widest point" },
  { key: "thighIn", label: "Thigh", unit: "in", hint: "same leg each time" },
  { key: "calfIn", label: "Calf", unit: "in" },
];

export function measurementFieldValue(
  entry: BodyMeasurementEntry,
  field: MeasurementField
): number | undefined {
  return entry[field.key];
}
