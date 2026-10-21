"use client";

import { useEffect } from "react";
import { useAppearance } from "@/lib/appearance";
import { accentVariables, resolveTheme } from "@/lib/holidays";
import { todayKey } from "@/lib/date";

// Applies the holiday accent colour (an override of the emerald ramp) to the
// whole app. Renders nothing; with no active holiday it sets nothing at all.
export default function ThemeApplier() {
  const { theme } = useAppearance();
  useEffect(() => {
    const root = document.documentElement;
    const vars = accentVariables(resolveTheme(todayKey(), theme));
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
    return () => {
      for (const name of Object.keys(vars)) root.style.removeProperty(name);
    };
  }, [theme]);
  return null;
}
