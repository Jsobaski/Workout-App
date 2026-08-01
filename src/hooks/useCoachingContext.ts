"use client";

import { useCallback, useEffect, useState } from "react";
import { getCoachingContext, saveCoachingContext } from "@/lib/db";
import { CoachingContext, DEFAULT_COACHING_CONTEXT } from "@/lib/types";

export function useCoachingContext() {
  const [context, setContext] = useState<CoachingContext>(
    DEFAULT_COACHING_CONTEXT
  );
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ctx = await getCoachingContext();
      if (!cancelled) {
        setContext(ctx);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (next: CoachingContext) => {
    await saveCoachingContext(next);
    setContext(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, []);

  return { context, setContext, loading, save, saved };
}
