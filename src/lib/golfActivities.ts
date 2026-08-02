import { GolfActivityType } from "./types";

export interface GolfActivityOption {
  type: GolfActivityType;
  label: string;
  defaultDurationMin: number;
}

// Order shown in the quick-pick UI.
export const GOLF_ACTIVITY_OPTIONS: GolfActivityOption[] = [
  { type: "full_round", label: "Full Round (18)", defaultDurationMin: 240 },
  { type: "nine_holes", label: "9 Holes", defaultDurationMin: 120 },
  { type: "simulator", label: "Simulator Session", defaultDurationMin: 60 },
  { type: "practice_range", label: "Range / Practice", defaultDurationMin: 45 },
  { type: "short_game", label: "Short Game", defaultDurationMin: 30 },
];

export function golfActivityLabel(type: GolfActivityType): string {
  return GOLF_ACTIVITY_OPTIONS.find((o) => o.type === type)?.label ?? type;
}
