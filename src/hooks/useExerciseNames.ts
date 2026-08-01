"use client";

import { useEffect, useState } from "react";
import { listDistinctExerciseNames } from "@/lib/db";

export function useExerciseNames(refreshKey?: unknown) {
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await listDistinctExerciseNames();
      if (!cancelled) setNames(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return names;
}
