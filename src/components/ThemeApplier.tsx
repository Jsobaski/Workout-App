"use client";

import { useEffect } from "react";
import { useAppearance } from "@/lib/appearance";
import { accentVariables, backdropImage, resolveTheme } from "@/lib/holidays";
import { todayKey } from "@/lib/date";

// Applies the holiday accent colour (an override of the emerald ramp) to the whole
// app and draws a faint full-page emoji backdrop for the day. With no active
// holiday it sets and renders nothing at all.
export default function ThemeApplier() {
  const { theme } = useAppearance();
  const holiday = resolveTheme(todayKey(), theme);
  useEffect(() => {
    const root = document.documentElement;
    const vars = accentVariables(resolveTheme(todayKey(), theme));
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
    return () => {
      for (const name of Object.keys(vars)) root.style.removeProperty(name);
    };
  }, [theme]);
  if (!holiday) return null;
  return (
    <div
      aria-hidden="true"
      data-testid="holiday-backdrop"
      className="pointer-events-none fixed inset-0 z-0 opacity-[0.14]"
      style={{ backgroundImage: backdropImage(holiday), backgroundSize: "auto, 150px 150px" }}
    />
  );
}
