"use client";

import { useEffect, useState } from "react";
import { listRecentDistinctFoodEntries } from "@/lib/db";
import { FoodEntry } from "@/lib/types";

export function useRecentFoods(refreshKey?: unknown) {
  const [items, setItems] = useState<FoodEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await listRecentDistinctFoodEntries();
      if (!cancelled) setItems(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return items;
}
