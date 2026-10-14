// The user's own resistance band set — color-to-resistance mapping is
// brand/set-specific, not a universal standard, so this reflects exactly
// what they described rather than a generic convention.
export type BandColor = "green" | "blue" | "yellow" | "red" | "black";

export interface BandOption {
  color: BandColor;
  label: string;
  swatch: string;
}

export const BAND_OPTIONS: BandOption[] = [
  { color: "green", label: "Extra Light", swatch: "#22c55e" },
  { color: "blue", label: "Light", swatch: "#3b82f6" },
  { color: "yellow", label: "Medium", swatch: "#eab308" },
  { color: "red", label: "Heavy", swatch: "#ef4444" },
  { color: "black", label: "Extra Heavy", swatch: "#27272a" },
];

export function bandLabel(color: BandColor): string {
  const option = BAND_OPTIONS.find((o) => o.color === color);
  const colorName = color.charAt(0).toUpperCase() + color.slice(1);
  return option ? `${colorName} (${option.label})` : colorName;
}
