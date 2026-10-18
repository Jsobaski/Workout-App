"use client";

import { useCallback, useEffect, useState } from "react";
import { getExerciseSettings, saveExerciseSettings } from "@/lib/db";
import { ExerciseSettingsData, emptyExerciseSettings } from "@/lib/exerciseSettings";

/** This device's exercise preferences (overrides, restricted patterns, priority muscles). Neutral until the user sets something. */
export function useExerciseSettings() {
  const [settings, setSettings] = useState<ExerciseSettingsData>(emptyExerciseSettings());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getExerciseSettings();
        if (!cancelled) setSettings(loaded);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveSettings = useCallback(async (next: ExerciseSettingsData) => {
    setSettings(next); // optimistic — controls reflect the edit immediately
    await saveExerciseSettings(next);
  }, []);

  return { settings, loading, saveSettings };
}
