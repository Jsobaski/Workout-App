"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteMeasurementEntry,
  listAllMeasurementEntries,
  saveMeasurementEntry,
} from "@/lib/db";
import { BodyMeasurementEntry } from "@/lib/types";

export function useMeasurements() {
  const [entries, setEntries] = useState<BodyMeasurementEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const all = await listAllMeasurementEntries();
      setEntries(all);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const all = await listAllMeasurementEntries();
        if (!cancelled) setEntries(all);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addMeasurementEntry = useCallback(
    async (entry: Omit<BodyMeasurementEntry, "id">) => {
      await saveMeasurementEntry(entry);
      await refresh();
    },
    [refresh]
  );

  const removeMeasurementEntry = useCallback(
    async (id: string) => {
      await deleteMeasurementEntry(id);
      await refresh();
    },
    [refresh]
  );

  return { entries, loading, addMeasurementEntry, removeMeasurementEntry };
}
