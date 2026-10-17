"use client";

import { useCallback, useEffect, useState } from "react";
import { getExerciseSettings, saveExerciseSettings } from "@/lib/db";
import type { ExerciseSettingsOverrides } from "@/lib/exerciseSettings";

export function useExerciseSettings() {
  const [overrides, setOverrides] = useState<ExerciseSettingsOverrides>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getExerciseSettings();
        if (!cancelled) setOverrides(loaded);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveOverrides = useCallback(async (next: ExerciseSettingsOverrides) => {
    setOverrides(next); // optimistic — the checkbox/number reflects the edit immediately
    await saveExerciseSettings(next);
  }, []);

  return { overrides, loading, saveOverrides };
}
