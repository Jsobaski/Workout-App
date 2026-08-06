"use client";

import { useEffect, useState } from "react";
import { listAllDistinctFoodEntries } from "@/lib/db";
import { FoodEntry } from "@/lib/types";

// Every distinct food ever logged (one entry per name, most recent values),
// so autocomplete and auto-fill reach back further than just the last few
// days — everything already lives in IndexedDB on-device, this just surfaces
// all of it instead of a recent window.
export function useFoodHistory(refreshKey?: unknown) {
  const [items, setItems] = useState<FoodEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await listAllDistinctFoodEntries();
      if (!cancelled) setItems(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return items;
}
